import { describe, expect, it, vi } from 'vitest';
import { numeroParaData, dataParaNumero, somaDias, hojeLocal, dataValida, numeroValido, quantidadeValida, normalizarFuncao, totalCategoria, totalEfetivo, podeEditarMaoObra, chaveLocal, CATEGORIAS, LOCAIS, localValido, ordenarPorLocal } from '@/lib/rdo/rules';

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
describe('Atividades por local', () => {
  it('ordena pelos locais da obra mantendo a ordem de lançamento', () => {
    const rows = [{ id: 'a', local: 'Murutucu' }, { id: 'b', local: '' }, { id: 'c', local: 'Canteiro' }, { id: 'd', local: 'Mártir Curvo' }, { id: 'e', local: 'Canteiro' }, { id: 'f', local: 'Mártir Reto' }];
    expect(ordenarPorLocal(rows).map(r => r.id)).toEqual(['c', 'e', 'f', 'd', 'a', 'b']);
  });
  it('reconhece só os quatro locais', () => {
    expect(LOCAIS).toEqual(['Canteiro', 'Mártir Reto', 'Mártir Curvo', 'Murutucu']);
    expect(localValido('Canteiro')).toBe(true);
    expect(localValido('50')).toBe(false);
  });
});