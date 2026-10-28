import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { HardHat, LogIn } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { nomeParaEmail } from '@/lib/auth-rules';
import { carregarPerfil, CONTA_DESATIVADA } from '@/lib/auth-session';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/auth-context';

export const Route = createFileRoute('/auth')({
  head: () => ({ meta: [
    { title: 'Entrar | Diário de Obra' },
    { name: 'description', content: 'Acesso da equipe ao Relatório Diário de Obra.' },
    { property: 'og:title', content: 'Entrar | Diário de Obra' },
    { property: 'og:description', content: 'Acesso da equipe ao Relatório Diário de Obra.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Login,
});
function Login() {
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();
  async function entrar(event: FormEvent) {
    event.preventDefault(); setBusy(true); setErro('');
    try {
      const result = await supabase.auth.signInWithPassword({ email: nomeParaEmail(nome), password: senha });
      if (result.error) throw new Error('Nome ou senha incorretos.');
      const perfil = await carregarPerfil();
      if (!perfil) throw new Error('Nome ou senha incorretos.');
      await refresh();
      await navigate({ to: '/', replace: true });
    } catch (error) {
      setErro(error instanceof Error && error.message === CONTA_DESATIVADA ? CONTA_DESATIVADA : 'Nome ou senha incorretos.');
    } finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-background">
    <div className="stripes h-2" />
    <div className="mx-auto max-w-md px-6 py-20">
      <HardHat className="mb-6 size-12 text-accent-foreground" />
      <p className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Relatório diário</p>
      <h1 className="mb-10 font-display text-4xl font-bold uppercase">Diário de Obra</h1>
      <form onSubmit={entrar} className="space-y-5">
        <label className="block text-sm font-semibold">Nome<input className="field mt-2" autoComplete="username" value={nome} onChange={e => setNome(e.target.value)} required /></label>
        <label className="block text-sm font-semibold">Senha<input className="field mt-2" type="password" autoComplete="current-password" value={senha} onChange={e => setSenha(e.target.value)} required /></label>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" disabled={busy} className="w-full" size="lg"><LogIn />{busy ? 'Entrando…' : 'Entrar'}</Button>
      </form>
    </div>
  </main>;
}