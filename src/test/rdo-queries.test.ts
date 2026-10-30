import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
const mock = vi.hoisted(() => {
  const calls: { method: string; args: unknown[] }[] = [];
  const results: unknown[] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'order', 'range', 'gte', 'lt', 'in', 'insert', 'update']) chain[method] = (...args: unknown[]) => { calls.push({ method, args }); return chain; };
  chain['single'] = () => Promise.resolve(results.shift());
  chain['maybeSingle'] = () => Promise.resolve(results.shift());
  chain['then'] = (resolve: (value: unknown) => unknown) => Promise.resolve(results.shift()).then(resolve);
  return { calls, results, chain };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: vi.fn(() => mock.chain) } }));
import { criarRdo, moverRdo, historicoQuery, TAMANHO_PAGINA } from '@/lib/rdo/queries';

beforeEach(() => { mock.calls.length = 0; mock.results.length = 0; });
describe('Contrato com o banco existente', () => {
  it('cria enviando somente data, sem numero nem autoria', async () => {
    mock.results.push({ data: { id: 'rdo', data: '2026-11-01', numero: 1007, status: 'aberto' }, error: null });
    await criarRdo('2026-11-01');
    expect(mock.calls.find(c => c.method === 'insert')?.args).toEqual([{ data: '2026-11-01' }]);
  });
  it('move atualizando somente a data por id', async () => {
    mock.results.push({ data: { id: 'rdo', data: '2026-11-01', numero: 1007 }, error: null });
    await moverRdo('rdo', '2026-11-01');
    expect(mock.calls.find(c => c.method === 'update')?.args).toEqual([{ data: '2026-11-01' }]);
    expect(mock.calls.find(c => c.method === 'eq')?.args).toEqual(['id', 'rdo']);
  });
  it('preserva erro de dia duplicado retornado pelo banco', async () => {
    mock.results.push({ data: null, error: { code: '23505', message: 'duplicate' } });
    await expect(moverRdo('rdo', '2026-11-01')).rejects.toMatchObject({ code: '23505' });
  });
  it('histórico usa 30 por vez, ordem descendente, mês e única consulta de efetivo', async () => {
    mock.results.push({ data: [{ id: 'a', data: '2026-10-27', numero: 1002, status: 'aberto' }, { id: 'b', data: '2026-10-25', numero: 1000, status: 'fechado' }], error: null });
    mock.results.push({ data: [{ rdo_id: 'a', quantidade: 4 }, { rdo_id: 'a', quantidade: 6 }, { rdo_id: 'b', quantidade: 1 }], error: null, count: 3 });
    const options = historicoQuery('usuario', '2026-10');
    // Invoke the query function with the same context used by Query's pagination.
    const fn = options.queryFn;
    if (typeof fn !== 'function') throw new Error('Missing query function');
    const result = await fn({ pageParam: 0, queryKey: options.queryKey, signal: new AbortController().signal, direction: 'forward', meta: undefined, client: new QueryClient() });
    expect(TAMANHO_PAGINA).toBe(30);
    expect(mock.calls.find(c => c.method === 'range')?.args).toEqual([0, 29]);
    expect(mock.calls.find(c => c.method === 'order')?.args).toEqual(['data', { ascending: false }]);
    expect(mock.calls.find(c => c.method === 'gte')?.args).toEqual(['data', '2026-10-01']);
    expect(mock.calls.find(c => c.method === 'lt')?.args).toEqual(['data', '2026-11-01']);
    expect(mock.calls.filter(c => c.method === 'in').map(c => c.args)).toEqual([['rdo_id', ['a', 'b']]]);
    expect(result.rows.map(r => r.total)).toEqual([10, 1]);
  });
});