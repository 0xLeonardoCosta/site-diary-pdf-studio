import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { carregarPerfil } from '@/lib/auth-session';
import { pode, type Perfil, type Permissao } from '@/lib/auth-rules';

const AuthContext = createContext<{ perfil: Perfil | null; refresh: () => Promise<void> }>({ perfil: null, refresh: async () => {} });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const refresh = async () => {
    try { setPerfil(await carregarPerfil()); }
    catch (error) { setPerfil(null); toast.error(error instanceof Error ? error.message : String(error)); }
  };
  useEffect(() => {
    let mounted = true;
    async function sync() {
      try { const next = await carregarPerfil(); if (mounted) setPerfil(next); }
      catch (error) { if (mounted) { setPerfil(null); toast.error(error instanceof Error ? error.message : String(error)); } }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (!['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED'].includes(event)) return;
      if (event === 'SIGNED_OUT') {
        setPerfil(null);
        void queryClient.cancelQueries().then(() => queryClient.clear());
        void router.navigate({ to: '/auth', replace: true });
      } else {
        // Do not await another Auth call inside the Auth listener's lock.
        queueMicrotask(() => { void sync(); void router.invalidate(); void queryClient.invalidateQueries(); });
      }
    });
    void sync();
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [router, queryClient]);
  return <AuthContext.Provider value={{ perfil, refresh }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
export function usePermissao(permissao: Permissao) { return pode(useAuth().perfil, permissao); }