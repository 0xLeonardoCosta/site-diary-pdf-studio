import { CATEGORIAS, somaDias, type Categoria } from './rules';

export type PontoEfetivo = { data: string; total: number } & Record<Categoria, number>;
export type ModoGrafico = 'dia' | 'semana' | 'mes';
export type Barra = { chave: string; rotulo: string; detalhe: string; valor: number | null; dias: number } & Record<Categoria, number | null>;

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const rotuloMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
const media = (valores: number[]) => Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;
// Weeks run Monday to Sunday.
const segunda = (data: string) => somaDias(data, -((new Date(`${data}T12:00:00Z`).getUTCDay() + 6) % 7));
const porCategoria = (f: (c: Categoria) => number | null) => Object.fromEntries(CATEGORIAS.map(c => [c, f(c)])) as Record<Categoria, number | null>;

/**
 * Bars for the workforce chart, split by labor category. Days show the exact headcount, with an
 * empty slot when the day has no RDO. Weeks and months average only the days that have an RDO,
 * category by category, so a missing report does not read as a day with zero people.
 */
export function agruparEfetivo(pontos: PontoEfetivo[], modo: ModoGrafico, mes = ''): Barra[] {
  if (modo === 'dia') {
    if (!/^\d{4}-\d{2}$/.test(mes)) return [];
    const doMes = new Map(pontos.filter(p => p.data.startsWith(mes)).map(p => [p.data, p]));
    const barras: Barra[] = [];
    for (let d = `${mes}-01`; d.startsWith(mes); d = somaDias(d, 1)) {
      const p = doMes.get(d);
      barras.push({ chave: d, rotulo: d.slice(8, 10), detalhe: ddmm(d), valor: p?.total ?? null, dias: p ? 1 : 0, ...porCategoria(c => p?.[c] ?? null) });
    }
    return barras;
  }
  const grupos = new Map<string, PontoEfetivo[]>();
  for (const p of [...pontos].sort((a, b) => a.data.localeCompare(b.data))) {
    const chave = modo === 'semana' ? segunda(p.data) : p.data.slice(0, 7);
    grupos.set(chave, [...(grupos.get(chave) ?? []), p]);
  }
  return [...grupos].map(([chave, lista]) => ({
    chave,
    rotulo: modo === 'semana' ? `${ddmm(chave)} - ${ddmm(somaDias(chave, 6))}` : rotuloMes(chave),
    detalhe: modo === 'semana' ? `${ddmm(chave)} - ${ddmm(somaDias(chave, 6))}` : rotuloMes(chave),
    valor: media(lista.map(p => p.total)),
    dias: lista.length,
    ...porCategoria(c => media(lista.map(p => p[c]))),
  }));
}
