import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'is', 'update']) chain[method] = (...args: unknown[]) => { calls.push({ method, args }); return chain; };
  chain['maybeSingle'] = () => Promise.resolve({ data: { id: true }, error: null });
  return { calls, chain, erro: vi.fn(), upload: vi.fn() };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => mock.chain, storage: { from: () => ({ upload: mock.upload, remove: vi.fn(), createSignedUrl: vi.fn() }) } } }));
vi.mock('sonner', () => ({ toast: { error: mock.erro, success: vi.fn() } }));
import { DadosObra, LIMITE_LOGO_MB } from '@/components/rdo/dados-obra';
import type { ObraBanco } from '@/lib/rdo/queries';

const obra = { id: true, nome: 'Obra Murutucu', cliente: 'Governo', fiscalizacao: null, endereco: 'Passagem', gerenciadora: null, responsavel_tecnico: 'Consórcio', contrato: '059/2023', data_inicio: '2024-01-30', prazo_previsto: '2026-09-30', logo_path: null } as ObraBanco;
const montar = (editavel = true) => render(<QueryClientProvider client={new QueryClient()}><DadosObra obra={obra} userId="u" editavel={editavel} /></QueryClientProvider>);
beforeEach(() => { mock.calls.length = 0; mock.erro.mockClear(); mock.upload.mockClear(); });
afterEach(cleanup);

describe('Aba Dados', () => {
  it('mostra os campos na ordem pedida', () => {
    const { container } = montar();
    const rotulos = Array.from(container.querySelectorAll('section span.uppercase')).map(s => s.textContent);
    expect(rotulos).toEqual(['Obra', 'Cliente', 'Fiscalização', 'Local', 'Gerenciadora', 'Contratada', 'Logo da empresa contratada', 'Contrato nº', 'Início contratual', 'Término contratual']);
  });
  it('oferece a obra para seleção', () => {
    montar();
    expect(screen.getByRole('combobox', { name: 'Obra selecionada' })).toHaveDisplayValue('Obra Murutucu');
  });
  it('salva o campo novo a partir do valor visto', async () => {
    montar();
    const campo = screen.getByRole('textbox', { name: 'Fiscalização' });
    fireEvent.change(campo, { target: { value: 'SEOP/PA' } });
    await act(async () => { fireEvent.blur(campo); });
    expect(mock.calls.find(c => c.method === 'update')?.args).toEqual([{ fiscalizacao: 'SEOP/PA' }]);
    expect(mock.calls.find(c => c.method === 'is')?.args).toEqual(['fiscalizacao', null]);
  });
  it('recusa logo acima do limite sem enviar', async () => {
    montar();
    const grande = new File([new Uint8Array(1)], 'logo.png', { type: 'image/png' });
    Object.defineProperty(grande, 'size', { value: LIMITE_LOGO_MB * 1024 * 1024 + 1 });
    await act(async () => { fireEvent.change(screen.getByLabelText('Escolher logo'), { target: { files: [grande] } }); });
    expect(mock.erro).toHaveBeenCalledWith(`A logo deve ter no máximo ${LIMITE_LOGO_MB} MB.`);
    expect(mock.upload).not.toHaveBeenCalled();
  });
  it('sem permissão os campos ficam bloqueados', () => {
    montar(false);
    expect(screen.getByRole('textbox', { name: 'Fiscalização' })).toBeDisabled();
    expect(screen.getByLabelText('Escolher logo')).toBeDisabled();
  });
});
