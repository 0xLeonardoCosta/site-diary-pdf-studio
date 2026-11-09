import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { montarCronograma, type LinhaCronograma } from '@/lib/rdo/cronograma';
import { rotuloMes } from '@/lib/rdo/graficos';
import type { DadosCronograma } from '@/lib/rdo/queries';
import { diaSemana, fmtData } from '@/lib/rdo/rules';

// Validated categorical order: a front keeps its colour whatever the filter shows.
const CORES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'];
const LARGURA_DIA = 18;
const SEM_SERVICO: CSSProperties = { backgroundImage: 'repeating-linear-gradient(135deg, var(--grafico-grade) 0 2px, transparent 2px 6px)' };
const VAZIO: DadosCronograma = { rdos: [], atividades: [] };

type Props = {
  meses: string[];
  periodo: string;
  aoMudarPeriodo: (periodo: string) => void;
  dados: DadosCronograma | undefined;
  carregando: boolean;
  frentes: { id: string; nome: string; ordem: number }[];
  aoAbrirDia: (data: string) => void;
};
type Destaque = { linha: LinhaCronograma; data: string | null };
// Consecutive days of one line, as column indexes: drawn as a single bar.
type Trecho = { inicio: number; fim: number };

function trechos(linha: LinhaCronograma, indice: Map<string, number>): Trecho[] {
  const colunas = [...linha.dias].map(d => indice.get(d)).filter((i): i is number => i !== undefined).sort((a, b) => a - b);
  const out: Trecho[] = [];
  for (const i of colunas) {
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.fim === i - 1) ultimo.fim = i; else out.push({ inicio: i, fim: i });
  }
  return out;
}

export function Cronograma({ meses, periodo, aoMudarPeriodo, dados, carregando, frentes, aoAbrirDia }: Props) {
  const [frente, setFrente] = useState('');
  const [busca, setBusca] = useState('');
  const [destaque, setDestaque] = useState<Destaque | null>(null);
  const cor = useMemo(() => new Map([...frentes].sort((a, b) => a.ordem - b.ordem).map((f, i) => [f.id, CORES[i % CORES.length] ?? CORES[0]])), [frentes]);
  const nome = (id: string) => frentes.find(f => f.id === id)?.nome ?? 'Sem local';
  const { rdos, atividades } = dados ?? VAZIO;
  const c = useMemo(() => montarCronograma(rdos, atividades, frentes, { periodo, frente, busca }), [rdos, atividades, frentes, periodo, frente, busca]);
  const indice = useMemo(() => new Map(c.dias.map((d, i) => [d.data, i])), [c.dias]);
  const barras = useMemo(() => new Map(c.grupos.flatMap(g => g.linhas.map(l => [l.chave, trechos(l, indice)] as const))), [c.grupos, indice]);
  const largura = c.dias.length * LARGURA_DIA;
  const mesesVisiveis = useMemo(() => meses.flatMap(m => {
    const i = c.dias.findIndex(d => d.data.startsWith(m));
    return i < 0 ? [] : [{ mes: m, inicio: i, dias: c.dias.filter(d => d.data.startsWith(m)).length }];
  }), [meses, c.dias]);
  const diasComServico = c.dias.filter(d => d.comServico).length;
  // The day under the pointer inside a bar; the keyboard opens the bar's first day.
  const diaNoPonto = (e: MouseEvent<HTMLElement>, t: Trecho) => {
    const caixa = e.currentTarget.getBoundingClientRect();
    const i = caixa.width > 0 ? Math.floor((e.clientX - caixa.left) / LARGURA_DIA) : 0;
    return c.dias[t.inicio + Math.min(Math.max(i, 0), t.fim - t.inicio)]?.data ?? null;
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold">Período
          <select aria-label="Período" className="field mt-1" value={periodo} onChange={e => { aoMudarPeriodo(e.target.value); setDestaque(null); }}>
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
          {!carregando && <p className="text-sm text-muted-foreground">{c.totalLinhas} {c.totalLinhas === 1 ? 'atividade' : 'atividades'} · {diasComServico} {diasComServico === 1 ? 'dia' : 'dias'} com serviço</p>}
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

        {carregando ? <p role="status" className="py-10 text-center text-sm text-muted-foreground">Carregando atividades{periodo ? '' : ' de todo o período'}…</p>
          : c.totalLinhas === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma atividade encontrada com esses filtros.</p> : (
          <div className="overflow-x-auto">
            {/* One bar per run of consecutive days, not one element per day: the whole history stays light. */}
            <div role="table" aria-label="Cronograma de atividades" className="relative grid w-max min-w-full text-xs [--rotulo:11rem] sm:[--rotulo:17rem]"
              style={{ gridTemplateColumns: `var(--rotulo) ${largura}px` }} onMouseLeave={() => setDestaque(null)}>
              <div aria-hidden className="pointer-events-none absolute inset-y-0" style={{ left: 'var(--rotulo)', width: largura }}>
                {c.dias.map((d, i) => (d.comServico ? null : <div key={d.data} className="absolute inset-y-0" style={{ ...SEM_SERVICO, left: i * LARGURA_DIA, width: LARGURA_DIA }} />))}
                {mesesVisiveis.slice(1).map(m => <div key={m.mes} className="absolute inset-y-0 border-l border-l-foreground/30" style={{ left: m.inicio * LARGURA_DIA }} />)}
              </div>
              {/* Several months: the month gets its own row, since a date does not fit one day's width. */}
              {!periodo && (
                <div role="row" className="contents">
                  <div className="sticky left-0 z-10 bg-card" />
                  <div className="relative h-5">
                    {mesesVisiveis.map(m => (
                      <div key={m.mes} className="absolute top-0 truncate pt-1 text-center font-semibold" style={{ left: m.inicio * LARGURA_DIA, width: m.dias * LARGURA_DIA }}>{rotuloMes(m.mes)}</div>
                    ))}
                  </div>
                </div>
              )}
              <div role="row" className="contents">
                <div role="columnheader" className="sticky left-0 z-10 border-b bg-card py-1 pr-2 font-semibold text-muted-foreground">Atividade</div>
                <div className="flex border-b">
                  {c.dias.map(d => (
                    <div role="columnheader" key={d.data} aria-label={fmtData(d.data)} title={`${fmtData(d.data)} · ${diaSemana(d.data)}${d.temRdo ? '' : ' · sem RDO'}`}
                      className={`shrink-0 py-1 text-center tabular-nums ${d.comServico ? 'text-muted-foreground' : 'text-muted-foreground/50'}`} style={{ width: LARGURA_DIA }}>
                      {d.data.slice(8)}
                    </div>
                  ))}
                </div>
              </div>
              {c.grupos.map(g => (
                <div role="rowgroup" key={g.frente.id} className="contents">
                  <div role="row" className="contents">
                    <div role="rowheader" className="sticky left-0 z-10 flex items-center gap-2 bg-card pb-1 pr-2 pt-3 font-bold uppercase">
                      <span aria-hidden className="size-2.5 rounded-full" style={{ background: cor.get(g.frente.id) }} />{g.frente.nome}
                      <span className="font-normal normal-case text-muted-foreground">({g.linhas.length})</span>
                    </div>
                    <div />
                  </div>
                  {g.linhas.map(l => {
                    const ativa = destaque?.linha.chave === l.chave;
                    return (
                      <div role="row" key={l.chave} className="contents">
                        <div role="rowheader" title={l.descricao} onMouseEnter={() => setDestaque({ linha: l, data: null })}
                          className={`sticky left-0 z-10 truncate border-b border-dotted py-1 pr-2 ${ativa ? 'bg-muted font-semibold' : 'bg-card'}`}>{l.descricao}</div>
                        <div role="cell" className={`relative border-b border-dotted ${ativa ? 'bg-muted/70' : ''}`} onMouseEnter={() => setDestaque({ linha: l, data: null })}>
                          {(barras.get(l.chave) ?? []).map(t => {
                            const primeiro = c.dias[t.inicio]!.data, ultimo = c.dias[t.fim]!.data;
                            return (
                              <button key={t.inicio} type="button" aria-label={`${l.descricao}, ${fmtData(primeiro)}${t.fim > t.inicio ? ` a ${fmtData(ultimo)}` : ''}`}
                                onClick={e => aoAbrirDia(diaNoPonto(e, t) ?? primeiro)}
                                onMouseMove={e => { const data = diaNoPonto(e, t); if (data !== destaque?.data || !ativa) setDestaque({ linha: l, data }); }}
                                onMouseEnter={e => setDestaque({ linha: l, data: diaNoPonto(e, t) })} onFocus={() => setDestaque({ linha: l, data: primeiro })}
                                className="absolute top-1/2 h-3 -translate-y-1/2 cursor-pointer rounded outline-offset-2 hover:brightness-90 focus-visible:outline-2"
                                style={{ left: t.inicio * LARGURA_DIA + 1, width: (t.fim - t.inicio + 1) * LARGURA_DIA - 2, background: cor.get(l.frente) }} />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
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
