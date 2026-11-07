import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GraficoEfetivo } from '@/components/rdo/grafico-efetivo';
import { agruparEfetivo } from '@/lib/rdo/graficos';

const ponto = (data: string, indireto: number, direto: number, terceirizado: number) => ({ data, indireto, direto, terceirizado, total: indireto + direto + terceirizado });
const pontos = [
  ponto('2026-09-30', 40, 50, 10),
  ponto('2026-10-01', 42, 78, 18),
  ponto('2026-10-02', 40, 74, 18),
  ponto('2026-10-04', 7, 0, 0),
  ponto('2026-10-05', 40, 71, 15),
];
// Recharts measures its container; jsdom has no layout engine.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
afterEach(cleanup);

describe('Agrupamento do efetivo', () => {
  it('dias do mês: valor exato e dia sem RDO vazio, sem virar zero', () => {
    const b = agruparEfetivo(pontos, 'dia', '2026-10');
    expect(b).toHaveLength(31);
    expect(b[0]).toMatchObject({ rotulo: '01', valor: 138, indireto: 42, direto: 78, terceirizado: 18 });
    expect(b[2]).toMatchObject({ rotulo: '03', valor: null, dias: 0, indireto: null });
  });
  it('semanas de segunda a domingo, com média só dos dias com RDO', () => {
    const b = agruparEfetivo(pontos, 'semana');
    expect(b.map(x => x.rotulo)).toEqual(['28/09 - 04/10', '05/10 - 11/10']);
    expect(b[0]).toMatchObject({ valor: 94.3, dias: 4, indireto: 32.3, direto: 50.5, terceirizado: 11.5 });
    expect(b[1]).toMatchObject({ valor: 126, dias: 1 });
  });
  it('meses com média dos dias com RDO', () => {
    const b = agruparEfetivo(pontos, 'mes');
    expect(b.map(x => x.rotulo)).toEqual(['set/26', 'out/26']);
    expect(b[1]).toMatchObject({ valor: 100.8, dias: 4 });
  });
});

describe('Tela de gráficos', () => {
  it('legenda com as três categorias, na ordem do efetivo', () => {
    render(<GraficoEfetivo pontos={pontos} />);
    expect(within(screen.getByRole('list', { name: 'Legenda' })).getAllByRole('listitem').map(li => li.textContent)).toEqual(['Indireto', 'Direto', 'Terceirizado']);
  });
  it('começa no mês mais recente e alterna entre dias, semanas e meses', () => {
    render(<GraficoEfetivo pontos={pontos} />);
    expect(screen.getByRole('combobox', { name: 'Mês' })).toHaveValue('2026-10');
    expect(screen.getByRole('heading', { name: 'Efetivo por dia · out/26' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Semanas' }));
    expect(screen.getByRole('heading', { name: 'Média do efetivo por semana' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Mês' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Meses' }));
    const tabela = screen.getByRole('table');
    expect(within(tabela).getByText('out/26').closest('tr')?.textContent).toBe('out/2632,355,812,8100,84');
  });
  it('sem dados mostra aviso', () => {
    render(<GraficoEfetivo pontos={[]} />);
    expect(screen.getByText('Nenhum RDO com efetivo neste período.')).toBeInTheDocument();
  });
});
