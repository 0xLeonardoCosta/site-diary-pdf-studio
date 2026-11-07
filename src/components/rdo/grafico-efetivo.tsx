import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import { agruparEfetivo, rotuloMes, type Barra, type ModoGrafico, type PontoEfetivo } from '@/lib/rdo/graficos';
import { numeroParaTexto } from '@/lib/rdo/rules';

const MODOS: { id: ModoGrafico; rotulo: string }[] = [
  { id: 'dia', rotulo: 'Dias do mês' },
  { id: 'semana', rotulo: 'Semanas' },
  { id: 'mes', rotulo: 'Meses' },
];
const valorTexto = (v: number | null) => (v === null ? 'Sem RDO' : numeroParaTexto(v));

function Dica({ active, payload, modo }: TooltipProps<number, string> & { modo: ModoGrafico }) {
  const barra = payload?.[0]?.payload as Barra | undefined;
  if (!active || !barra) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-semibold">{barra.detalhe}</p>
      <p>{modo === 'dia' ? 'Efetivo' : 'Média do efetivo'}: <b>{valorTexto(barra.valor)}</b></p>
      {modo !== 'dia' && <p className="text-muted-foreground">{barra.dias === 1 ? '1 dia com RDO' : `${barra.dias} dias com RDO`}</p>}
    </div>
  );
}

export function GraficoEfetivo({ pontos }: { pontos: PontoEfetivo[] }) {
  const meses = useMemo(() => [...new Set(pontos.map(p => p.data.slice(0, 7)))].sort(), [pontos]);
  const [modo, setModo] = useState<ModoGrafico>('dia');
  const [mes, setMes] = useState(meses[meses.length - 1] ?? '');
  const barras = useMemo(() => agruparEfetivo(pontos, modo, mes), [pontos, modo, mes]);
  const titulo = modo === 'dia' ? `Efetivo por dia · ${mes ? rotuloMes(mes) : ''}` : modo === 'semana' ? 'Média do efetivo por semana' : 'Média do efetivo por mês';
  const comDados = barras.filter(b => b.valor !== null);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Agrupar por" className="inline-flex rounded-md border bg-card p-1">
          {MODOS.map(m => (
            <button key={m.id} type="button" aria-pressed={modo === m.id} onClick={() => setModo(m.id)}
              className={`rounded px-3 py-1.5 text-sm font-semibold transition ${modo === m.id ? 'bg-navy text-navy-foreground' : 'hover:bg-muted'}`}>
              {m.rotulo}
            </button>
          ))}
        </div>
        {modo === 'dia' && (
          <label className="text-sm font-semibold">Mês
            <select aria-label="Mês" className="field mt-1" value={mes} onChange={e => setMes(e.target.value)}>
              {meses.map(m => <option key={m} value={m}>{rotuloMes(m)}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="font-semibold">{titulo}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{modo === 'dia' ? 'Efetivo total registrado em cada RDO. Dias sem RDO ficam vazios.' : 'Média dos dias que têm RDO, incluindo domingos e feriados registrados.'}</p>
        {comDados.length ? (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barras} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
                <CartesianGrid vertical={false} stroke="var(--grafico-grade)" />
                {/* Week ranges are long: tilted, so every interval keeps its label. */}
                <XAxis dataKey="rotulo" tickLine={false} axisLine={{ stroke: 'var(--grafico-grade)' }} tick={{ fontSize: 11, fill: 'var(--grafico-texto)' }}
                  {...(modo === 'semana' ? { angle: -35, textAnchor: 'end', height: 56, interval: 0 } : { interval: 'preserveStartEnd' as const, minTickGap: 4 })} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11, fill: 'var(--grafico-texto)' }} />
                <Tooltip cursor={{ fill: 'var(--grafico-cursor)' }} content={<Dica modo={modo} />} />
                <Bar dataKey="valor" name="Efetivo" fill="var(--grafico-barra)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <p className="py-10 text-center text-sm text-muted-foreground">Nenhum RDO com efetivo neste período.</p>}
      </div>

      <details className="rounded-xl border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Ver valores em tabela</summary>
        <table className="mt-3 w-full border-collapse">
          <thead><tr className="border-b text-left"><th className="py-1">{modo === 'dia' ? 'Dia' : modo === 'semana' ? 'Semana' : 'Mês'}</th><th className="py-1 text-right">{modo === 'dia' ? 'Efetivo' : 'Média'}</th>{modo !== 'dia' && <th className="py-1 text-right">Dias com RDO</th>}</tr></thead>
          <tbody>
            {(modo === 'dia' ? barras : comDados).map(b => (
              <tr key={b.chave} className="border-b last:border-0"><td className="py-1">{b.detalhe}</td><td className="py-1 text-right font-semibold">{valorTexto(b.valor)}</td>{modo !== 'dia' && <td className="py-1 text-right">{b.dias}</td>}</tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
