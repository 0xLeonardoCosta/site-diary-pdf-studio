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
  const doc: DocumentoRdo = { rdo, obra: { nome: 'Ponte Sul' } as DocumentoRdo['obra'], frentes, urls: {}, logoUrl: null, assinaturaUrl: null, maoObra: [], equipamentos: [], atividades: [], anotacoes: [], fotos: [], ...extra };
  const { container } = render(<PrintView doc={doc} />);
  const pdf = container.querySelector('.print-only') as HTMLElement;
  return { pdf, titulos: Array.from(pdf.querySelectorAll('.font-display.text-sm')).map(t => t.textContent) };
}
afterEach(cleanup);

describe('Cabeçalho e dados da obra', () => {
  const obra = { nome: 'SANEAMENTO E URBANIZAÇÃO DA BACIA DO CANAL DE MÁRTIR, URBANIZAÇÃO, ACESSO VIÁRIO, ALARGAMENTO E RETIFICAÇÃO DO CANAL DO MURUTUCU', cliente: 'Governo', fiscalizacao: 'SEOP', endereco: 'Passagem', gerenciadora: 'Infra', responsavel_tecnico: 'Consórcio', contrato: '059/2023', data_inicio: '2024-01-30', prazo_previsto: '2026-09-30' } as DocumentoRdo['obra'];
  it('lista os campos na ordem pedida, sem repetir obra e logo', () => {
    const { pdf } = montar({ obra });
    const rotulos = Array.from(pdf.querySelectorAll('table')[0]?.querySelectorAll('td.bg-muted') ?? []).map(td => td.textContent);
    expect(rotulos).toEqual(['Cliente', 'Fiscalização', 'Local', 'Gerenciadora', 'Contratada', 'Contrato nº', 'Início contratual', 'Término contratual']);
    expect(pdf.querySelectorAll('table')[0]?.textContent).not.toContain('SANEAMENTO');
    expect(pdf.textContent).toContain('30/01/2024');
    expect(pdf.textContent).toContain('30/09/2026');
  });
  it('reduz a fonte de nomes longos e mantém a de nomes curtos', () => {
    const titulo = (pdf: HTMLElement) => pdf.querySelector('.uppercase.font-display.font-bold') as HTMLElement;
    expect(titulo(montar({ obra }).pdf).className).toContain('text-[13px]');
    cleanup();
    expect(titulo(montar({ obra: { ...obra, nome: 'Ponte Sul' } }).pdf).className).toContain('text-2xl');
  });
  it('mostra a logo só quando existe', () => {
    expect(montar({ obra }).pdf.querySelector('img')).toBeNull();
    cleanup();
    expect(montar({ obra, logoUrl: 'https://exemplo/logo.png' }).pdf.querySelector('img')?.getAttribute('src')).toBe('https://exemplo/logo.png');
  });
});

describe('Assinaturas no PDF', () => {
  it('usa Contratada e Gerenciadora nos campos', () => {
    const { pdf } = montar();
    expect(pdf.textContent).toContain('Contratada');
    expect(pdf.textContent).toContain('Gerenciadora');
    expect(pdf.textContent).not.toContain('Responsável pela obra');
    expect(pdf.textContent).not.toContain('Fiscalização / Cliente');
    expect(pdf.querySelector('img')).toBeNull();
  });
  it('coloca a imagem sobre a linha da contratada, sem texto de assinatura digital', () => {
    const { pdf } = montar({ assinaturaUrl: 'https://exemplo/a.png', rdo: { ...rdo, assinado_nome: 'Gerente', assinado_em: '2026-11-02T10:00:00Z' } });
    const img = pdf.querySelector('img.mix-blend-multiply') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://exemplo/a.png');
    expect(img.style.transform).toContain('rotate');
    expect(img.nextElementSibling?.nextElementSibling?.textContent).toBe('Contratada');
    expect(pdf.textContent).not.toMatch(/assinado (digitalmente|por)/i);
  });
});

describe('Atividades e observações no PDF', () => {
  it('na tela, sem medir, não mostra continuação', () => {
    const muitas = Array.from({ length: 30 }, (_, i) => atividade(String(i), 'murutucu', `Serviço ${i}`));
    const { pdf } = montar({ atividades: muitas });
    expect(pdf.textContent).not.toMatch(/Continuação|cont\./i);
    expect(pdf.querySelectorAll('[data-servicos] [data-entrada]')).toHaveLength(31);
  });
  it('agrupa os serviços por frente, na ordem das frentes, sem caixas vazias', () => {
    const { pdf } = montar({ atividades: [atividade('3', 'murutucu', 'Dragagem'), atividade('1', 'canteiro', 'Forma'), atividade('2', 'canteiro', 'Armação')] });
    const lista = pdf.querySelector('[data-servicos]') as HTMLElement;
    const linhas = Array.from(lista.querySelectorAll('.bg-muted, .border-dotted')).map(e => e.textContent);
    expect(linhas).toEqual(['Canteiro2', '•Forma', '•Armação', 'Murutucu1', '•Dragagem']);
    expect(lista.querySelector('table')).toBeNull();
  });
  it('observações no item 6, sem o subtítulo das gerais', () => {
    const { pdf, titulos } = montar({ anotacoes: [anotacao('ocorrencia', 'Visita da fiscalização'), anotacao('seguranca', 'DDS realizado')] });
    expect(titulos).toContain('6. Ocorrências e observações');
    expect(pdf.textContent).not.toContain('Ocorrências / observações gerais');
    expect(pdf.textContent).toContain('Visita da fiscalização');
    expect(pdf.textContent).toContain('Segurança do trabalho');
  });
  it('sem observações, o item 6 diz que não houve', () => {
    const { pdf, titulos } = montar();
    expect(titulos).toContain('6. Ocorrências e observações');
    expect(pdf.textContent).toContain('Sem ocorrências ou observações.');
  });
});

describe('PDF do RDO360', () => {
  it('usa a marca, a lua na noite anterior e a ordem das frentes', () => {
    const { pdf } = montar({ atividades: [atividade('1', 'murutucu', 'Forma'), atividade('2', 'canteiro', 'Limpeza')] });
    expect(pdf.textContent).toContain('RDO360 – Diário de obra:');
    expect(pdf.textContent).toContain('Ponte Sul');
    expect(pdf.textContent).toContain('🌙 Bom');
    expect(pdf.textContent).toContain('Precipitação (mm)');
    expect(pdf.textContent).not.toContain('Pluvi');
    expect(pdf.textContent).toContain('1,5');
    const frentes = Array.from(pdf.querySelectorAll('[data-servicos] .bg-muted span:first-child')).map(e => e.textContent);
    expect(frentes).toEqual(['Canteiro', 'Murutucu']);
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
    expect(titulos).toContain('3. Mão de obra · Efetivo total 9');
  });
});
