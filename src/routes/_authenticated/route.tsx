import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { toast } from 'sonner';
import { carregarPerfil } from '@/lib/auth-session';
import { AccountHeader } from '@/components/account-header';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async () => {
    let perfil;
    try { perfil = await carregarPerfil(); }
    catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
    if (!perfil) throw redirect({ to: '/auth', replace: true });
    return { perfil };
  },
  component: () => <><AccountHeader /><Outlet /></>,
});