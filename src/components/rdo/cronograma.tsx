import { useMemo, useState, type CSSProperties } from 'react';
import { montarCronograma, type LinhaCronograma } from '@/lib/rdo/cronograma';
import { rotuloMes } from '@/lib/rdo/graficos';
import { diaSemana, fmtData } from '@/lib/rdo/rules';

// Validated categorical order: a front keeps its colour whatever the filter shows.
const CORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'];
const LARGURA_DIA = 18;
const SEM_SERVICO: CSSProperties = { backgroundImage: 'repeating-linear-gradient(135deg, var(--grafico-grade) 0 2px, transparent 2px 6px)' };

type Props = {
  rdos: { id: string; data: string }[];
  atividades: { rdo_id: string; frente_id: string; descricao: string }[];
  frentes: { id: string; nome: string; ordem: number }[];
  aoAbrirDia: (data: string) => void;
};
type Destaque = { linha: LinhaCronograma; data: string | null };

export function Cronograma({ rdos, atividades, frentes, aoAbrirDia }: Props) {
  const meses = useMemo(() => [...new Set(rdos.map(r => r.data.slice(0, 7)))].sort(), [rdos]);
  const [periodo, setPeriodo] = useState(meses[meses.length - 1] ?? '');
  const [frente, setFrente] = useState('');
  const [busca, setBusca] = useState('');
  const [destaque, setDestaque] = useState<Destaque | null>(null);
  const cor = useMemo(() => new Map([...frentes].sort((a, b) => a.ordem - b.ordem).map((f, i) => [f.id, CORES[i % CORES.length] ?? CORES[0]])), [frentes]);
  const nome = (id: string) => frentes.find(f => f.id === id)?.nome ?? 'Sem local';
  const c = useMemo(() => montarCronograma(rdos, atividades, frentes, { periodo, frente, busca }), [rdos, atividades, frentes, periodo, frente, busca]);
  const colunas = `minmax(11rem, 17rem) repeat(${c.dias.length}, ${LARGURA_DIA}px)`;
  const diasComServico = c.dias.filter(d => d.comServico).length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">Período
          <select aria-label="Período" className="field mt-1" value={periodo} onChange={e => { setPeriodo(e.target.value); setDestaque(null); }}>
            {meses.map(m => <option key={m} value={m}>{rotuloMes(m)}</option>)}
            <option value="">Todo o período</option>
          </select>
        </label>
        <label className="min-w-0 flex-1 text-sm font-semibold">Buscar atividade
          <input aria-label="Buscar atividade" className="field mt-1" placeholder="Ex.: dragagem" value={busca} onChange={e => setBusca(e.target.value)} />
        </label>
      </div>
      <div role="group" aria-label="Frente" className="flex flex-wrap gap-2">
        {[{ id: '', nome: 'Todas as frentes' }, ...[...frentes].sort((a, b) => a.ordem - b.ordem)].map(f => (
          <button key={f.id} type="button" aria-pressed={frente === f.id} onClick={() => setFrente(f.id)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition ${frente === f.id ? 'border-navy bg-navy text-navy-foreground' : 'bg-card hover:bg-muted'}`}>
            {f.id && <span aria-hidden className="size-2.5 rounded-full" style={{ background: cor.get(f.id) }} />}
            {f.nome}
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Cronograma de atividades · {periodo ? rotuloMes(periodo) : 'todo o período'}</h2>
          <p className="text-sm text-muted-foreground">{c.totalLinhas} {c.totalLinhas === 1 ? 'atividade' : 'atividades'} · {diasComServico} {diasComServico === 1 ? 'dia' : 'dias'} com serviço</p>
        </div>
        {/* Detail of what the pointer or keyboard is on, so the grid stays free of text. */}
        <div aria-live="polite" className="mb-3 min-h-11 rounded-md bg-muted px-3 py-2 text-sm">
          {destaque ? (
            <>
              <p className="font-semibold"><span aria-hidden className="mr-2 inline-block size-2.5 rounded-full" style={{ background: cor.get(destaque.linha.frente) }} />{destaque.linha.descricao}</p>
              <p className="text-muted-foreground">
                {nome(destaque.linha.frente)} · {destaque.linha.dias.size} {destaque.linha.dias.size === 1 ? 'dia' : 'dias'} de {fmtData(destaque.linha.inicio)} a {fmtData(destaque.linha.fim)}
                {destaque.data && <> · <b className="text-foreground">{fmtData(destaque.data)} ({diaSemana(destaque.data)})</b>: clique para abrir o RDO</>}
              </p>
            </>
          ) : <p className="text-muted-foreground">Passe o mouse ou o teclado sobre uma barra para ver os detalhes. Clique para abrir o RDO do dia.</p>}
        </div>

        {c.totalLinhas === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma atividade encontrada com esses filtros.</p> : (
          <div className="overflow-x-auto">
            <div role="table" aria-label="Cronograma de atividades" className="grid w-max min-w-full text-xs" style={{ gridTemplateColumns: colunas }} onMouseLeave={() => setDestaque(null)}>
              {/* Several months: the month gets its own row, since a date does not fit one day's width. */}
              {!periodo && (
                <div role="row" className="contents">
                  <div className="sticky left-0 z-10 bg-card" />
                  {meses.filter(m => c.dias.some(d => d.data.startsWith(m))).map((m, i) => (
                    <div key={m} className={`truncate pt-1 text-center font-semibold ${i > 0 ? 'border-l border-l-foreground/30' : ''}`} style={{ gridColumn: `span ${c.dias.filter(d => d.data.startsWith(m)).length}` }}>{rotuloMes(m)}</div>
                  ))}
                </div>
              )}
              <div role="row" className="contents">
                <div role="columnheader" className="sticky left-0 z-10 border-b bg-card py-1 pr-2 font-semibold text-muted-foreground">Atividade</div>
                {c.dias.map((d, i) => {
                  const novoMes = i > 0 && d.data.slice(8) === '01';
                  return (
                    <div role="columnheader" key={d.data} aria-label={fmtData(d.data)} title={`${fmtData(d.data)} · ${diaSemana(d.data)}${d.temRdo ? '' : ' · sem RDO'}`}
                      className={`border-b py-1 text-center tabular-nums ${d.comServico ? 'text-muted-foreground' : 'text-muted-foreground/50'} ${novoMes ? 'border-l border-l-foreground/30' : ''}`}>
                      {d.data.slice(8)}
                    </div>
                  );
                })}
              </div>
              {c.grupos.map(g => (
                <div role="rowgroup" key={g.frente.id} className="contents">
                  <div role="row" className="contents">
                    <div role="rowheader" className="sticky left-0 z-10 flex items-center gap-2 bg-card pb-1 pr-2 pt-3 font-bold uppercase">
                      <span aria-hidden className="size-2.5 rounded-full" style={{ background: cor.get(g.frente.id) }} />{g.frente.nome}
                      <span className="font-normal normal-case text-muted-foreground">({g.linhas.length})</span>
                    </div>
                    <div style={{ gridColumn: `span ${c.dias.length}` }} />
                  </div>
                  {g.linhas.map(l => (
                    <div role="row" key={l.chave} className="group contents">
                      <div role="rowheader" title={l.descricao} onMouseEnter={() => setDestaque({ linha: l, data: null })}
                        className={`sticky left-0 z-10 truncate border-b border-dotted py-1 pr-2 ${destaque?.linha.chave === l.chave ? 'bg-muted font-semibold' : 'bg-card'}`}>{l.descricao}</div>
                      {c.dias.map((d, i) => {
                        const feito = l.dias.has(d.data);
                        const antes = feito && l.dias.has(c.dias[i - 1]?.data ?? '');
                        const depois = feito && l.dias.has(c.dias[i + 1]?.data ?? '');
                        const fundo = `border-b border-dotted ${destaque?.linha.chave === l.chave ? 'bg-muted' : ''}`;
                        if (!feito) return <div key={d.data} role="cell" className={fundo} style={d.comServico ? undefined : SEM_SERVICO} onMouseEnter={() => setDestaque({ linha: l, data: null })} />;
                        return (
                          <div key={d.data} role="cell" className={`flex items-center ${fundo}`}>
                            <button type="button" aria-label={`${l.descricao}, ${fmtData(d.data)}`} onClick={() => aoAbrirDia(d.data)}
                              onMouseEnter={() => setDestaque({ linha: l, data: d.data })} onFocus={() => setDestaque({ linha: l, data: d.data })}
                              className="h-3 w-full cursor-pointer outline-offset-2 hover:brightness-90 focus-visible:outline-2"
                              style={{ background: cor.get(l.frente), borderRadius: `${antes ? 0 : 4}px ${depois ? 0 : 4}px ${depois ? 0 : 4}px ${antes ? 0 : 4}px` }} />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><span aria-hidden className="inline-block h-3 w-5 rounded-sm border" style={SEM_SERVICO} />Dia sem serviço registrado (domingo, feriado ou sem RDO)</p>
      </div>
    </section>
  );
}
