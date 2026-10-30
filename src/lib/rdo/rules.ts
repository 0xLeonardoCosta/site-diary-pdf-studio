const MS = 86400000;
const utc = (iso: string) => { const [y,m,d] = iso.split("-").map(Number) as [number, number, number]; return Date.UTC(y, m-1, d); };
const iso = (ms: number) => new Date(ms).toISOString().slice(0,10);
export const numeroParaData = (n: number, refN: number, refD: string) => iso(utc(refD) + (n - refN) * MS);
export const dataParaNumero = (d: string, refN: number, refD: string) => refN + Math.round((utc(d) - utc(refD)) / MS);
export const hojeLocal = () => { const d = new Date(); const p = (x:number)=>String(x).padStart(2,"0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; };
export const somaDias = (d: string, n: number) => iso(utc(d) + n * MS);
export function dataValida(d: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, day] = d.split('-').map(Number);
  if (y === undefined || m === undefined || day === undefined) return false;
  return y >= 1000 && y <= 9999 && m >= 1 && m <= 12 && day >= 1 && day <= 31 && iso(utc(d)) === d;
}
export const numeroValido = (n: string) => /^-?\d+$/.test(n) && Number.isSafeInteger(Number(n));
export const quantidadeValida = (n: string) => /^\d+$/.test(n) && Number.isSafeInteger(Number(n)) && Number(n) >= 0;
export const fmtData = (d: string) => d.split('-').reverse().join('/');
export const diaSemana = (d: string) => new Date(`${d}T12:00`).toLocaleDateString('pt-BR', { weekday: 'long' });
export const CATEGORIAS = ['direto', 'indireto', 'terceirizado'] as const;
export type Categoria = typeof CATEGORIAS[number];
export const ROTULOS: Record<Categoria, string> = { direto: 'Direto', indireto: 'Indireto', terceirizado: 'Terceirizado' };
export const normalizarFuncao = (f: string) => f.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function totalCategoria(rows: { categoria: string; quantidade: number }[], categoria: Categoria) {
  return rows.filter(r => r.categoria === categoria).reduce((total, r) => total + r.quantidade, 0);
}
export const totalEfetivo = (rows: { quantidade: number }[]) => rows.reduce((total, r) => total + r.quantidade, 0);
export const podeEditarMaoObra = (lancar: boolean, status: string | undefined, fechar: boolean) => lancar && (status !== 'fechado' || fechar);
export const chaveLocal = (data: string) => `rdo-local-${data}`;
export function mensagemErro(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return String(error);
}