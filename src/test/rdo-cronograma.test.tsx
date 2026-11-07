import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Cronograma } from '@/components/rdo/cronograma';
import { montarCronograma } from '@/lib/rdo/cronograma';

const frentes = [{ id: 'reto', nome: 'Mártir Reto', ordem: 2 }, { id: 'can', nome: 'Canteiro', ordem: 1 }];
const rdos = [
  { id: 'r30', data: '2026-10-30' }, { id: 'r31', data: '2026-10-31' },
  { id: 'r3', data: '2026-11-03' }, { id: 'r4', data: '2026-11-04' }, { id: 'r5', data: '2026-11-05' },
];
const atividades = [
  { rdo_id: 'r30', frente_id: 'reto', descricao: 'Dragagem' },
  { rdo_id: 'r3', frente_id: 'reto', descricao: 'Execução de forma' },
  { rdo_id: 'r4', frente_id: 'reto', descricao: 'execucao  de FORMA' },
  { rdo_id: 'r4', frente_id: 'can', descricao: 'Corte de armadura' },
  { rdo_id: 'r5', frente_id: 'reto', descricao: 'Dragagem' },
];
afterEach(cleanup);

describe('Montagem do cronograma', () => {
  it('uma linha por atividade e frente, juntando caixa, acentos e espaços', () => {
    const c = montarCronograma(rdos, atividades, frentes, { periodo: '2026-11', frente: '', busca: '' });
    expect(c.grupos.map(g => g.frente.nome)).toEqual(['Canteiro', 'Mártir Reto']);
    const reto = c.grupos[1]!.linhas;
    expect(reto.map(l => [l.descricao, [...l.dias].sort()])).toEqual([
      ['execucao  de FORMA', ['2026-11-03', '2026-11-04']],
      ['Dragagem', ['2026-11-05']],
    ]);
  });
  it('mês mostra todos os dias do calendário e marca os sem serviço', () => {
    const c = montarCronograma(rdos, atividades, frentes, { periodo: '2026-11', frente: '', busca: '' });
    expect(c.dias).toHaveLength(30);
    expect(c.dias.find(d => d.data === '2026-11-04')).toMatchObject({ temRdo: true, comServico: true });
    expect(c.dias.find(d => d.data === '2026-11-02')).toMatchObject({ temRdo: false, comServico: false });
  });
  it('todo o período vai do primeiro ao último RDO e une a mesma atividade entre meses', () => {
    const c = montarCronograma(rdos, atividades, frentes, { periodo: '', frente: '', busca: '' });
    expect(c.dias[0]?.data).toBe('2026-10-30');
    expect(c.dias[c.dias.length - 1]?.data).toBe('2026-11-05');
    expect(c.dias.find(d => d.data === '2026-10-31')).toMatchObject({ temRdo: true, comServico: false });
    const dragagem = c.grupos[1]!.linhas.find(l => l.descricao === 'Dragagem')!;
    expect([dragagem.inicio, dragagem.fim, dragagem.dias.size]).toEqual(['2026-10-30', '2026-11-05', 2]);
  });
  it('filtra por frente e por texto sem acento', () => {
    expect(montarCronograma(rdos, atividades, frentes, { periodo: '', frente: 'can', busca: '' }).grupos.map(g => g.frente.id)).toEqual(['can']);
    const c = montarCronograma(rdos, atividades, frentes, { periodo: '', frente: '', busca: 'EXECUÇÃO' });
    expect(c.totalLinhas).toBe(1);
  });
});

describe('Tela do cronograma', () => {
  it('mostra detalhes ao passar o mouse e abre o RDO ao clicar', () => {
    const abrir = vi.fn();
    render(<Cronograma rdos={rdos} atividades={atividades} frentes={frentes} aoAbrirDia={abrir} />);
    expect(screen.getByRole('combobox', { name: 'Período' })).toHaveValue('2026-11');
    const barra = screen.getByRole('button', { name: 'Corte de armadura, 04/11/2026' });
    fireEvent.mouseEnter(barra);
    expect(screen.getByText(/04\/11\/2026 \(quarta-feira\)/)).toBeInTheDocument();
    fireEvent.click(barra);
    expect(abrir).toHaveBeenCalledWith('2026-11-04');
  });
  it('filtro de frente e busca sem resultado', () => {
    render(<Cronograma rdos={rdos} atividades={atividades} frentes={frentes} aoAbrirDia={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Canteiro' }));
    expect(screen.queryByRole('button', { name: /Dragagem/ })).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar atividade' }), { target: { value: 'xyz' } });
    expect(screen.getByText('Nenhuma atividade encontrada com esses filtros.')).toBeInTheDocument();
  });
});
