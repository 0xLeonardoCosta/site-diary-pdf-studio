import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { PrintView, type DocumentoRdo } from '@/components/rdo/print-view';
import type { AnotacaoBanco, AtividadeBanco, FotoBanco, MaoObraBanco, RdoBanco } from '@/lib/rdo/queries';

const rdo = { id: 'rdo', data: '2026-10-29', numero: 1004, status: 'aberto', clima_manha: 'Nublado', clima_tarde: null, clima_noite: 'Bom', fotos_no_pdf: true, horario_trabalho: '07:00 às 17:00', pluv_07h: 1.5, pluv_12h: null, pluv_17h: null, mare_max_hora: null, mare_max_nivel: null, assinante_obra: null, assinante_fiscalizacao: null } as RdoBanco;
const frentes = [{ id: 'canteiro', nome: 'Canteiro', ordem: 1, ativa: true }, { id: 'murutucu', nome: 'Murutucu', ordem: 4, ativa: true }];
const atividade = (id: string, frente_id: string, descricao: string) => ({ id, frente_id, descricao }) as AtividadeBanco;
const anotacao = (tipo: string, texto: string) => ({ id: texto, tipo, texto }) as AnotacaoBanco;
const linha = (id: string, funcao: string, categoria: string, quantidade: number) => ({ id, funcao, categoria, quantidade }) as MaoObraBanco;
function montar(extra: Partial<DocumentoRdo> = {}) {
  const doc: DocumentoRdo = { rdo, obra: { nome: 'Ponte Sul' } as DocumentoRdo['obra'], frentes, urls: {}, maoObra: [], equipamentos: [], atividades: [], anotacoes: [], fotos: [], ...extra };
  const { container } = render(<PrintView doc={doc} />);
  const pdf = container.querySelector('.print-only') as HTMLElement;
  return { pdf, titulos: Array.from(pdf.querySelectorAll('.font-display.text-sm')).map(t => t.textContent) };
}
afterEach(cleanup);

describe('PDF do RDO360', () => {
  it('usa a marca, a lua na noite anterior e a ordem das frentes', () => {
    const { pdf } = montar({ atividades: [atividade('1', 'murutucu', 'Forma'), atividade('2', 'canteiro', 'Limpeza')] });
    expect(pdf.textContent).toContain('RDO360 – Diário de obra:');
    expect(pdf.textContent).toContain('Ponte Sul');
    expect(pdf.textContent).toContain('🌙 Bom');
    expect(pdf.textContent).toContain('1,5 mm');
    const locais = Array.from(pdf.querySelectorAll('tbody td.font-semibold')).map(td => td.textContent).filter(t => t === 'Canteiro' || t === 'Murutucu');
    expect(locais).toEqual(['Canteiro', 'Murutucu']);
  });
  it('não inventa clima que ninguém lançou', () => {
    const { pdf } = montar();
    expect(pdf.textContent).not.toContain('☀️');
  });
  it('omite ocorrências vazias e mantém as preenchidas', () => {
    const { pdf } = montar({ anotacoes: [anotacao('seguranca', 'DDS realizado'), anotacao('ocorrencia', '   ')] });
    expect(pdf.textContent).not.toContain('Ocorrências / observações gerais');
    expect(pdf.textContent).toContain('DDS realizado');
  });
  it('fotos desmarcadas somem e assinaturas viram o item 7', () => {
    const fotos = [{ id: 'f', storage_path: 'rdo/f.jpg', legenda: 'Vista' }] as FotoBanco[];
    const sem = montar({ rdo: { ...rdo, fotos_no_pdf: false }, fotos });
    expect(sem.titulos).toContain('7. Assinaturas');
    expect(sem.titulos.some(t => t?.includes('Registro fotográfico'))).toBe(false);
    cleanup();
    const com = montar({ fotos, urls: { 'rdo/f.jpg': 'https://exemplo/f.jpg' } });
    expect(com.titulos).toEqual(expect.arrayContaining(['7. Registro fotográfico', '8. Assinaturas']));
    expect(com.pdf.querySelector('img')?.getAttribute('src')).toBe('https://exemplo/f.jpg');
  });
  it('resume o efetivo na ordem indireto, direto, terceirizado', () => {
    const { titulos } = montar({ maoObra: [linha('a', 'Pedreiro', 'direto', 6), linha('b', 'Engenheiro', 'indireto', 1), linha('c', 'Eletricista', 'terceirizado', 2)] });
    expect(titulos).toContain('3. Mão de obra · Indireto 1 · Direto 6 · Terceirizado 2 · Efetivo total 9');
  });
});
