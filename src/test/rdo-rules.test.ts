import { describe, expect, it, vi } from 'vitest';
import { numeroParaData, dataParaNumero, somaDias, hojeLocal, dataValida, numeroValido, quantidadeValida, normalizarFuncao, totalCategoria, totalEfetivo, podeEditarMaoObra, chaveLocal, CATEGORIAS, climaIcone, numeroParaTexto, ordenarPorFrente, podeEditarLinha, rdoEditavel, textoParaNumero } from '@/lib/rdo/rules';

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
});
