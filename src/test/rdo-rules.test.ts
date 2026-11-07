import { describe, expect, it, vi } from 'vitest';
import { numeroParaData, dataParaNumero, somaDias, hojeLocal, dataValida, numeroValido, quantidadeValida, normalizarFuncao, totalCategoria, totalEfetivo, podeEditarMaoObra, chaveLocal, CATEGORIAS, climaIcone, entradasServicos, paginarServicos, numeroParaTexto, ordenarPorFrente, podeEditarLinha, rdoEditavel, textoParaNumero } from '@/lib/rdo/rules';

describe('Número e data ligados', () => {
  it.each([[1000, '2026-10-25'], [1002, '2026-10-27'], [1007, '2026-11-01']] as const)('converte referência %i nos dois sentidos', (numero, data) => {
    expect(numeroParaData(numero, 1000, '2026-10-25')).toBe(data);
    expect(dataParaNumero(data, 1000, '2026-10-25')).toBe(numero);
  });
  it('navega para o dia vizinho atravessando meses e anos', () => {
    expect(somaDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(somaDias('2027-01-01', -1)).toBe('2026-12-31');
  });
  it('valida calendário e formato estrito', () => {
    expect(dataValida('2026-02-30')).toBe(false);
    expect(dataValida('2026-13-01')).toBe(false);
    expect(dataValida('29/10/2026')).toBe(false);
    expect(dataValida('2028-02-29')).toBe(true);
  });
  it('aceita só número inteiro', () => {
    expect(numeroValido('1007')).toBe(true);
    expect(numeroValido('1007.5')).toBe(false);
    expect(numeroValido('')).toBe(false);
  });
  it('usa a data local de hoje', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 29, 0, 56));
    expect(hojeLocal()).toBe('2026-10-29'); vi.useRealTimers();
  });
  it('separa armazenamento por data', () => {
    expect(chaveLocal('2026-10-29')).toBe('rdo-local-2026-10-29');
    expect(chaveLocal('2026-10-30')).not.toBe(chaveLocal('2026-10-29'));
  });
});
describe('Mão de obra', () => {
  it('usa as três categorias minúsculas na ordem exigida', () => { expect(CATEGORIAS).toEqual(['indireto', 'direto', 'terceirizado']); });
  it('aceita quantidade inteira maior ou igual a zero', () => {
    expect(quantidadeValida('0')).toBe(true);
    expect(quantidadeValida('12')).toBe(true);
    for (const value of ['-1', '1.5', '', 'abc']) expect(quantidadeValida(value)).toBe(false);
  });
  it('normaliza funções ignorando caixa e acentos', () => { expect(normalizarFuncao('  TÉCNICO  ')).toBe(normalizarFuncao('técnico')); });
  it('soma as três categorias e o total', () => {
    const rows = [{ categoria: 'direto', quantidade: 4 }, { categoria: 'direto', quantidade: 6 }, { categoria: 'indireto', quantidade: 1 }, { categoria: 'terceirizado', quantidade: 3 }];
    expect(totalCategoria(rows, 'direto')).toBe(10);
    expect(totalCategoria(rows, 'indireto')).toBe(1);
    expect(totalCategoria(rows, 'terceirizado')).toBe(3);
    expect(totalEfetivo(rows)).toBe(14);
  });
  it('exige lançar mão de obra mesmo com fechar/reabrir', () => { expect(podeEditarMaoObra(false, 'aberto', true)).toBe(false); });
  it('bloqueia fechado salvo permissão fechar/reabrir', () => {
    expect(podeEditarMaoObra(true, 'fechado', false)).toBe(false);
    expect(podeEditarMaoObra(true, 'fechado', true)).toBe(true);
    expect(podeEditarMaoObra(true, 'aberto', false)).toBe(true);
  });
});
describe('Atividades por frente', () => {
  it('ordena pela ordem das frentes mantendo a ordem de lançamento', () => {
    const frentes = [{ id: 'canteiro', ordem: 1 }, { id: 'reto', ordem: 2 }, { id: 'murutucu', ordem: 4 }];
    const rows = [{ id: 'a', frente_id: 'murutucu' }, { id: 'b', frente_id: 'canteiro' }, { id: 'c', frente_id: 'reto' }, { id: 'd', frente_id: 'canteiro' }];
    expect(ordenarPorFrente(rows, frentes).map(r => r.id)).toEqual(['b', 'd', 'c', 'a']);
  });
});
describe('Campos e permissões do RDO', () => {
  it('usa a lua só no tempo bom da noite anterior', () => {
    expect(climaIcone('Noite anterior', 'Bom')).toBe('🌙');
    expect(climaIcone('Manhã', 'Bom')).toBe('☀️');
    expect(climaIcone('Noite anterior', 'Chuva forte')).toBe('⛈️');
  });
  it('converte número com vírgula e recusa texto', () => {
    expect(textoParaNumero('2,85')).toBe(2.85);
    expect(textoParaNumero('  ')).toBeNull();
    expect(() => textoParaNumero('abc')).toThrow();
    expect(numeroParaTexto(2.85)).toBe('2,85');
    expect(numeroParaTexto(null)).toBe('');
  });
  it('só o autor ou quem edita de outros altera a linha', () => {
    expect(podeEditarLinha('eu', 'eu', false)).toBe(true);
    expect(podeEditarLinha('outro', 'eu', false)).toBe(false);
    expect(podeEditarLinha('outro', 'eu', true)).toBe(true);
  });
  it('RDO fechado só fica editável para quem pode reabrir', () => {
    expect(rdoEditavel('aberto', false)).toBe(true);
    expect(rdoEditavel('fechado', false)).toBe(false);
    expect(rdoEditavel('fechado', true)).toBe(true);
  });
  it('RDO assinado só muda com a permissão própria, mesmo aberto ou com fechar/reabrir', () => {
    expect(rdoEditavel('aberto', false, true, false)).toBe(false);
    expect(rdoEditavel('fechado', true, true, false)).toBe(false);
    expect(rdoEditavel('fechado', false, true, true)).toBe(true);
    expect(podeEditarMaoObra(true, 'aberto', false, true, false)).toBe(false);
    expect(podeEditarMaoObra(false, 'aberto', false, true, true)).toBe(false);
  });
});
describe('Serviços do PDF em duas colunas e páginas', () => {
  const ativ = (frente_id: string, n: number) => Array.from({ length: n }, (_, i) => ({ frente_id, descricao: `${frente_id}${i + 1}` }));
  // Every heading and service is 10px tall, so capacities read as line counts.
  const entradas = (lista: { frente_id: string; descricao: string }[]) => entradasServicos(lista, 10, () => 10);
  const resumo = (col: { frente: string; titulo: string; itens: string[] }[]) => col.map(t => `${t.frente}${t.titulo === 'continuacao' ? '(Continuação)' : t.titulo === 'nenhum' ? '…' : ''}:${t.itens.length}`);
  const cabe = { disponivel: Infinity, pagina: Infinity, espacoGrupo: 0 };
  it('na mesma página equilibra as colunas e não repete o título', () => {
    const [bloco, ...resto] = paginarServicos(entradas([...ativ('canteiro', 2), ...ativ('reto', 17), ...ativ('muru', 10)]), cabe);
    expect(resto).toEqual([]);
    expect(resumo(bloco!.colunas[0])).toEqual(['canteiro:2', 'reto:12']);
    expect(resumo(bloco!.colunas[1])).toEqual(['reto…:5', 'muru:10']);
  });
  it('ao virar de página repete o título como continuação', () => {
    // 4 lines left on this page, 6 on each new page.
    const blocos = paginarServicos(entradas(ativ('muru', 12)), { disponivel: 40, pagina: 60, espacoGrupo: 0 });
    expect(blocos.map(b => b.novaPagina)).toEqual([false, true]);
    expect(resumo(blocos[0]!.colunas[0])).toEqual(['muru:3']);
    expect(resumo(blocos[0]!.colunas[1])).toEqual(['muru…:4']);
    // The new page is balanced too: the repeated heading only opens the first column.
    expect(resumo(blocos[1]!.colunas[0])).toEqual(['muru(Continuação):2']);
    expect(resumo(blocos[1]!.colunas[1])).toEqual(['muru…:3']);
  });
  it('sem espaço para título e um serviço, começa na página seguinte, sem continuação', () => {
    const blocos = paginarServicos(entradas(ativ('reto', 2)), { disponivel: 15, pagina: 100, espacoGrupo: 0 });
    expect(blocos).toHaveLength(1);
    expect(blocos[0]!.novaPagina).toBe(true);
    expect(resumo(blocos[0]!.colunas[0])).toEqual(['reto:1']);
    expect(resumo(blocos[0]!.colunas[1])).toEqual(['reto…:1']);
  });
  it('nunca termina uma coluna com um título', () => {
    const blocos = paginarServicos(entradas([...ativ('a', 3), ...ativ('b', 3)]), { disponivel: 40, pagina: 40, espacoGrupo: 0 });
    for (const b of blocos) for (const col of b.colunas) for (const t of col) expect(t.itens.length).toBeGreaterThan(0);
    const total = blocos.flatMap(b => b.colunas.flat()).reduce((n, t) => n + t.itens.length, 0);
    expect(total).toBe(6);
  });
  it('textos longos contam como mais linhas', () => {
    const lista = [{ frente_id: 'a', descricao: 'y'.repeat(180) }, ...ativ('a', 4)];
    const [bloco] = paginarServicos(entradasServicos(lista, 1, t => Math.max(1, Math.ceil(t.length / 60))), cabe);
    expect(resumo(bloco!.colunas[0])).toEqual(['a:1']);
    expect(resumo(bloco!.colunas[1])).toEqual(['a…:4']);
  });
});
