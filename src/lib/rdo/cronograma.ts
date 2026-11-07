import { normalizarFuncao, somaDias } from './rules';

export type DiaCronograma = { data: string; temRdo: boolean; comServico: boolean };
export type LinhaCronograma = { chave: string; descricao: string; frente: string; dias: Set<string>; inicio: string; fim: string };
export type GrupoCronograma = { frente: { id: string; nome: string; ordem: number }; linhas: LinhaCronograma[] };
export type Cronograma = { dias: DiaCronograma[]; grupos: GrupoCronograma[]; totalLinhas: number };
export type FiltroCronograma = { periodo: string; frente: string; busca: string };

const texto = (s: string) => normalizarFuncao(s).replace(/\s+/g, ' ');

/**
 * Turns the activities written in each RDO into a schedule: one line per activity and work front,
 * marked on every day it was reported. Same text with different case, accents or spacing is the
 * same activity. The period is a month (YYYY-MM) or '' for everything.
 */
export function montarCronograma(
  rdos: { id: string; data: string }[],
  atividades: { rdo_id: string; frente_id: string; descricao: string }[],
  frentes: { id: string; nome: string; ordem: number }[],
  { periodo, frente, busca }: FiltroCronograma,
): Cronograma {
  const noPeriodo = (data: string) => !periodo || data.startsWith(periodo);
  const dataDo = new Map(rdos.filter(r => noPeriodo(r.data)).map(r => [r.id, r.data]));
  const datas = [...dataDo.values()].sort();
  const primeira = datas[0], ultima = datas[datas.length - 1];
  const comServico = new Set<string>();
  const linhas = new Map<string, LinhaCronograma>();
  const procura = texto(busca);
  for (const a of atividades) {
    const data = dataDo.get(a.rdo_id);
    if (!data) continue;
    comServico.add(data);
    if ((frente && a.frente_id !== frente) || (procura && !texto(a.descricao).includes(procura))) continue;
    const chave = `${a.frente_id}|${texto(a.descricao)}`;
    const linha = linhas.get(chave) ?? { chave, descricao: a.descricao, frente: a.frente_id, dias: new Set<string>(), inicio: data, fim: data };
    linha.dias.add(data);
    if (data < linha.inicio) linha.inicio = data;
    // The latest wording is the one shown.
    if (data >= linha.fim) { linha.fim = data; linha.descricao = a.descricao; }
    linhas.set(chave, linha);
  }
  // Every calendar day of the span, so days without an RDO show as gaps instead of disappearing.
  const dias: DiaCronograma[] = [];
  const comRdo = new Set(datas);
  if (primeira && ultima) {
    const inicio = periodo ? `${periodo}-01` : primeira;
    const fim = periodo ? somaDias(somaDias(`${periodo}-01`, 32).slice(0, 7) + '-01', -1) : ultima;
    for (let d = inicio; d <= fim; d = somaDias(d, 1)) dias.push({ data: d, temRdo: comRdo.has(d), comServico: comServico.has(d) });
  }
  const grupos = [...frentes].sort((a, b) => a.ordem - b.ordem)
    .map(f => ({ frente: f, linhas: [...linhas.values()].filter(l => l.frente === f.id).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.descricao.localeCompare(b.descricao)) }))
    .filter(g => g.linhas.length > 0);
  return { dias, grupos, totalLinhas: grupos.reduce((n, g) => n + g.linhas.length, 0) };
}
