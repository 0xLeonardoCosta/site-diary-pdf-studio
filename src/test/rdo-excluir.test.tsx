import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => {
  const ordem: string[] = [];
  const dados: Record<string, unknown[]> = {};
  return {
    ordem, dados, sucesso: vi.fn(), erro: vi.fn(), rpc: vi.fn(),
    from: (tabela: string) => ({ select: () => ({ in: () => Promise.resolve({ data: dados[tabela] ?? [], error: null }) }) }),
    remove: vi.fn(),
  };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mock.from, rpc: mock.rpc, storage: { from: () => ({ remove: mock.remove }) } } }));
vi.mock('sonner', () => ({ toast: { success: mock.sucesso, error: mock.erro } }));
import { ExcluirRdos } from '@/components/rdo/excluir-rdos';

const rdo = (id: string, numero: number, data: string, assinado_nome: string | null = null) => ({ id, numero, data, assinado_nome });
function montar(ids = ['a', 'b']) {
  const aoExcluir = vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><ExcluirRdos userId="u" ids={ids} aoExcluir={aoExcluir} /></QueryClientProvider>);
  return aoExcluir;
}
const abrir = async () => {
  fireEvent.click(screen.getByRole('button', { name: "Excluir RDO's" }));
  return screen.findByRole('alertdialog');
};
beforeEach(() => {
  mock.ordem.length = 0; vi.clearAllMocks();
  mock.dados['rdos'] = [rdo('b', 1001, '2026-10-26', 'Gerente'), rdo('a', 1000, '2026-10-25')];
  mock.dados['fotos'] = [{ storage_path: 'b/f.jpg' }];
  mock.remove.mockImplementation(async () => { mock.ordem.push('arquivos'); return { error: null }; });
  mock.rpc.mockImplementation(async () => { mock.ordem.push('banco'); return { data: 2, error: null }; });
});
afterEach(cleanup);

describe('Excluir RDOs', () => {
  it('sem seleção o botão fica desativado', () => {
    montar([]);
    expect(screen.getByRole('button', { name: "Excluir RDO's" })).toBeDisabled();
  });
  it('avisa o que será apagado e destaca os assinados', async () => {
    montar();
    const alerta = await abrir();
    expect(alerta.textContent).toContain('Excluir 2 RDOs?');
    expect(alerta.textContent).toContain('Do RDO nº 1000 (25/10/2026) ao nº 1001 (26/10/2026)');
    expect(alerta.textContent).toContain('1 destes RDOs já está assinado: Gerente');
    expect(screen.getByRole('button', { name: 'Confirmar exclusão' }).className).toContain('bg-destructive');
  });
  it('cancelar não apaga nada', async () => {
    const aoExcluir = montar();
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.remove).not.toHaveBeenCalled();
    expect(aoExcluir).not.toHaveBeenCalled();
  });
  it('confirmar apaga primeiro os arquivos, depois o banco, e limpa a seleção', async () => {
    const aoExcluir = montar();
    await abrir();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' })); });
    await waitFor(() => expect(aoExcluir).toHaveBeenCalled());
    expect(mock.ordem).toEqual(['arquivos', 'banco']);
    expect(mock.remove).toHaveBeenCalledWith(['b/f.jpg']);
    expect(mock.rpc).toHaveBeenCalledWith('excluir_rdos', { p_ids: ['a', 'b'] });
    expect(mock.sucesso).toHaveBeenCalledWith('2 RDOs excluídos.');
  });
  it('recusa do banco mantém a seleção e mostra o erro', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: 'Só um administrador pode excluir RDOs.' } });
    const aoExcluir = montar();
    await abrir();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' })); });
    await waitFor(() => expect(mock.erro).toHaveBeenCalledWith('Só um administrador pode excluir RDOs.'));
    expect(aoExcluir).not.toHaveBeenCalled();
  });
});
