import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { usePermissao } from '@/components/auth-context';
import { DadosObra } from '@/components/rdo/dados-obra';
import { RdoErro, RdoNaoEncontrado } from '@/components/rdo/query-error';
import { useRdoTempoReal } from '@/hooks/use-rdo-tempo-real';
import { obraQuery } from '@/lib/rdo/queries';

export const Route = createFileRoute('/_authenticated/dados')({
  loader: ({ context }) => context.queryClient.ensureQueryData(obraQuery(context.perfil.id)),
  head: () => ({ meta: [
    { title: 'Dados da obra | RDO360' },
    { name: 'description', content: 'Dados contratuais e logo que aparecem em todos os RDOs da obra.' },
    { property: 'og:title', content: 'Dados da obra | RDO360' },
    { property: 'og:description', content: 'Dados contratuais e logo que aparecem em todos os RDOs da obra.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Dados, errorComponent: RdoErro, notFoundComponent: RdoNaoEncontrado,
});
function Dados() {
  const { perfil } = Route.useRouteContext();
  const permitido = usePermissao('editar_obra');
  const { data: obra } = useSuspenseQuery(obraQuery(perfil.id));
  useRdoTempoReal(perfil.id);
  if (!permitido) return <p role="alert" className="p-6">Acesso restrito a quem pode editar os dados da obra.</p>;
  return <DadosObra obra={obra} userId={perfil.id} editavel={permitido} />;
}
