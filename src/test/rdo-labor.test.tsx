import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ result: { data: null as unknown, error: null as unknown }, update: vi.fn(), insert: vi.fn(), error: vi.fn() }));
vi.mock('@/components/auth-context', () => ({ usePermissao: () => true }));
vi.mock('sonner', () => ({ toast: { error: mocks.error } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => {
  const chain = { eq: () => chain, select: () => chain, single: () => Promise.resolve(mocks.result) };
  return { update: (values: unknown) => { mocks.update(values); return chain; }, insert: (values: unknown) => { mocks.insert(values); return chain; } };
} } }));
import { MaoObra } from '@/components/rdo/labor';
import { diaQuery, type MaoObraBanco } from '@/lib/rdo/queries';
import { useSuspenseQuery } from '@tanstack/react-query';
const rdo = { id: 'rdo', data: '2026-10-27', numero: 1002, status: 'aberto' };
const row: MaoObraBanco = { id: 'linha', rdo_id: 'rdo', funcao: 'Pedreiro', categoria: 'direto', quantidade: 4, copiado: false, copiado_por: null, created_by: 'autor', created_at: '2026-10-27', updated_by: null, updated_at: null };
function Teste() {
  const { data } = useSuspenseQuery(diaQuery('usuario', rdo.data));
  return <MaoObra rdo={data.rdo} rows={data.maoObra} userId="usuario" date={rdo.data} />;
}
function montar() {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(diaQuery('usuario', rdo.data).queryKey, { rdo, maoObra: [row] });
  render(<QueryClientProvider client={client}><Teste /></QueryClientProvider>);
  return client;
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('Salvar mão de obra ao sair do campo', () => {
  it('atualiza quantidade e relê a linha retornada no cache', async () => {
    mocks.result = { data: { ...row, quantidade: 7 }, error: null };
    const client = montar();
    const input = screen.getByRole('spinbutton', { name: 'Quantidade Pedreiro' });
    fireEvent.change(input, { target: { value: '7' } }); fireEvent.blur(input);
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ funcao: 'Pedreiro', categoria: 'direto', quantidade: 7 }));
    await waitFor(() => expect(client.getQueryData<{ maoObra: MaoObraBanco[] }>(diaQuery('usuario', rdo.data).queryKey)?.maoObra[0]?.quantidade).toBe(7));
    expect(mocks.error).not.toHaveBeenCalled();
  });
  it('reverte linha para quantidade anterior quando o servidor nega', async () => {
    mocks.result = { data: null, error: { message: 'Ação negada pelo servidor.' } };
    const client = montar();
    const input = screen.getByRole('spinbutton', { name: 'Quantidade Pedreiro' });
    fireEvent.change(input, { target: { value: '9' } }); fireEvent.blur(input);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Ação negada pelo servidor.'));
    expect(client.getQueryData<{ maoObra: MaoObraBanco[] }>(diaQuery('usuario', rdo.data).queryKey)?.maoObra[0]?.quantidade).toBe(4);
    expect(input).toHaveValue(4);
  });
  it('cria somente função, categoria, quantidade e vínculo do RDO', async () => {
    mocks.result = { data: { ...row, id: 'nova', categoria: 'terceirizado', funcao: 'Eletricista', quantidade: 0 }, error: null };
    montar();
    fireEvent.click(screen.getAllByRole('button', { name: 'Adicionar função' })[2] as HTMLElement);
    const input = screen.getByRole('textbox', { name: 'Função Terceirizado' });
    fireEvent.change(input, { target: { value: 'Eletricista' } }); fireEvent.blur(input);
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith({ rdo_id: 'rdo', funcao: 'Eletricista', categoria: 'terceirizado', quantidade: 0 }));
  });
});