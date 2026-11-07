import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GraficoEfetivo } from '@/components/rdo/grafico-efetivo';
import { agruparEfetivo } from '@/lib/rdo/graficos';

const pontos = [
  { data: '2026-09-30', total: 100 },
  { data: '2026-10-01', total: 138 },
  { data: '2026-10-02', total: 132 },
  { data: '2026-10-04', total: 7 },
  { data: '2026-10-05', total: 126 },
];
// Recharts measures its container; jsdom has no layout engine.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
afterEach(cleanup);

describe('Agrupamento do efetivo', () => {
  it('dias do mês: valor exato e dia sem RDO vazio, sem virar zero', () => {
    const b = agruparEfetivo(pontos, 'dia', '2026-10');
    expect(b).toHaveLength(31);
    expect(b[0]).toMatchObject({ rotulo: '01', valor: 138 });
    expect(b[2]).toMatchObject({ rotulo: '03', valor: null, dias: 0 });
  });
  it('semanas de segunda a domingo, com média só dos dias com RDO', () => {
    const b = agruparEfetivo(pontos, 'semana');
    expect(b.map(x => x.rotulo)).toEqual(['28/09 - 04/10', '05/10 - 11/10']);
    expect(b[0]).toMatchObject({ valor: 94.3, dias: 4 });
    expect(b[1]).toMatchObject({ valor: 126, dias: 1 });
  });
  it('meses com média dos dias com RDO', () => {
    const b = agruparEfetivo(pontos, 'mes');
    expect(b.map(x => x.rotulo)).toEqual(['set/26', 'out/26']);
    expect(b[1]).toMatchObject({ valor: 100.8, dias: 4 });
  });
});

describe('Tela de gráficos', () => {
  it('começa no mês mais recente e alterna entre dias, semanas e meses', () => {
    render(<GraficoEfetivo pontos={pontos} />);
    expect(screen.getByRole('combobox', { name: 'Mês' })).toHaveValue('2026-10');
    expect(screen.getByRole('heading', { name: 'Efetivo por dia · out/26' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Semanas' }));
    expect(screen.getByRole('heading', { name: 'Média do efetivo por semana' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Mês' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Meses' }));
    const tabela = screen.getByRole('table');
    expect(within(tabela).getByText('out/26').closest('tr')?.textContent).toBe('out/26100,84');
  });
  it('sem dados mostra aviso', () => {
    render(<GraficoEfetivo pontos={[]} />);
    expect(screen.getByText('Nenhum RDO com efetivo neste período.')).toBeInTheDocument();
  });
});
