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
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
// A plain lookup: the locale formatter is slow enough to show when a chart labels a thousand days.
export const diaSemana = (d: string) => DIAS_SEMANA[new Date(`${d}T12:00`).getDay()] ?? '';
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
// A signed RDO answers only to its own permission, whatever its open/closed status.
export type EntradaServico = { frente: string; texto: string | null; altura: number };
export type TrechoServicos = { frente: string; titulo: 'novo' | 'continuacao' | 'nenhum'; itens: string[] };
export type BlocoServicos = { novaPagina: boolean; colunas: [TrechoServicos[], TrechoServicos[]] };
/** One heading entry (texto null) before each work front's services, with a height for layout. */
export function entradasServicos(atividades: { frente_id: string; descricao: string }[], alturaTitulo: number, alturaServico: (texto: string) => number): EntradaServico[] {
  const entradas: EntradaServico[] = [];
  atividades.forEach((a, i) => {
    if (i === 0 || atividades[i - 1]?.frente_id !== a.frente_id) entradas.push({ frente: a.frente_id, texto: null, altura: alturaTitulo });
    entradas.push({ frente: a.frente_id, texto: a.descricao, altura: alturaServico(a.descricao) });
  });
  return entradas;
}
/**
 * Lays services out in two columns, read top to bottom then left to right. Columns fill what is
 * left of the page (`disponivel`) and continue on new pages of height `pagina`. A heading never ends
 * a column. A front cut by a page turn repeats its heading as a continuation; a front that only
 * moves to the second column of the same page does not. The last block is balanced.
 */
export function paginarServicos(entradas: EntradaServico[], { disponivel, pagina, espacoGrupo }: { disponivel: number; pagina: number; espacoGrupo: number }): BlocoServicos[] {
  const n = entradas.length;
  const ehTitulo = (i: number) => entradas[i]?.texto === null;
  const alturaTitulo = entradas.find(e => e.texto === null)?.altura ?? 0;
  // Height of entries [a, b) stacked in one column.
  const altura = (a: number, b: number, comContinuacao: boolean) => {
    let h = comContinuacao ? alturaTitulo : 0;
    for (let i = a; i < b; i++) h += (entradas[i]?.altura ?? 0) + (ehTitulo(i) && i > a ? espacoGrupo : 0);
    return h;
  };
  // Furthest end that fits in `capacidade`, never leaving a heading last; at least one service.
  const encher = (a: number, capacidade: number, comContinuacao: boolean) => {
    let b = a;
    while (b < n && altura(a, b + 1, comContinuacao) <= capacidade) b++;
    if (b > a && ehTitulo(b - 1) && b < n) b--;
    if (b === a && a < n) b = Math.min(n, a + (ehTitulo(a) ? 2 : 1));
    return b;
  };
  const trechos = (a: number, b: number, tituloInicial: 'continuacao' | 'nenhum'): TrechoServicos[] => {
    const lista: TrechoServicos[] = [];
    for (let i = a; i < b; i++) {
      const e = entradas[i];
      if (!e) continue;
      if (e.texto === null) lista.push({ frente: e.frente, titulo: 'novo', itens: [] });
      else if (i === a) lista.push({ frente: e.frente, titulo: tituloInicial, itens: [e.texto] });
      else lista[lista.length - 1]?.itens.push(e.texto);
    }
    return lista;
  };
  const blocos: BlocoServicos[] = [];
  let i = 0, capacidade = disponivel, novaPagina = false;
  while (i < n) {
    let continua = novaPagina && !ehTitulo(i);
    const minimo = altura(i, Math.min(n, i + (ehTitulo(i) ? 2 : 1)), continua);
    // Not even a heading and its first service fit: start on the next page.
    if (!novaPagina && minimo > capacidade) { capacidade = pagina; novaPagina = true; continua = !ehTitulo(i); }
    const bloco = (meio: number, fim: number) => blocos.push({ novaPagina, colunas: [trechos(i, meio, continua ? 'continuacao' : 'nenhum'), trechos(meio, fim, 'nenhum')] });
    if (altura(i, n, continua) <= 2 * capacidade) {
      let melhor: number | null = null, diferenca = Infinity;
      for (let corte = i + 1; corte <= n; corte++) {
        if (ehTitulo(corte - 1) && corte < n) continue;
        const h1 = altura(i, corte, continua), h2 = altura(corte, n, false);
        if (h1 <= capacidade && h2 <= capacidade && Math.abs(h1 - h2) < diferenca) { diferenca = Math.abs(h1 - h2); melhor = corte; }
      }
      if (melhor !== null) { bloco(melhor, n); break; }
    }
    const meio = encher(i, capacidade, continua);
    const fim = meio < n ? encher(meio, capacidade, false) : n;
    bloco(meio, fim);
    i = fim; capacidade = pagina; novaPagina = true;
  }
  return blocos;
}
export type CelulaColuna<T> = { tipo: 'grupo'; chave: string; continuacao: boolean } | { tipo: 'item'; chave: string; item: T };
/**
 * Spreads labelled groups over `n` columns of nearly equal height, read top to bottom then left to
 * right. Each heading and item counts as one row, and a column holds at least `minimo` rows, so short
 * lists stay in fewer columns. A group cut by a column repeats its heading as a continuation, and a
 * heading never ends a column.
 */
export function distribuirColunas<T>(grupos: { chave: string; itens: T[] }[], n: number, minimo = 1): CelulaColuna<T>[][] {
  const linhas: CelulaColuna<T>[] = grupos.filter(g => g.itens.length).flatMap(g => [
    { tipo: 'grupo' as const, chave: g.chave, continuacao: false },
    ...g.itens.map(item => ({ tipo: 'item' as const, chave: g.chave, item })),
  ]);
  const montar = (altura: number) => {
    const colunas: CelulaColuna<T>[][] = [[]];
    for (const [i, linha] of linhas.entries()) {
      let atual = colunas[colunas.length - 1]!;
      // A heading needs room for its first item below it.
      const precisa = linha.tipo === 'grupo' && i + 1 < linhas.length ? 2 : 1;
      if (atual.length + precisa > altura && atual.length > 0) {
        atual = [];
        colunas.push(atual);
        if (linha.tipo === 'item') atual.push({ tipo: 'grupo', chave: linha.chave, continuacao: true });
      }
      atual.push(linha);
    }
    return colunas;
  };
  // The shortest height that fits every row in n columns, continuation headings included.
  for (let altura = Math.max(2, minimo, Math.ceil(linhas.length / n)); ; altura++) {
    const colunas = montar(altura);
    if (colunas.length <= n) return colunas.filter(c => c.length);
  }
}
export const rdoEditavel =(status: string | undefined, fechar: boolean, assinado = false, alterarAssinados = false) => (assinado ? alterarAssinados : status !== 'fechado' || fechar);
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
export const podeEditarMaoObra = (lancar: boolean, status: string | undefined, fechar: boolean, assinado = false, alterarAssinados = false) => lancar && rdoEditavel(status, fechar, assinado, alterarAssinados);
export const chaveLocal = (data: string) => `rdo-local-${data}`;
export function mensagemErro(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return String(error);
}