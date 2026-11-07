import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { GraficoEfetivo } from '@/components/rdo/grafico-efetivo';
import { RdoErro, RdoNaoEncontrado } from '@/components/rdo/query-error';
import { efetivoDiarioQuery } from '@/lib/rdo/queries';

export const Route = createFileRoute('/_authenticated/graficos')({
  loader: ({ context }) => context.queryClient.ensureQueryData(efetivoDiarioQuery(context.perfil.id)),
  head: () => ({ meta: [
    { title: 'Gráficos | RDO360' },
    { name: 'description', content: 'Efetivo da mão de obra por dia, semana e mês.' },
    { property: 'og:title', content: 'Gráficos | RDO360' },
    { property: 'og:description', content: 'Efetivo da mão de obra por dia, semana e mês.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Graficos, errorComponent: RdoErro, notFoundComponent: RdoNaoEncontrado,
});
function Graficos() {
  const { perfil } = Route.useRouteContext();
  const { data } = useSuspenseQuery(efetivoDiarioQuery(perfil.id));
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase">Gráficos</h1>
        <p className="text-sm text-muted-foreground">Efetivo da mão de obra ao longo do tempo, a partir dos RDOs que você pode ver.</p>
      </div>
      <GraficoEfetivo pontos={data} />
    </main>
  );
}
