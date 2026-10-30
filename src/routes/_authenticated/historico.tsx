import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { historicoQuery, referenciaQuery } from '@/lib/rdo/queries';
import { dataValida, diaSemana, fmtData, mensagemErro, numeroParaData, numeroValido } from '@/lib/rdo/rules';
import { ObraProvider, useReferencia } from '@/components/rdo/reference';
import { RdoErro, RdoNaoEncontrado } from '@/components/rdo/query-error';

export const Route = createFileRoute('/_authenticated/historico')({
  validateSearch: (search: Record<string, unknown>) => ({ mes: typeof search.mes === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(search.mes) ? search.mes : '' }),
  loaderDeps: ({ search }) => ({ mes: search.mes }),
  loader: async ({ context, deps }) => { await Promise.all([
    context.queryClient.ensureQueryData(referenciaQuery(context.perfil.id)),
    context.queryClient.ensureInfiniteQueryData(historicoQuery(context.perfil.id, deps.mes)),
  ]); },
  head: () => ({ meta: [
    { title: 'Histórico de RDOs | Diário de Obra' },
    { name: 'description', content: 'Consulte os relatórios diários da obra por mês, número e data, com status e efetivo.' },
    { property: 'og:title', content: 'Histórico de RDOs | Diário de Obra' },
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
  return <main className="mx-auto max-w-4xl px-4 py-8">
    <h1 className="mb-6 font-display text-3xl font-bold uppercase">Histórico de RDOs</h1>
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <label className="text-sm font-semibold">Mês<input aria-label="Mês" className="field mt-1" type="month" value={mes} onChange={e => void navigate({ to: '/historico', search: { mes: e.target.value } })} /></label>
      {mes && <Button variant="ghost" onClick={() => void navigate({ to: '/historico', search: { mes: '' } })}>Todos os meses</Button>}
      <form className="flex min-w-0 items-end gap-2" onSubmit={e => { e.preventDefault(); buscar(); }}><label className="min-w-0 text-sm font-semibold">Ir para o nº<input aria-label="Ir para o nº" inputMode="numeric" className="field mt-1" value={numero} onChange={e => setNumero(e.target.value)} /></label><Button type="submit" variant="outline" size="icon" aria-label="Buscar RDO"><Search /></Button></form>
    </div>
    <div className="divide-y border-y">
      {rows.map(row => <Link key={row.id} to="/rdo/$data" params={{ data: row.data }} className="flex flex-wrap items-center gap-3 py-4 hover:bg-muted">
        <div className="min-w-0 flex-1"><h2 className="font-semibold">RDO nº {row.numero}</h2><p className="text-sm text-muted-foreground">{fmtData(row.data)} — {diaSemana(row.data)}</p></div>
        <span className="text-sm">{row.status === 'fechado' ? 'Fechado' : 'Aberto'}</span><span className="text-sm">Efetivo: <b>{row.total}</b></span><ChevronRight className="size-4" />
      </Link>)}
      {!rows.length && <p className="py-8 text-muted-foreground">Nenhum RDO disponível neste período.</p>}
    </div>
    {query.hasNextPage && <Button className="mt-6" variant="outline" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage().catch(e => toast.error(mensagemErro(e)))}>{query.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}</Button>}
    {query.isFetchNextPageError && <p role="alert" className="mt-3 text-sm text-destructive">{mensagemErro(query.error)}</p>}
  </main>;
}