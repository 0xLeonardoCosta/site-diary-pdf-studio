import { somaDias } from './rules';

export type PontoEfetivo = { data: string; total: number };
export type ModoGrafico = 'dia' | 'semana' | 'mes';
export type Barra = { chave: string; rotulo: string; detalhe: string; valor: number | null; dias: number };

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
export const rotuloMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;
const media = (valores: number[]) => Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;
// Weeks run Monday to Sunday.
const segunda = (data: string) => somaDias(data, -((new Date(`${data}T12:00:00Z`).getUTCDay() + 6) % 7));

/**
 * Bars for the workforce chart. Days show the exact headcount, with an empty slot when the day has
 * no RDO. Weeks and months average only the days that have an RDO, so a missing report does not
 * read as a day with zero people.
 */
export function agruparEfetivo(pontos: PontoEfetivo[], modo: ModoGrafico, mes = ''): Barra[] {
  if (modo === 'dia') {
    if (!/^\d{4}-\d{2}$/.test(mes)) return [];
    const doMes = new Map(pontos.filter(p => p.data.startsWith(mes)).map(p => [p.data, p.total]));
    const barras: Barra[] = [];
    for (let d = `${mes}-01`; d.startsWith(mes); d = somaDias(d, 1)) {
      const valor = doMes.get(d) ?? null;
      barras.push({ chave: d, rotulo: d.slice(8, 10), detalhe: ddmm(d), valor, dias: valor === null ? 0 : 1 });
    }
    return barras;
  }
  const grupos = new Map<string, number[]>();
  for (const p of [...pontos].sort((a, b) => a.data.localeCompare(b.data))) {
    const chave = modo === 'semana' ? segunda(p.data) : p.data.slice(0, 7);
    grupos.set(chave, [...(grupos.get(chave) ?? []), p.total]);
  }
  return [...grupos].map(([chave, valores]) => ({
    chave,
    rotulo: modo === 'semana' ? `${ddmm(chave)} - ${ddmm(somaDias(chave, 6))}` : rotuloMes(chave),
    detalhe: modo === 'semana' ? `${ddmm(chave)} - ${ddmm(somaDias(chave, 6))}` : rotuloMes(chave),
    valor: media(valores),
    dias: valores.length,
  }));
}
