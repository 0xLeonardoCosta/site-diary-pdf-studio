import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'is', 'update', 'order']) chain[method] = (...args: unknown[]) => { calls.push({ method, args }); return chain; };
  chain['maybeSingle'] = () => Promise.resolve({ data: { id: 'rdo' }, error: null });
  const dias: Record<string, unknown> = {};
  return { calls, chain, dias, rpc: vi.fn(), permitido: { valor: true }, sucesso: vi.fn(), erro: vi.fn() };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => mock.chain, rpc: mock.rpc } }));
vi.mock('@/components/auth-context', () => ({ usePermissao: () => mock.permitido.valor }));
vi.mock('sonner', () => ({ toast: { success: mock.sucesso, error: mock.erro } }));
vi.mock('@/lib/rdo/queries', async original => {
  const real = await original<typeof import('@/lib/rdo/queries')>();
  return {
    ...real,
    obraQuery: () => ({ queryKey: ['obra'], queryFn: () => ({ nome: 'Ponte Sul' }) }),
    frentesQuery: () => ({ queryKey: ['frentes'], queryFn: () => [] }),
    diaQuery: (_: string, data: string) => ({ queryKey: ['dia', data], queryFn: () => mock.dias[data] }),
  };
});
import { ExportarLote } from '@/components/rdo/exportar-lote';
import { FecharRdo } from '@/components/rdo/fechar-rdo';
import { DescricaoComSugestoes } from '@/components/rdo/sugestoes';

const comQuery = (filho: ReactNode) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{filho}</QueryClientProvider>;
const dia = (numero: number, data: string) => ({ rdo: { id: `r${numero}`, numero, data, status: 'fechado', fotos_no_pdf: true }, maoObra: [], equipamentos: [], atividades: [], anotacoes: [], fotos: [] });
beforeEach(() => { mock.calls.length = 0; mock.permitido.valor = true; mock.rpc.mockReset(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Autocompletar de atividades', () => {
  function Campo({ frente, alterar = vi.fn(), enviar = vi.fn(), valor = 'base' }: { frente: string; alterar?: (v: string) => void; enviar?: () => void; valor?: string }) {
    return comQuery(<DescricaoComSugestoes userId="u" frente={frente} valor={valor} alterar={alterar} enviar={enviar} />);
  }
  it('consulta só a frente selecionada e escolher apenas preenche o campo', async () => {
    mock.rpc.mockResolvedValue({ data: [{ descricao: 'Execução de base', ultima_vez: '2026-10-28' }, { descricao: 'base', ultima_vez: '2026-10-27' }], error: null });
    const alterar = vi.fn(), enviar = vi.fn();
    render(<Campo frente="reto" alterar={alterar} enviar={enviar} />);
    fireEvent.focus(screen.getByRole('combobox', { name: 'Nova atividade' }));
    await waitFor(() => expect(mock.rpc).toHaveBeenLastCalledWith('sugestoes_atividades', { p_frente: 'reto', p_busca: 'base', p_limite: 8 }));
    const opcao = await screen.findByRole('option', { name: /Execução de base/ });
    // The exact text already typed is not offered back.
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.click(opcao);
    expect(alterar).toHaveBeenCalledWith('Execução de base');
    expect(enviar).not.toHaveBeenCalled();
  });
  it('sem frente não sugere nada e Enter envia o texto inédito', async () => {
    const enviar = vi.fn();
    render(<Campo frente="" enviar={enviar} />);
    const input = screen.getByRole('combobox', { name: 'Nova atividade' });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(enviar).toHaveBeenCalled();
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('Fechar e reabrir', () => {
  const montar = (status: string) => render(comQuery(<FecharRdo rdo={{ id: 'rdo', numero: 1004, status }} userId="u" />));
  it('fecha gravando o status a partir do valor visto', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    montar('aberto');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Fechar RDO' })); });
    expect(mock.calls.find(c => c.method === 'update')?.args).toEqual([{ status: 'fechado' }]);
    expect(mock.calls.filter(c => c.method === 'eq').map(c => c.args)).toEqual([['id', 'rdo'], ['status', 'aberto']]);
  });
  it('reabre e não faz nada se a pessoa cancelar', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(false);
    montar('fechado');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reabrir RDO' })); });
    expect(mock.calls).toHaveLength(0);
    confirmar.mockReturnValue(true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reabrir RDO' })); });
    expect(mock.calls.find(c => c.method === 'update')?.args).toEqual([{ status: 'aberto' }]);
  });
  it('sem permissão o botão não aparece', () => {
    mock.permitido.valor = false;
    montar('aberto');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('Exportação em lote', () => {
  it('monta um único documento em ordem cronológica, cada RDO em nova página', async () => {
    mock.dias['2026-10-28'] = dia(1003, '2026-10-28');
    mock.dias['2026-10-27'] = dia(1002, '2026-10-27');
    const imprimir = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { container } = render(comQuery(<ExportarLote userId="u" datas={['2026-10-28', '2026-10-27']}>x</ExportarLote>));
    fireEvent.click(screen.getByRole('button', { name: /Gerar PDF/ }));
    await waitFor(() => expect(imprimir).toHaveBeenCalledTimes(1));
    const docs = Array.from(container.querySelectorAll('.print-only'));
    expect(docs.map(d => d.querySelector('.text-2xl')?.textContent)).toEqual(['RDO Nº 1002', 'RDO Nº 1003']);
    expect(docs[0]?.className).not.toContain('break-before-page');
    expect(docs[1]?.className).toContain('break-before-page');
    expect(document.title).toContain('RDOs 1002 a 1003');
    await act(async () => { window.dispatchEvent(new Event('afterprint')); });
    expect(container.querySelectorAll('.print-only')).toHaveLength(0);
  });
  it('sem seleção o botão fica desativado', () => {
    render(comQuery(<ExportarLote userId="u" datas={[]}>x</ExportarLote>));
    expect(screen.getByRole('button', { name: /Gerar PDF/ })).toBeDisabled();
  });
});
