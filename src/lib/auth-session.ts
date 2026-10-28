import { supabase } from '@/integrations/supabase/client';
import type { Perfil } from './auth-rules';

export const CONTA_DESATIVADA = 'Conta desativada. Fale com o administrador.';
export async function carregarPerfil(): Promise<Perfil | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const result = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (result.error) throw new Error(result.error.message);
  if (!result.data.ativo) {
    await supabase.auth.signOut();
    throw new Error(CONTA_DESATIVADA);
  }
  return result.data;
}