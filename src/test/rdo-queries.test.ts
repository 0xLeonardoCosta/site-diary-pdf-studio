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
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: vi.fn(() => mock.chain),
  rpc: vi.fn((...args: unknown[]) => { mock.calls.push({ method: 'rpc', args }); return Promise.resolve(mock.results.shift()); }),
} }));
import { criarRdo, moverRdo, historicoQuery, efetivoDiarioQuery, cronogramaQuery, TAMANHO_PAGINA } from '@/lib/rdo/queries';

// Runs a plain query's function outside React.
async function rodar<T>(options: { queryKey: readonly unknown[]; queryFn?: unknown }): Promise<T> {
  const fn = options.queryFn as (ctx: unknown) => Promise<T>;
  return fn({ queryKey: options.queryKey, signal: new AbortController().signal, meta: undefined, client: new QueryClient() });
}

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
  it('efetivo com mais de 1000 linhas é lido em páginas, sem erro', async () => {
    mock.results.push({ data: [{ id: 'a', data: '2026-10-27', numero: 1002, status: 'fechado' }], error: null });
    mock.results.push({ data: Array.from({ length: 1000 }, () => ({ rdo_id: 'a', quantidade: 1 })), error: null });
    mock.results.push({ data: [{ rdo_id: 'a', quantidade: 5 }], error: null });
    const options = historicoQuery('usuario', '');
    const fn = options.queryFn;
    if (typeof fn !== 'function') throw new Error('Missing query function');
    const result = await fn({ pageParam: 0, queryKey: options.queryKey, signal: new AbortController().signal, direction: 'forward', meta: undefined, client: new QueryClient() });
    expect(mock.calls.filter(c => c.method === 'range').map(c => c.args)).toEqual([[0, 29], [0, 999], [1000, 1999]]);
    expect(result.rows[0]?.total).toBe(1005);
  });
  it('gráfico de efetivo vem somado do banco numa única chamada', async () => {
    mock.results.push({ data: [['2026-10-01', 3, 10, 2], ['2026-10-02', 1, 0, 0]], error: null });
    const pontos = await rodar<{ data: string; total: number; direto: number }[]>(efetivoDiarioQuery('usuario'));
    expect(mock.calls.map(c => c.method)).toEqual(['rpc']);
    expect(pontos).toEqual([
      { data: '2026-10-01', indireto: 3, direto: 10, terceirizado: 2, total: 15 },
      { data: '2026-10-02', indireto: 1, direto: 0, terceirizado: 0, total: 1 },
    ]);
  });
  it('sem a função no banco, o efetivo é somado aqui com as páginas pedidas juntas', async () => {
    mock.results.push({ data: null, error: { code: 'PGRST202', message: 'not found' } });
    mock.results.push({ count: 2, error: null }, { count: 3, error: null });
    mock.results.push({ data: [{ id: 'b', data: '2026-10-02' }, { id: 'a', data: '2026-10-01' }], error: null });
    mock.results.push({ data: [{ rdo_id: 'a', categoria: 'direto', quantidade: 4 }, { rdo_id: 'a', categoria: 'indireto', quantidade: 1 }, { rdo_id: 'b', categoria: 'terceirizado', quantidade: 2 }], error: null });
    const pontos = await rodar<{ data: string; total: number }[]>(efetivoDiarioQuery('usuario'));
    expect(pontos.map(p => [p.data, p.total])).toEqual([['2026-10-01', 5], ['2026-10-02', 2]]);
  });
  it('cronograma de um mês lê só os RDOs e as atividades daquele mês', async () => {
    mock.results.push({ data: [{ id: 'a', data: '2026-10-01' }], error: null });
    mock.results.push({ data: [{ rdo_id: 'a', frente_id: 'f', descricao: 'Dragagem' }], error: null });
    const dados = await rodar<{ atividades: unknown[] }>(cronogramaQuery('usuario', '2026-10'));
    expect(mock.calls.find(c => c.method === 'gte')?.args).toEqual(['data', '2026-10-01']);
    expect(mock.calls.find(c => c.method === 'lt')?.args).toEqual(['data', '2026-11-01']);
    expect(mock.calls.find(c => c.method === 'in')?.args).toEqual(['rdo_id', ['a']]);
    expect(dados.atividades).toHaveLength(1);
  });
});
