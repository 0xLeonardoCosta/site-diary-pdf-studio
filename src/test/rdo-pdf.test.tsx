import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/components/auth-context', () => ({ usePermissao: () => true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { DiaryForm } from '@/components/rdo/diary-form';
import { chaveLocal } from '@/lib/rdo/rules';
import type { MaoObraBanco } from '@/lib/rdo/queries';

const data = '2026-10-29';
const linha = (id: string, funcao: string, categoria: string, quantidade: number): MaoObraBanco => ({ id, rdo_id: 'rdo', funcao, categoria, quantidade, copiado: false, copiado_por: null, created_by: 'autor', created_at: data, updated_by: null, updated_at: null });
function montar(rascunho: object, maoObra: MaoObraBanco[] = []) {
  localStorage.setItem(chaveLocal(data), JSON.stringify(rascunho));
  const { container } = render(<QueryClientProvider client={new QueryClient()}><DiaryForm date={data} rdo={null} maoObra={maoObra} userId="usuario" numero={7} /></QueryClientProvider>);
  const pdf = container.querySelector('.print-only') as HTMLElement;
  return { pdf, titulos: () => Array.from(pdf.querySelectorAll('.font-display.text-sm')).map(t => t.textContent) };
}
afterEach(() => { cleanup(); localStorage.clear(); });

describe('PDF do RDO360', () => {
  it('usa a marca, a noite anterior com lua e a ordem dos locais', () => {
    const { pdf } = montar({ obra: 'Ponte Sul', clima: { Noite: 'Bom' }, atividades: [{ id: '1', a: 'Forma', local: 'Murutucu' }, { id: '2', a: 'Limpeza', local: 'Canteiro', b: '50' }] });
    expect(screen.getByText('RDO360 – Diário de obra: Ponte Sul')).toBeInTheDocument();
    expect(pdf.textContent).toContain('Noite anterior🌙 Bom');
    expect(pdf.textContent).not.toContain('%');
    const locais = Array.from(pdf.querySelectorAll('tbody td.font-semibold')).map(td => td.textContent).filter(t => t === 'Canteiro' || t === 'Murutucu');
    expect(locais).toEqual(['Canteiro', 'Murutucu']);
  });
  it('omite ocorrências vazias e fotos desmarcadas, renumerando assinaturas', () => {
    const { pdf, titulos } = montar({ seguranca: 'DDS realizado', fotos: [{ id: 'f', src: 'data:image/png;base64,', legenda: 'Vista' }], fotosNoPdf: false });
    expect(pdf.textContent).not.toContain('Ocorrências / observações gerais');
    expect(pdf.textContent).toContain('DDS realizado');
    expect(titulos()).toContain('7. Assinaturas');
    expect(titulos().some(t => t?.includes('Registro fotográfico'))).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Incluir no PDF' }));
    expect(titulos()).toEqual(expect.arrayContaining(['7. Registro fotográfico', '8. Assinaturas']));
  });
  it('resume o efetivo por categoria na ordem indireto, direto, terceirizado', () => {
    const { titulos } = montar({}, [linha('a', 'Pedreiro', 'direto', 6), linha('b', 'Engenheiro', 'indireto', 1), linha('c', 'Eletricista', 'terceirizado', 2)]);
    expect(titulos()).toContain('3. Mão de obra · Indireto 1 · Direto 6 · Terceirizado 2 · Efetivo total 9');
  });
});
