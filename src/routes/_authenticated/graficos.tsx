import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Cronograma } from '@/components/rdo/cronograma';
import { GraficoEfetivo } from '@/components/rdo/grafico-efetivo';
import { RdoErro, RdoNaoEncontrado } from '@/components/rdo/query-error';
import { cronogramaQuery, efetivoDiarioQuery, frentesQuery } from '@/lib/rdo/queries';

export const Route = createFileRoute('/_authenticated/graficos')({
  loader: async ({ context }) => { await Promise.all([
    context.queryClient.ensureQueryData(efetivoDiarioQuery(context.perfil.id)),
    context.queryClient.ensureQueryData(cronogramaQuery(context.perfil.id)),
    context.queryClient.ensureQueryData(frentesQuery(context.perfil.id)),
  ]); },
  head: () => ({ meta: [
    { title: 'Gráficos | RDO360' },
    { name: 'description', content: 'Efetivo da mão de obra e cronograma das atividades executadas.' },
    { property: 'og:title', content: 'Gráficos | RDO360' },
    { property: 'og:description', content: 'Efetivo da mão de obra e cronograma das atividades executadas.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Graficos, errorComponent: RdoErro, notFoundComponent: RdoNaoEncontrado,
});
const ABAS = [{ id: 'cronograma', rotulo: 'Cronograma de atividades' }, { id: 'efetivo', rotulo: 'Efetivo' }] as const;
function Graficos() {
  const { perfil } = Route.useRouteContext();
  const navigate = useNavigate();
  const [aba, setAba] = useState<(typeof ABAS)[number]['id']>('cronograma');
  const { data: efetivo } = useSuspenseQuery(efetivoDiarioQuery(perfil.id));
  const { data: cronograma } = useSuspenseQuery(cronogramaQuery(perfil.id));
  const { data: frentes } = useSuspenseQuery(frentesQuery(perfil.id));
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase">Gráficos</h1>
        <p className="text-sm text-muted-foreground">A partir dos RDOs que você pode ver.</p>
      </div>
      <div role="tablist" aria-label="Gráficos" className="flex gap-1 border-b">
        {ABAS.map(a => (
          <button key={a.id} role="tab" type="button" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${aba === a.id ? 'border-safety text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {a.rotulo}
          </button>
        ))}
      </div>
      {aba === 'cronograma'
        ? <Cronograma rdos={cronograma.rdos} atividades={cronograma.atividades} frentes={frentes} aoAbrirDia={data => void navigate({ to: '/rdo/$data', params: { data } })} />
        : <GraficoEfetivo pontos={efetivo} />}
    </main>
  );
}
