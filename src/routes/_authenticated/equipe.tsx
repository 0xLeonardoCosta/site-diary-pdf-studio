import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Plus, KeyRound, UserRoundCog, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PERMISSOES, permissoesVazias, senhaValida, type Perfil, type Permissao, type Permissoes } from '@/lib/auth-rules';
import { carregarPerfil } from '@/lib/auth-session';
import { useAuth } from '@/components/auth-context';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const equipeQuery = queryOptions({
  queryKey: ['equipe'],
  queryFn: async () => {
    const perfil = await carregarPerfil();
    if (perfil?.role !== 'admin') throw new Error('Acesso restrito ao administrador.');
    const { data, error } = await supabase.from('profiles').select('*').order('nome');
    if (error) throw error;
    return data;
  },
});
export const Route = createFileRoute('/_authenticated/equipe')({
  loader: async ({ context }) => {
    if (context.perfil.role !== 'admin') return;
    await context.queryClient.ensureQueryData(equipeQuery);
  },
  head: () => ({ meta: [
    { title: 'Equipe | Diário de Obra' },
    { name: 'description', content: 'Administração dos usuários e permissões da equipe da obra.' },
    { property: 'og:title', content: 'Equipe | Diário de Obra' },
    { property: 'og:description', content: 'Administração dos usuários e permissões da equipe da obra.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Equipe,
});
function Equipe() {
  const { perfil } = useAuth();
  if (!perfil) return <p className="p-6">Carregando…</p>;
  if (perfil.role !== 'admin') return <p role="alert" className="p-6">Acesso restrito ao administrador.</p>;
  return <EquipeAdmin />;
}
type Editor = { tipo: 'criar' } | { tipo: 'permissoes' | 'senha'; usuario: Perfil };
function EquipeAdmin() {
  const { data: usuarios } = useSuspenseQuery(equipeQuery);
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  async function executar(body: Record<string, unknown>) {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', { body });
      if (error) {
        const response = 'context' in error ? error.context : null;
        if (response instanceof Response) {
          const result = await response.clone().json().catch(() => null);
          if (result?.erro) throw new Error(result.erro);
        }
        throw error;
      }
      if (data?.erro) throw new Error(data.erro);
      if (data?.ok !== true) throw new Error('Não foi possível concluir a ação.');
      toast.success('Alteração realizada.');
      setEditor(null);
      await queryClient.invalidateQueries({ queryKey: ['equipe'] });
      await refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-4xl px-4 py-8">
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <h1 className="font-display text-3xl font-bold uppercase">Equipe</h1>
      <Button disabled={busy} onClick={() => setEditor({ tipo: 'criar' })}><Plus />Novo usuário</Button>
    </div>
    <div className="divide-y border-y">
      {usuarios.map(usuario => <article key={usuario.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div><h2 className="font-semibold">{usuario.nome}</h2><p className="text-sm text-muted-foreground">{usuario.role === 'admin' ? 'Administrador' : usuario.role === 'preenchedor' ? 'Preenchedor' : usuario.role} · {usuario.ativo ? 'Ativo' : 'Inativo'}</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={busy} onClick={() => setEditor({ tipo: 'permissoes', usuario })}><UserRoundCog />Permissões</Button>
          <Button variant="outline" disabled={busy} onClick={() => setEditor({ tipo: 'senha', usuario })}><KeyRound />Redefinir senha</Button>
          <label className="flex items-center gap-2 px-2 text-sm"><Switch disabled={busy} checked={usuario.ativo} aria-label={`Conta ativa de ${usuario.nome}`} onCheckedChange={ativo => void executar({ acao: 'ativar_desativar', id: usuario.id, ativo })} />Ativo</label>
        </div>
      </article>)}
      {!usuarios.length && <p className="py-6 text-muted-foreground">Nenhum usuário encontrado.</p>}
    </div>
    <Dialog open={Boolean(editor)} onOpenChange={open => { if (!open && !busy) setEditor(null); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editor?.tipo === 'criar' ? 'Novo usuário' : editor?.tipo === 'senha' ? 'Redefinir senha' : 'Permissões'}</DialogTitle></DialogHeader>
        {editor && <EditorUsuario key={editor.tipo === 'criar' ? 'novo' : `${editor.tipo}-${editor.usuario.id}`} editor={editor} busy={busy} executar={executar} />}
      </DialogContent>
    </Dialog>
  </main>;
}
function EditorUsuario({ editor, busy, executar }: { editor: Editor; busy: boolean; executar: (body: Record<string, unknown>) => Promise<void> }) {
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [permissoes, setPermissoes] = useState<Permissoes>(() => editor.tipo === 'permissoes' ? Object.fromEntries(Object.keys(PERMISSOES).map(key => [key, editor.usuario[key as Permissao]])) as Permissoes : permissoesVazias());
  function salvar(event: FormEvent) {
    event.preventDefault();
    if (editor.tipo !== 'permissoes' && !senhaValida(senha)) { toast.error('A senha deve ter no mínimo 8 caracteres.'); return; }
    if (editor.tipo === 'criar') { void executar({ acao: 'criar', nome: nome.trim(), senha, permissoes }); }
    else if (editor.tipo === 'senha') { void executar({ acao: 'redefinir_senha', id: editor.usuario.id, senha }); }
    else { void executar({ acao: 'atualizar_permissoes', id: editor.usuario.id, permissoes }); }
  }
  return <form className="space-y-5" onSubmit={salvar}>
    {editor.tipo !== 'criar' && <p className="font-semibold">{editor.usuario.nome}</p>}
    {editor.tipo === 'criar' && <label className="block text-sm font-semibold">Nome completo<input className="field mt-2" required value={nome} onChange={e => setNome(e.target.value)} /></label>}
    {editor.tipo !== 'permissoes' && <label className="block text-sm font-semibold">Senha (mínimo 8 caracteres)<input className="field mt-2" type="password" autoComplete="new-password" required minLength={8} value={senha} onChange={e => setSenha(e.target.value)} /></label>}
    {editor.tipo !== 'senha' && <div className="divide-y">{Object.entries(PERMISSOES).map(([key, label]) => <label key={key} className="flex items-center justify-between gap-4 py-3 text-sm"><span>{label}</span><Switch aria-label={label} checked={permissoes[key as Permissao]} onCheckedChange={checked => setPermissoes(p => ({ ...p, [key]: checked }))} /></label>)}</div>}
    <Button disabled={busy} type="submit" className="w-full">{busy ? 'Salvando…' : 'Salvar'}</Button>
  </form>;
}