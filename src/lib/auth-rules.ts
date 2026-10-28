import type { Database } from '@/integrations/supabase/types';

const DOMINIO_EMAIL = 'diario.example.com';
export function nomeParaEmail(nome: string) {
  const slug = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .trim().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  return `${slug}@${DOMINIO_EMAIL}`;
}

export const PERMISSOES = {
  ver_todos_rdos: 'Ver todos os RDOs',
  editar_obra: 'Editar dados da obra e frentes',
  lancar_mao_obra: 'Lançar mão de obra',
  lancar_equipamentos: 'Lançar equipamentos',
  lancar_clima: 'Clima, pluviômetro e maré',
  lancar_atividades: 'Lançar atividades, ocorrências, segurança e fotos',
  editar_de_outros: 'Editar/excluir lançamento de outra pessoa',
  fechar_reabrir: 'Fechar e reabrir RDO (e assinaturas)',
  alterar_numero_data: 'Alterar número/data do RDO',
  exportar_pdf: 'Exportar PDF',
} as const;
export type Permissao = keyof typeof PERMISSOES;
export type Permissoes = Record<Permissao, boolean>;
export type Perfil = Database['public']['Tables']['profiles']['Row'];
export const permissoesVazias = (): Permissoes => Object.fromEntries(
  Object.keys(PERMISSOES).map(key => [key, false]),
) as Permissoes;
export function pode(perfil: Perfil | null, permissao: Permissao) {
  return Boolean(perfil?.ativo && (perfil.role === 'admin' || perfil[permissao]));
}
export function senhaValida(senha: string) { return senha.length >= 8; }