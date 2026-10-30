import { Link, useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Users, ClipboardList, History } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from './auth-context';
import { supabase } from '@/integrations/supabase/client';

export function AccountHeader() {
  const { perfil } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    const { error } = await supabase.auth.signOut();
    if (error) { toast.error(error.message); return; }
    await navigate({ to: '/auth', replace: true });
  }
  return <div className="no-print border-b bg-card">
    <nav aria-label="Conta" className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-4 py-3">
      <Button variant="ghost" asChild><Link to="/"><ClipboardList />RDO</Link></Button>
      <Button variant="ghost" asChild><Link to="/historico" search={{ mes: '' }}><History />Histórico</Link></Button>
      {perfil?.role === 'admin' && <Button variant="ghost" asChild><Link to="/equipe"><Users />Equipe</Link></Button>}
      <span className="ml-auto max-w-full break-words text-sm font-semibold">{perfil?.nome}</span>
      <Button variant="outline" onClick={sair}><LogOut />Sair</Button>
    </nav>
  </div>;
}