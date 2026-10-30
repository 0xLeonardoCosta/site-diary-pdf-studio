import { createFileRoute, redirect } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { dataValida, hojeLocal, dataParaNumero, fmtData } from '@/lib/rdo/rules';
import { diaQuery, referenciaQuery } from '@/lib/rdo/queries';
import { ObraProvider, useReferencia } from '@/components/rdo/reference';
import { DayControls } from '@/components/rdo/day-controls';
import { DiaryForm } from '@/components/rdo/diary-form';
import { RdoErro, RdoNaoEncontrado } from '@/components/rdo/query-error';

export const Route = createFileRoute('/_authenticated/rdo/$data')({
  beforeLoad: ({ params }) => { if (!dataValida(params.data)) throw redirect({ to: '/rdo/$data', params: { data: hojeLocal() }, replace: true }); },
  loader: async ({ params, context }) => { await Promise.all([
    context.queryClient.ensureQueryData(referenciaQuery(context.perfil.id)),
    context.queryClient.ensureQueryData(diaQuery(context.perfil.id, params.data)),
  ]); },
  head: ({ params }) => ({ meta: [
    { title: `RDO ${fmtData(params.data)} | Diário de Obra` },
    { name: 'description', content: `Relatório diário de obra de ${fmtData(params.data)}, efetivo e impressão em PDF.` },
    { property: 'og:title', content: `RDO ${fmtData(params.data)} | Diário de Obra` },
    { property: 'og:description', content: 'Preenchimento do dia, mão de obra e relatório para impressão.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Dia, errorComponent: RdoErro, notFoundComponent: RdoNaoEncontrado,
});
function Dia() {
  const { perfil } = Route.useRouteContext();
  const { data } = Route.useParams();
  return <ObraProvider userId={perfil.id}><Conteudo key={`${perfil.id}:${data}`} date={data} userId={perfil.id} /></ObraProvider>;
}
function Conteudo({ date, userId }: { date: string; userId: string }) {
  const { data } = useSuspenseQuery(diaQuery(userId, date));
  const ref = useReferencia();
  const numero = dataParaNumero(date, ref.ref_numero, ref.ref_data);
  return <><div className="no-print"><DayControls key={`${date}:${data.rdo?.id ?? 'novo'}`} date={date} rdo={data.rdo} userId={userId} /></div><DiaryForm date={date} userId={userId} rdo={data.rdo} maoObra={data.maoObra} numero={numero} /></>;
}