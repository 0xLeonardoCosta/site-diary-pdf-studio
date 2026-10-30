import { createFileRoute, redirect } from '@tanstack/react-router';
import { hojeLocal } from '@/lib/rdo/rules';
export const Route = createFileRoute('/_authenticated/')({
  beforeLoad: () => { throw redirect({ to: '/rdo/$data', params: { data: hojeLocal() }, replace: true }); },
  head: () => ({ meta: [
    { title: 'RDO de hoje | Diário de Obra' },
    { name: 'description', content: 'Abra o relatório diário de obra de hoje.' },
    { property: 'og:title', content: 'RDO de hoje | Diário de Obra' },
    { property: 'og:description', content: 'Acesso ao relatório diário de obra de hoje.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
});