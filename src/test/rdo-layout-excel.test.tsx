import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { PrintExcel } from '@/components/rdo/print-excel';
import type { DocumentoRdo } from '@/components/rdo/print-view';
import { CONSORCIO_FIXOS, EQUIPAMENTOS_FIXOS, LINHAS_CONSORCIO, LINHAS_SERVICOS, LINHAS_TERCEIRIZADOS, TERCEIRIZADOS_FIXOS, codigoClima, colunasServicos, montarEfetivoExcel } from '@/lib/rdo/layout-excel';
import type { AnotacaoBanco, AtividadeBanco, EquipamentoBanco, MaoObraBanco, RdoBanco } from '@/lib/rdo/queries';

const mo = (funcao: string, categoria: string, quantidade: number) => ({ id: funcao + categoria, funcao, categoria, quantidade }) as MaoObraBanco;
const eq = (descricao: string, quantidade: number) => ({ id: descricao, descricao, quantidade }) as EquipamentoBanco;

describe('Efetivo no Layout Excel', () => {
  it('mantém as linhas fixas da planilha com zero quando não há registro', () => {
    const e = montarEfetivoExcel([], []);
    expect(e.consorcio.map(c => c.length)).toEqual([LINHAS_CONSORCIO, LINHAS_CONSORCIO, LINHAS_CONSORCIO]);
    expect(e.consorcio[0].map(c => c.nome)).toEqual(CONSORCIO_FIXOS[0]);
    expect(e.consorcio[0].every(c => c.qtd === 0)).toBe(true);
    expect(e.consorcio[1][3]).toEqual({ nome: '', qtd: null });
    expect(e.terceirizados[0].slice(0, TERCEIRIZADOS_FIXOS.length).map(c => c.nome)).toEqual(TERCEIRIZADOS_FIXOS);
    expect(e.equipamentos.map(c => c.nome)).toEqual(EQUIPAMENTOS_FIXOS);
    expect(e.terceirizados[0]).toHaveLength(LINHAS_TERCEIRIZADOS);
    expect([e.totalConsorcio, e.totalTerceirizado, e.totalGeral, e.totalEquipamentos]).toEqual([0, 0, 0, 0]);
  });
  it('casa grafias diferentes, soma repetidos e separa consórcio de terceirizados', () => {
    const e = montarEfetivoExcel([
      mo('Tec de Edificações', 'indireto', 1), mo('TECNICO ADMINISTRATIVO', 'indireto', 2), mo('GREDISTA', 'direto', 1), mo('GREIDISTA', 'direto', 2),
      mo('ENCARREGADO DE OBRAS', 'indireto', 3), mo('ARQUEÓLOGA', 'terceirizado', 1), mo('CARPINTEIRO', 'terceirizado', 4), mo('CARPINTEIRO', 'direto', 5),
    ], [eq('Retro-escavadeira', 2), eq('CAÇAMBA (TRUCK)', 3)]);
    const qtd = (col: { nome: string; qtd: number | null }[], nome: string) => col.find(c => c.nome === nome)?.qtd;
    expect(qtd(e.consorcio[0], 'TEC. DE EDIFICAÇÕES')).toBe(1);
    expect(qtd(e.consorcio[0], 'TÉCNICO ADMINISTRATIVO')).toBe(2);
    expect(qtd(e.consorcio[2], 'GREIDISTA')).toBe(3);
    expect(qtd(e.consorcio[2], 'ENCARREGADO DE OBRAS')).toBe(3);
    expect(qtd(e.consorcio[2], 'CARPINTEIRO')).toBe(5);
    expect(qtd(e.terceirizados[0], 'ARQUEÓLOGO(A)')).toBe(1);
    expect(qtd(e.terceirizados[0], 'CARPINTEIRO')).toBe(4);
    expect(qtd(e.equipamentos, 'RETRO-ESCAVADEIRA')).toBe(2);
    expect([e.totalConsorcio, e.totalTerceirizado, e.totalGeral, e.totalEquipamentos]).toEqual([14, 5, 19, 5]);
  });
  it('põe funções e equipamentos fora da planilha nas linhas em branco', () => {
    const e = montarEfetivoExcel([mo('ADMINISTRADOR', 'indireto', 1), mo('NIVELADOR', 'direto', 2), mo('PROJETISTA', 'terceirizado', 3)], [eq('PERFURATRIZ', 1)]);
    expect(e.consorcio[1].slice(3, 5)).toEqual([{ nome: 'ADMINISTRADOR', qtd: 1 }, { nome: 'NIVELADOR', qtd: 2 }]);
    expect(e.terceirizados[1][0]).toEqual({ nome: 'PROJETISTA', qtd: 3 });
    expect(e.equipamentos).toHaveLength(LINHAS_TERCEIRIZADOS + 1);
    expect(e.equipamentos[EQUIPAMENTOS_FIXOS.length]).toEqual({ nome: 'PERFURATRIZ', qtd: 1 });
    expect(e.terceirizados[0]).toHaveLength(LINHAS_TERCEIRIZADOS + 1);
  });
  it('acrescenta linhas ao bloco do consórcio só quando as em branco acabam', () => {
    const extras = Array.from({ length: 25 }, (_, i) => mo(`FUNÇÃO ${i}`, 'indireto', 1));
    const e = montarEfetivoExcel(extras, []);
    expect(e.consorcio[0]).toHaveLength(LINHAS_CONSORCIO + 3);
    expect(e.consorcio.flat().filter(c => c.nome.startsWith('FUNÇÃO'))).toHaveLength(25);
  });
});

describe('Clima e serviços no Layout Excel', () => {
  it('usa os códigos da legenda da planilha', () => {
    expect(['Chuva forte', 'Chuva fraca', 'Nublado', 'Bom', null].map(codigoClima)).toEqual([1, 2, 4, 6, 0]);
  });
  it('escreve "serviço - frente" descendo a coluna da esquerda, com 16 linhas no mínimo', () => {
    const nome = (id: string) => (id === 'c' ? 'Canteiro' : 'Murutucu');
    const [esq, dir] = colunasServicos([{ frente_id: 'c', descricao: 'Botafora ' }, { frente_id: 'm', descricao: 'Escavação' }], nome);
    expect(esq).toHaveLength(LINHAS_SERVICOS);
    expect(esq.slice(0, 2)).toEqual(['Botafora - Canteiro', 'Escavação - Murutucu']);
    expect(dir.every(s => s === '')).toBe(true);
    const muitos = colunasServicos(Array.from({ length: 40 }, (_, i) => ({ frente_id: 'c', descricao: `S${i}` })), nome);
    expect(muitos[0]).toHaveLength(20);
    expect(muitos[1][19]).toBe('S39 - Canteiro');
  });
});

describe('Documento no Layout Excel', () => {
  afterEach(cleanup);
  const rdo = { id: 'r', data: '2026-11-19', numero: 1025, clima_manha: 'Nublado', clima_tarde: null, clima_noite: 'Bom', fotos_no_pdf: true, horario_trabalho: '7:00 as 17:00 hrs', pluv_07h: 1.5, pluv_12h: null, pluv_17h: null, mare_max_hora: '10:30:00', mare_max_nivel: 2.85, assinante_obra: 'Fulano', assinante_fiscalizacao: null } as RdoBanco;
  const obra = { nome: 'Canal', cliente: 'Governo do Estado do Pará', fiscalizacao: 'SEOP', endereco: 'Passagem', gerenciadora: 'Infra', responsavel_tecnico: 'Consórcio', contrato: '059/2023', data_inicio: '2024-01-30', prazo_previsto: '2026-09-30' } as DocumentoRdo['obra'];
  function montar(extra: Partial<DocumentoRdo> = {}) {
    const doc: DocumentoRdo = { rdo, obra, frentes: [{ id: 'c', nome: 'Canteiro', ordem: 1, ativa: true }] as DocumentoRdo['frentes'], logoUrl: null, assinaturaUrl: null, maoObra: [], equipamentos: [], atividades: [], anotacoes: [], fotos: [], ...extra };
    return render(<PrintExcel doc={doc} />).container.querySelector('.print-only') as HTMLElement;
  }
  it('preenche as duas folhas com os dados do RDO', () => {
    const pdf = montar({
      maoObra: [mo('APONTADOR', 'indireto', 2), mo('SERVENTE', 'terceirizado', 5)], equipamentos: [eq('ESCAVADEIRA', 2)],
      atividades: [{ id: 'a', frente_id: 'c', descricao: 'Botafora' } as AtividadeBanco],
      anotacoes: [{ id: 'o', tipo: 'ocorrencia', texto: 'Chuva atrasou a concretagem.' } as AnotacaoBanco],
    });
    const [f1, f2] = Array.from(pdf.querySelectorAll('.folha-excel'));
    expect(f1?.textContent).toContain('quinta-feira');
    expect(f1?.textContent).toContain('19/11/2026');
    expect(f1?.textContent).toContain('059/2023');
    expect(f1?.querySelectorAll('[data-efetivo]')).toHaveLength(LINHAS_CONSORCIO);
    expect(f1?.querySelectorAll('[data-terceirizado]')).toHaveLength(LINHAS_TERCEIRIZADOS);
    expect(f1?.textContent).toContain('10:30 – 2,85 m');
    const linhas = Array.from(f1?.querySelectorAll('tr') ?? []).map(tr => tr.textContent);
    expect(linhas.find(l => l?.startsWith('MANHÃ'))).toMatch(/^MANHÃ4/);
    expect(linhas.find(l => l?.startsWith('TARDE'))).toMatch(/^TARDE0/);
    expect(linhas.find(l => l?.startsWith('TOTAL CONSÓRCIO'))).toBe('TOTAL CONSÓRCIO2');
    expect(linhas.find(l => l?.startsWith('TOTAL TERCEIRIZADO'))).toBe('TOTAL TERCEIRIZADO5TOTAL EQUIPAMENTOS2');
    expect(linhas.find(l => l?.startsWith('TOTAL GERAL'))).toBe('TOTAL GERAL7');
    expect(f2?.querySelectorAll('[data-servico]')).toHaveLength(LINHAS_SERVICOS);
    expect(f2?.textContent).toContain('Botafora - Canteiro');
    expect(f2?.textContent).toContain('Chuva atrasou a concretagem.');
    expect(f2?.textContent).toContain('Fulano');
  });
  it('não leva fotos para o PDF', () => {
    const pdf = montar({ fotos: [{ id: 'f', storage_path: 'p', legenda: 'Frente' }] as DocumentoRdo['fotos'] });
    expect(pdf.children).toHaveLength(2);
    expect(pdf.textContent).not.toContain('Registro fotográfico');
  });
});
