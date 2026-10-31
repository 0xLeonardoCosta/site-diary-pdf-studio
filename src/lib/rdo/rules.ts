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
export const CATEGORIAS = ['indireto', 'direto', 'terceirizado'] as const;
export type Categoria = typeof CATEGORIAS[number];
export const ROTULOS: Record<Categoria, string> = { direto: 'Direto', indireto: 'Indireto', terceirizado: 'Terceirizado' };
export const CLIMAS = ['Bom', 'Nublado', 'Chuva fraca', 'Chuva forte'] as const;
export const TURNOS = [
  { rotulo: 'Manhã', coluna: 'clima_manha' },
  { rotulo: 'Tarde', coluna: 'clima_tarde' },
  { rotulo: 'Noite anterior', coluna: 'clima_noite' },
] as const;
export const COLETAS = [
  { hora: '07:00', coluna: 'pluv_07h' },
  { hora: '12:00', coluna: 'pluv_12h' },
  { hora: '17:00', coluna: 'pluv_17h' },
] as const;
const CLIMA_ICONE: Record<string, string> = { Bom: '☀️', Nublado: '☁️', 'Chuva fraca': '🌦️', 'Chuva forte': '⛈️' };
export const climaIcone = (turno: string, clima: string) => (turno === 'Noite anterior' && clima === 'Bom' ? '🌙' : CLIMA_ICONE[clima] ?? '');
// Stable sort: activities keep their launch order inside each work front.
export function ordenarPorFrente<T extends { frente_id: string }>(rows: T[], frentes: { id: string; ordem: number }[]) {
  const pos = (id: string) => frentes.find(f => f.id === id)?.ordem ?? Number.MAX_SAFE_INTEGER;
  return [...rows].sort((a, b) => pos(a.frente_id) - pos(b.frente_id));
}
export const rdoEditavel = (status: string | undefined, fechar: boolean) => status !== 'fechado' || fechar;
export const podeEditarLinha = (criadoPor: string, userId: string, editarDeOutros: boolean) => criadoPor === userId || editarDeOutros;
export const numeroParaTexto = (n: number | null) => (n === null ? '' : String(n).replace('.', ','));
export function textoParaNumero(texto: string) {
  const limpo = texto.trim().replace(',', '.');
  if (!limpo) return null;
  const n = Number(limpo);
  if (!Number.isFinite(n)) throw new Error('Informe um número válido, como 2,85.');
  return n;
}
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