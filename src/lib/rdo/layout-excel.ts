// "Layout Excel": the contract's spreadsheet RDO, two A4 pages with fixed rows. Functions and
// equipment the spreadsheet lists always print, with 0 when absent; anything else the day recorded
// goes into the blank rows of its block, which grows only when those run out.
import { numeroParaTexto } from './rules';

export type LayoutPdf = 'atual' | 'excel';
export const LAYOUTS: { id: LayoutPdf; rotulo: string; descricao: string }[] = [
  { id: 'atual', rotulo: 'Layout Atual', descricao: 'Modelo RDO360 em uma página A4.' },
  { id: 'excel', rotulo: 'Layout Excel', descricao: 'Planilha do contrato em duas páginas A4.' },
];

export const CONSORCIO_FIXOS: [string[], string[], string[]] = [
  ['GERENTE DE CONTRATOS', 'GERENTE DE PRODUÇÃO', 'GERENTE COMERCIAL', 'ANALISTA DE ENGENHARIA SR II', 'ANALISTA DE ENGENHARIA', 'ASSISTENTE DE ENGENHARIA', 'ASSISTENTE ADMINISTRATIVO', 'TÉCNICO ADMINISTRATIVO', 'SUPERVISOR ADMINISTRATIVO', 'ENCARREGADO(A) DE DPTO PESSOAL', 'AGENTE SOCIAL', 'AUXILIAR ADMINISTRATIVO', 'ALMOXARIFE', 'CADISTA', 'TEC. SEGURANÇA DO TRABALHO', 'JOVEM APRENDIZ MANHÃ', 'ESTAGIÁRIO', 'JOVEM APRENDIZ TARDE', 'TEC. DE EDIFICAÇÕES', 'AUXILIAR DE LABORATORIO', 'APONTADOR'],
  ['MOTORISTA DE VEICULO LEVE', 'AUX. SERVIÇOS GERAIS', 'CONTROLADOR DE ACESSO'],
  ['MESTRE DE OBRA', 'ENCARREGADO DE OBRAS', 'CARPINTEIRO', 'OPERADOR DE BETONEIRA', 'SERVENTE DE OBRAS', 'MEIO-OFICIAL DE MARTELETE', 'ARMADOR', 'ELETRICISTA', 'ENCANADOR', 'PEDREIRO', 'TOPÓGRAFO', 'ASSISTENTE DE TOPOGRAFIA', 'AUXILIAR DE TOPOGRAFIA', 'GREIDISTA', 'OPERADOR DE ESCAVADEIRA', 'OP. DE RETROESCAVADEIRA', 'SOLDADOR', 'SINALEIRO', 'MEIO-OFICIAL DE ARMADOR', 'MARTELETEIRO'],
];
export const TERCEIRIZADOS_FIXOS = ['SUPERVISOR DE OBRAS', 'ENCARREGADO', 'CARPINTEIRO', 'SERVENTE', 'ARQUEÓLOGO(A)', 'PEDREIRO', 'OPERADOR DE CAMINHÃO MUNCK', 'OPERADOR DE ESCAVADEIRA', 'OP. TRATOR DE ESTEIRA', 'OP. MOTONIVELADORA', 'OP. DE ROLO', 'OP. DE RETROESCAVADEIRA', 'OPERADOR DE BATE-ESTACA', 'MOTORISTA DE CAÇAMBA', 'SOLDADOR', 'PINTOR', 'MEIO-OFICIAL DE PINTOR', 'ESTAGIÁRIO DE ENGENHARIA CIVIL', 'ELETRICISTA', 'AUX. DE ELETRICISTA', 'MEIO OFICIAL DE PEDREIRO', 'CALCETEIRO'];
export const EQUIPAMENTOS_FIXOS = ['TRATOR DE ESTEIRA', 'PÁ CARREGADEIRA', 'CAÇAMBA (TOCO)', 'ESCAVADEIRA', 'ROLO PÉ DE CARNEIRO', 'PATROL', 'RETRO-ESCAVADEIRA', 'MINI-CARREGADEIRA', 'CAÇAMBA (TRUCK)', 'MUNCK', 'EXTRUSORA DE MEIO-FIO E SARJETA', 'MINI ESCAVADEIRA', 'MINI-HÉLICE CONTÍNUA', 'HÉLICE CONTÍNUA', 'BATE-ESTACA', 'ESCAVADEIRA LONG REACH', 'ROLO LISO', 'DUMPER', 'GRUPO GERADOR DE ENERGIA 75KVA', 'GRUPO GERADOR DE ENERGIA 150KVA', 'GRUPO GERADOR DE ENERGIA 225KVA', 'GRUPO GERADOR DE ENERGIA 55KVA', 'SONDA À PERCUSSÃO'];
/** Rows of the fixed blocks in the spreadsheet: consórcio, terceirizados beside equipment, services. */
export const LINHAS_CONSORCIO = 21, LINHAS_TERCEIRIZADOS = 23, LINHAS_SERVICOS = 16;

// Spellings seen in the records for the same spreadsheet row.
const SINONIMOS: Record<string, string> = {
  gredista: 'greidista', arqueologa: 'arqueologoa', arqueologo: 'arqueologoa',
  meiooficialdemarteleteiro: 'meiooficialdemartelete', retroescavadeira: 'retroescavadeira',
};
export const chaveNome = (nome: string) => {
  const k = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return SINONIMOS[k] ?? k;
};

export type CelulaExcel = { nome: string; qtd: number | null };
const VAZIA: CelulaExcel = { nome: '', qtd: null };
type Linha = { nome: string; quantidade: number };

/** Sums the records by spreadsheet name; whatever no fixed row takes is returned in record order. */
function encaixar(fixos: string[][], linhas: Linha[]) {
  const soma = new Map<string, Linha>();
  for (const l of linhas) {
    const k = chaveNome(l.nome), atual = soma.get(k);
    soma.set(k, { nome: atual?.nome ?? l.nome.trim(), quantidade: (atual?.quantidade ?? 0) + l.quantidade });
  }
  const colunas = fixos.map(c => c.map(nome => {
    const k = chaveNome(nome), achado = soma.get(k);
    soma.delete(k);
    return { nome, qtd: achado?.quantidade ?? 0 };
  }));
  return { colunas, extras: [...soma.values()].map(l => ({ nome: l.nome, qtd: l.quantidade })) };
}
const completar = (c: CelulaExcel[], n: number) => [...c, ...Array.from({ length: Math.max(0, n - c.length) }, () => VAZIA)];

export type EfetivoExcel = {
  consorcio: [CelulaExcel[], CelulaExcel[], CelulaExcel[]];
  terceirizados: [CelulaExcel[], CelulaExcel[]];
  equipamentos: CelulaExcel[];
  totalConsorcio: number; totalTerceirizado: number; totalGeral: number; totalEquipamentos: number;
};
export function montarEfetivoExcel(maoObra: { funcao: string; categoria: string; quantidade: number }[], equipamentos: { descricao: string; quantidade: number }[]): EfetivoExcel {
  const doConsorcio = maoObra.filter(m => m.categoria !== 'terceirizado').map(m => ({ nome: m.funcao, quantidade: m.quantidade }));
  const terceiros = maoObra.filter(m => m.categoria === 'terceirizado').map(m => ({ nome: m.funcao, quantidade: m.quantidade }));
  const c = encaixar(CONSORCIO_FIXOS, doConsorcio);
  const [c1 = [], c2 = [], c3 = []] = c.colunas;
  // Extra functions fill the blank rows of the middle column, then the last one.
  let n = LINHAS_CONSORCIO;
  while ((n - c2.length) + (n - c3.length) < c.extras.length) n++;
  const meio = n - c2.length;
  const t = encaixar([TERCEIRIZADOS_FIXOS], terceiros);
  const e = encaixar([EQUIPAMENTOS_FIXOS], equipamentos.map(x => ({ nome: x.descricao, quantidade: x.quantidade })));
  const equip = [...(e.colunas[0] ?? []), ...e.extras];
  const m = Math.max(LINHAS_TERCEIRIZADOS, TERCEIRIZADOS_FIXOS.length, t.extras.length, equip.length);
  const soma = (l: { quantidade: number }[]) => l.reduce((s, x) => s + x.quantidade, 0);
  const totalConsorcio = soma(doConsorcio), totalTerceirizado = soma(terceiros);
  return {
    consorcio: [completar(c1, n), completar([...c2, ...c.extras.slice(0, meio)], n), completar([...c3, ...c.extras.slice(meio)], n)],
    terceirizados: [completar(t.colunas[0] ?? [], m), completar(t.extras, m)],
    equipamentos: completar(equip, m),
    totalConsorcio, totalTerceirizado, totalGeral: totalConsorcio + totalTerceirizado,
    totalEquipamentos: soma(equipamentos.map(x => ({ quantidade: x.quantidade }))),
  };
}

// The spreadsheet's weather legend; the app records four of its six states.
export const LEGENDA_CLIMA = [[1, 'CHUVA FORTE', 4, 'NUBLADO'], [2, 'CHUVA LEVE', 5, 'SOL'], [3, 'GAROA / CHUVISCO', 6, 'TEMPO BOM']] as const;
const CODIGO_CLIMA: Record<string, number> = { 'Chuva forte': 1, 'Chuva fraca': 2, Nublado: 4, Bom: 6 };
export const codigoClima = (clima: string | null) => (clima ? CODIGO_CLIMA[clima] ?? 0 : 0);
export const textoExcel = (n: number | null) => (n === null ? '-' : numeroParaTexto(n));

/** Services as the spreadsheet writes them, "service - front", down the left column then the right. */
export function colunasServicos(atividades: { frente_id: string; descricao: string }[], nomeFrente: (id: string) => string): [string[], string[]] {
  const textos = atividades.map(a => `${a.descricao.trim()} - ${nomeFrente(a.frente_id)}`);
  const linhas = Math.max(LINHAS_SERVICOS, Math.ceil(textos.length / 2));
  const preencher = (l: string[]) => [...l, ...Array<string>(linhas - l.length).fill('')];
  return [preencher(textos.slice(0, linhas)), preencher(textos.slice(linhas))];
}
