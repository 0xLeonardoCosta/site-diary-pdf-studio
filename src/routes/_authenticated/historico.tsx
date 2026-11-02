import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { filtroQuery, historicoQuery, referenciaQuery } from '@/lib/rdo/queries';
import { useAuth, usePermissao } from '@/components/auth-context';
import { ExcluirRdos } from '@/components/rdo/excluir-rdos';
import { ExportarLote } from '@/components/rdo/exportar-lote';
import { dataValida, diaSemana, fmtData, mensagemErro, numeroParaData, numeroValido } from '@/lib/rdo/rules';
import { ObraProvider, useReferencia } from '@/components/rdo/reference';
import { RdoErro, RdoNaoEncontrado } from '@/components/rdo/query-error';

export const Route = createFileRoute('/_authenticated/historico')({
  validateSearch: (search: Record<string, unknown>) => ({ mes: typeof search['mes'] === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(search['mes']) ? search['mes'] : '' }),
  loaderDeps: ({ search }) => ({ mes: search.mes }),
  loader: async ({ context, deps }) => { await Promise.all([
    context.queryClient.ensureQueryData(referenciaQuery(context.perfil.id)),
    context.queryClient.ensureInfiniteQueryData(historicoQuery(context.perfil.id, deps.mes)),
  ]); },
  head: () => ({ meta: [
    { title: 'Histórico de RDOs | RDO360' },
    { name: 'description', content: 'Consulte os relatórios diários da obra por mês, número e data, com status e efetivo.' },
    { property: 'og:title', content: 'Histórico de RDOs | RDO360' },
    { property: 'og:description', content: 'Relatórios da obra, status e efetivo de cada dia.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Historico, errorComponent: RdoErro, notFoundComponent: RdoNaoEncontrado,
});
function Historico() {
  const { perfil } = Route.useRouteContext();
  return <ObraProvider userId={perfil.id}><Lista userId={perfil.id} /></ObraProvider>;
}
function Lista({ userId }: { userId: string }) {
  const { mes } = Route.useSearch();
  const navigate = useNavigate();
  const ref = useReferencia();
  const [numero, setNumero] = useState('');
  const exportar = usePermissao('exportar_pdf');
  const administrador = useAuth().perfil?.role === 'admin';
  // Kept across month filters so a measurement period can span more than one month.
  const [selecao, setSelecao] = useState<ReadonlyMap<string, string>>(new Map());
  const { data: filtro = [] } = useQuery({ ...filtroQuery(userId, mes), enabled: exportar });
  const todosNoFiltro = filtro.length > 0 && filtro.every(r => selecao.has(r.id));
  const algumNoFiltro = filtro.some(r => selecao.has(r.id));
  function marcar(rows: { id: string; data: string }[], marcado: boolean) {
    setSelecao(atual => {
      const nova = new Map(atual);
      for (const r of rows) { if (marcado) nova.set(r.id, r.data); else nova.delete(r.id); }
      return nova;
    });
  }
  const query = useSuspenseInfiniteQuery(historicoQuery(userId, mes));
  function buscar() {
    if (!numeroValido(numero)) { toast.error('Informe um número inteiro.'); return; }
    try {
      const data = numeroParaData(Number(numero), ref.ref_numero, ref.ref_data);
      if (!dataValida(data)) throw new Error('Data fora do intervalo válido.');
      void navigate({ to: '/rdo/$data', params: { data } });
    } catch { toast.error('Informe um número válido para o RDO.'); }
  }
  const rows = query.data.pages.flatMap(p => p.rows);
  return <>
  <main className="no-print mx-auto max-w-4xl px-4 pb-28 pt-8">
    <h1 className="mb-6 font-display text-3xl font-bold uppercase">Histórico de RDOs</h1>
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <label className="text-sm font-semibold">Mês<input aria-label="Mês" className="field mt-1" type="month" value={mes} onChange={e => void navigate({ to: '/historico', search: { mes: e.target.value } })} /></label>
      {mes && <Button variant="ghost" onClick={() => void navigate({ to: '/historico', search: { mes: '' } })}>Todos os meses</Button>}
      <form className="flex min-w-0 items-end gap-2" onSubmit={e => { e.preventDefault(); buscar(); }}><label className="min-w-0 text-sm font-semibold">Ir para o nº<input aria-label="Ir para o nº" inputMode="numeric" className="field mt-1" value={numero} onChange={e => setNumero(e.target.value)} /></label><Button type="submit" variant="outline" size="icon" aria-label="Buscar RDO"><Search /></Button></form>
    </div>
    {exportar && <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold">
      <input type="checkbox" className="size-4 accent-safety" checked={todosNoFiltro} ref={el => { if (el) el.indeterminate = algumNoFiltro && !todosNoFiltro; }} disabled={!filtro.length} onChange={e => marcar(filtro, e.target.checked)} />
      Selecionar todos {mes ? 'deste mês' : 'os RDOs'} ({filtro.length})
    </label>}
    <div className="divide-y border-y">
      {rows.map(row => <div key={row.id} className="flex items-center gap-3 hover:bg-muted">
        {exportar && <input type="checkbox" aria-label={`Selecionar RDO nº ${row.numero}`} className="size-4 shrink-0 accent-safety" checked={selecao.has(row.id)} onChange={e => marcar([row], e.target.checked)} />}
        <Link to="/rdo/$data" params={{ data: row.data }} className="flex min-w-0 flex-1 flex-wrap items-center gap-3 py-4">
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">RDO nº {row.numero}</h2>{row.assinado_nome && <span className="rounded border border-green-600 bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Assinado por: {row.assinado_nome}</span>}</div><p className="text-sm text-muted-foreground">{fmtData(row.data)} — {diaSemana(row.data)}</p></div>
        <span className="text-sm">{row.status === 'fechado' ? 'Fechado' : 'Aberto'}</span><span className="text-sm">Efetivo: <b>{row.total}</b></span><ChevronRight className="size-4" />
        </Link>
      </div>)}
      {!rows.length && <p className="py-8 text-muted-foreground">Nenhum RDO disponível neste período.</p>}
    </div>
    {query.hasNextPage && <Button className="mt-6" variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage().catch(e => toast.error(mensagemErro(e)))}>{query.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}</Button>}
    {query.isFetchNextPageError && <p role="alert" className="mt-3 text-sm text-destructive">{mensagemErro(query.error)}</p>}
  </main>
  {exportar && <ExportarLote userId={userId} datas={[...selecao.values()]} acoes={administrador && <ExcluirRdos userId={userId} ids={[...selecao.keys()]} aoExcluir={() => setSelecao(new Map())} />}>
    <span role="status" className="text-sm font-semibold">{selecao.size} {selecao.size === 1 ? 'documento selecionado' : 'documentos selecionados'}</span>
    {selecao.size > 0 && <Button variant="ghost" size="sm" onClick={() => setSelecao(new Map())}>Limpar seleção</Button>}
    <span className="text-xs text-muted-foreground">Ordem cronológica</span>
  </ExportarLote>}
  </>;
}