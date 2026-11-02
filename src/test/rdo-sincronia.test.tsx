import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => {
  const calls: { method: string; args: unknown[] }[] = [];
  const results: unknown[] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'is', 'update']) chain[method] = (...args: unknown[]) => { calls.push({ method, args }); return chain; };
  chain['maybeSingle'] = () => Promise.resolve(results.shift());
  return { calls, results, chain, erro: vi.fn() };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => mock.chain } }));
vi.mock('sonner', () => ({ toast: { error: mock.erro } }));
import { useCampo } from '@/hooks/use-campo';
import { posicaoAssinatura, removerFundo } from '@/lib/rdo/assinatura';
import { lerRascunho } from '@/lib/rdo/rascunho';
import { ConflitoEdicao, SemPermissao, salvarCampo, salvarLinha } from '@/lib/rdo/salvar';

beforeEach(() => { mock.calls.length = 0; mock.results.length = 0; mock.erro.mockClear(); });
afterEach(cleanup);

describe('Proteção contra gravação antiga', () => {
  it('só grava o campo se o banco ainda tem o valor que o usuário viu', async () => {
    mock.results.push({ data: { id: 'rdo' }, error: null });
    await salvarCampo('rdos', 'rdo', 'clima_manha', 'Bom', 'Nublado');
    expect(mock.calls.find(c => c.method === 'update')?.args).toEqual([{ clima_manha: 'Nublado' }]);
    expect(mock.calls.filter(c => c.method === 'eq').map(c => c.args)).toEqual([['id', 'rdo'], ['clima_manha', 'Bom']]);
  });
  it('compara campo vazio com is null', async () => {
    mock.results.push({ data: { id: 'rdo' }, error: null });
    await salvarCampo('rdos', 'rdo', 'clima_manha', null, 'Bom');
    expect(mock.calls.find(c => c.method === 'is')?.args).toEqual(['clima_manha', null]);
  });
  it('acusa conflito quando outra pessoa mudou o valor', async () => {
    mock.results.push({ data: null, error: null }, { data: { clima_manha: 'Chuva forte' }, error: null });
    await expect(salvarCampo('rdos', 'rdo', 'clima_manha', 'Bom', 'Nublado')).rejects.toBeInstanceOf(ConflitoEdicao);
  });
  it('sem linha alterada e valor igual significa falta de permissão', async () => {
    mock.results.push({ data: null, error: null }, { data: { clima_manha: 'Bom' }, error: null });
    await expect(salvarCampo('rdos', 'rdo', 'clima_manha', 'Bom', 'Nublado')).rejects.toBeInstanceOf(SemPermissao);
  });
  it('linha usa a última atualização vista e acusa conflito se mudou ou sumiu', async () => {
    mock.results.push({ data: { id: 'l' }, error: null });
    await salvarLinha('equipamentos', 'l', '2026-10-30T10:00:00+00:00', { quantidade: 2 });
    expect(mock.calls.filter(c => c.method === 'eq').map(c => c.args)).toEqual([['id', 'l'], ['updated_at', '2026-10-30T10:00:00+00:00']]);
    mock.results.push({ data: null, error: null }, { data: null, error: null });
    await expect(salvarLinha('equipamentos', 'l', null, { quantidade: 2 })).rejects.toBeInstanceOf(ConflitoEdicao);
  });
});

function Campo({ servidor, salvar }: { servidor: string; salvar: (valor: string, base: string) => Promise<string> }) {
  const c = useCampo(servidor, salvar);
  return <input aria-label="campo" value={c.valor} onChange={e => c.alterar(e.target.value)} onBlur={() => void c.confirmar()} />;
}
const Montar = ({ servidor, salvar }: { servidor: string; salvar: (valor: string, base: string) => Promise<string> }) => (
  <QueryClientProvider client={new QueryClient()}><Campo servidor={servidor} salvar={salvar} /></QueryClientProvider>
);
describe('Campo sincronizado', () => {
  it('atualização de outro usuário não apaga o que está sendo digitado, e a base continua a antiga', async () => {
    const salvar = vi.fn(async (valor: string) => valor);
    const { rerender } = render(<Montar servidor="a" salvar={salvar} />);
    const input = screen.getByRole('textbox', { name: 'campo' });
    fireEvent.change(input, { target: { value: 'meu texto' } });
    rerender(<Montar servidor="do colega" salvar={salvar} />);
    expect(input).toHaveValue('meu texto');
    await act(async () => { fireEvent.blur(input); });
    expect(salvar).toHaveBeenCalledWith('meu texto', 'a');
  });
  it('sem edição pendente mostra o valor recebido', () => {
    const { rerender } = render(<Montar servidor="a" salvar={vi.fn(async (v: string) => v)} />);
    rerender(<Montar servidor="b" salvar={vi.fn(async (v: string) => v)} />);
    expect(screen.getByRole('textbox', { name: 'campo' })).toHaveValue('b');
  });
  it('em caso de recusa avisa e volta ao valor do banco', async () => {
    const salvar = vi.fn(async (): Promise<string> => { throw new ConflitoEdicao(); });
    render(<Montar servidor="a" salvar={salvar} />);
    const input = screen.getByRole('textbox', { name: 'campo' });
    fireEvent.change(input, { target: { value: 'b' } });
    await act(async () => { fireEvent.blur(input); });
    expect(input).toHaveValue('a');
    expect(mock.erro).toHaveBeenCalledWith(new ConflitoEdicao().message);
  });
});

describe('Rascunhos antigos', () => {
  it('ignora rascunho só com os valores padrão do formulário', () => {
    expect(lerRascunho(JSON.stringify({ clima: { Manhã: 'Bom', Tarde: 'Bom', Noite: 'Bom' }, horario: '07:00 às 17:00', equipamentos: [{ a: 'Betoneira 400L', b: '1' }], atividades: [{ a: '', b: '' }], fotos: [] }))).toBeNull();
    expect(lerRascunho(null)).toBeNull();
    expect(lerRascunho('{quebrado')).toBeNull();
  });
  it('oferece importar quando há algo preenchido', () => {
    expect(lerRascunho(JSON.stringify({ ocorrencias: 'Chuva parou a obra' }))).not.toBeNull();
    expect(lerRascunho(JSON.stringify({ clima: { Manhã: 'Chuva forte' } }))).not.toBeNull();
    expect(lerRascunho(JSON.stringify({ equipamentos: [{ a: 'Escavadeira', b: '2' }] }))).not.toBeNull();
  });
});

describe('Preparo da assinatura', () => {
  const imagem = (linhas: number[][]) => Uint8ClampedArray.from(linhas.flat().flatMap(b => [b, b, b, 255]));
  it('deixa o papel transparente, mantém a tinta e recorta as margens', () => {
    const px = imagem([[235, 235, 235, 235], [235, 20, 30, 235], [235, 235, 235, 235]]);
    expect(removerFundo(px, 4, 3)).toEqual({ x: 1, y: 1, largura: 2, altura: 1 });
    expect(px[3]).toBe(0);
    expect(px[(1 * 4 + 1) * 4 + 3]).toBe(255);
    // The colour itself is untouched, so blue ink stays blue.
    expect(px[(1 * 4 + 1) * 4]).toBe(20);
  });
  it('funciona em digitalização cinza e avisa se não há tinta', () => {
    const cinza = imagem([[170, 170, 170], [170, 40, 170], [170, 170, 170]]);
    expect(removerFundo(cinza, 3, 3)).toEqual({ x: 1, y: 1, largura: 1, altura: 1 });
    expect(removerFundo(imagem([[250, 250], [250, 250]]), 2, 2)).toBeNull();
  });
  it('varia a posição entre RDOs e repete a mesma em cada exportação', () => {
    expect(posicaoAssinatura(976)).toEqual(posicaoAssinatura(976));
    expect(posicaoAssinatura(976)).not.toEqual(posicaoAssinatura(977));
    expect(Math.abs(posicaoAssinatura(980).angulo)).toBeLessThanOrEqual(1.8);
  });
});
