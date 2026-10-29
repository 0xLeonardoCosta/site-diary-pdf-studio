import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { usePermissao } from '@/components/auth-context';
import { supabase } from '@/integrations/supabase/client';
import type { MaoObraBanco, RdoBanco } from '@/lib/rdo/queries';
import { diaQuery } from '@/lib/rdo/queries';
import { CATEGORIAS, ROTULOS, mensagemErro, normalizarFuncao, podeEditarMaoObra, quantidadeValida, totalCategoria, totalEfetivo, type Categoria } from '@/lib/rdo/rules';

type Linha = { id: string; funcao: string; categoria: string; quantidade: number; nova?: boolean };
export function MaoObra({ rdo, rows, userId, date }: { rdo: RdoBanco | null; rows: MaoObraBanco[]; userId: string; date: string }) {
  const lancar = usePermissao('lancar_mao_obra');
  const fechar = usePermissao('fechar_reabrir');
  const editavel = Boolean(rdo) && podeEditarMaoObra(lancar, rdo?.status, fechar);
  const [novas, setNovas] = useState<Linha[]>([]);
  const client = useQueryClient();
  const key = diaQuery(userId, date).queryKey;
  const busy = useRef(new Set<string>());
  const todas = [...rows, ...novas];
  const atualizarCache = (alterar: (linhas: MaoObraBanco[]) => MaoObraBanco[]) => {
    client.setQueryData<{ rdo: RdoBanco | null; maoObra: MaoObraBanco[] }>(key, old => old ? { ...old, maoObra: alterar(old.maoObra) } : old);
  };
  const salvar = useMutation({
    mutationFn: async ({ linha, remover }: { linha: Linha; remover?: boolean }) => {
      if (!rdo) throw new Error('Crie o RDO antes de lançar mão de obra.');
      if (remover) {
        const result = await supabase.from('mao_obra').delete().eq('id', linha.id).select('id').single();
        if (result.error) throw result.error;
        return null;
      }
      const values = { funcao: linha.funcao.trim(), categoria: linha.categoria, quantidade: linha.quantidade };
      const query = linha.nova
        ? supabase.from('mao_obra').insert({ ...values, rdo_id: rdo.id })
        : supabase.from('mao_obra').update(values).eq('id', linha.id);
      const result = await query.select('*').single();
      if (result.error) throw result.error;
      return result.data;
    },
  });
  async function persistir(linha: Linha, remover = false) {
    if (busy.current.has(linha.id) || !editavel) return false;
    if (remover && linha.nova) { setNovas(p => p.filter(r => r.id !== linha.id)); return true; }
    if (!remover) {
      const repetida = rows.find(r => r.id !== linha.id && r.categoria === linha.categoria && normalizarFuncao(r.funcao) === normalizarFuncao(linha.funcao));
      if (repetida && confirm(`Já existe ${repetida.funcao} em ${ROTULOS[linha.categoria as Categoria]}. Deseja editar a existente?`)) {
        document.getElementById(`funcao-${repetida.id}`)?.focus();
        if (linha.nova) setNovas(p => p.filter(r => r.id !== linha.id));
        return false;
      }
    }
    busy.current.add(linha.id);
    await client.cancelQueries({ queryKey: key });
    const anterior = rows.find(r => r.id === linha.id);
    if (anterior) atualizarCache(p => remover ? p.filter(r => r.id !== linha.id) : p.map(r => r.id === linha.id ? { ...r, ...linha } : r));
    // New rows are already visible as local optimistic entries.
    try {
      const result = await salvar.mutateAsync({ linha, remover });
      if (result) atualizarCache(p => linha.nova ? [...p, result] : p.map(r => r.id === result.id ? result : r));
      if (linha.nova) setNovas(p => p.filter(r => r.id !== linha.id));
      void client.invalidateQueries({ queryKey: ['rdo', userId, 'historico'] });
      return true;
    } catch (error) {
      if (anterior) atualizarCache(p => remover ? [...p, anterior] : p.map(r => r.id === linha.id ? anterior : r));
      toast.error(mensagemErro(error));
      return false;
    } finally { busy.current.delete(linha.id); }
  }
  return <div className="space-y-5">
    <div className="flex items-center justify-between border-b pb-3"><span className="font-semibold">Efetivo total</span><strong className="font-display text-3xl">{totalEfetivo(rows)}</strong></div>
    {!rdo && <p className="text-sm text-muted-foreground">Crie o RDO para lançar mão de obra.</p>}
    {CATEGORIAS.map(categoria => <div key={categoria} className="space-y-2">
      <div className="flex items-center justify-between"><h3 className="font-semibold">{ROTULOS[categoria]}</h3><span className="text-sm">Subtotal: <b>{totalCategoria(rows, categoria)}</b></span></div>
      {todas.filter(r => r.categoria === categoria).map(linha => <LinhaMaoObra key={linha.id} linha={linha} editavel={editavel} salvar={persistir} />)}
      {!todas.some(r => r.categoria === categoria) && <p className="text-sm text-muted-foreground">Nenhuma função registrada.</p>}
      {editavel && <Button variant="ghost" size="sm" onClick={() => setNovas(p => [...p, { id: crypto.randomUUID(), funcao: '', quantidade: 0, categoria, nova: true }])}><Plus />Adicionar função</Button>}
    </div>)}
  </div>;
}
function LinhaMaoObra({ linha, editavel, salvar }: { linha: Linha; editavel: boolean; salvar: (linha: Linha, remover?: boolean) => Promise<boolean> }) {
  const [funcao, setFuncao] = useState(linha.funcao);
  const [qtd, setQtd] = useState(String(linha.quantidade));
  const [estado, setEstado] = useState(linha.nova ? 'Não salvo' : 'Salvo');
  const emCurso = useRef(false);
  async function gravar(remover = false) {
    if (emCurso.current) return;
    if (!remover) {
      if (!funcao.trim()) { if (!linha.nova) { toast.error('Informe a função.'); setFuncao(linha.funcao); } return; }
      if (!quantidadeValida(qtd)) { toast.error('Quantidade deve ser um inteiro maior ou igual a zero.'); setQtd(String(linha.quantidade)); return; }
      if (!linha.nova && funcao.trim() === linha.funcao && Number(qtd) === linha.quantidade) return;
    }
    emCurso.current = true; setEstado('Salvando…');
    const ok = await salvar({ ...linha, funcao, quantidade: Number(qtd) }, remover);
    if (!ok) { setFuncao(linha.funcao); setQtd(String(linha.quantidade)); }
    setEstado(ok ? 'Salvo' : 'Não salvo'); emCurso.current = false;
  }
  return <div className="grid grid-cols-[minmax(0,1fr)_5rem_2.25rem] items-start gap-2">
    <div><input id={`funcao-${linha.id}`} aria-label={`Função ${ROTULOS[linha.categoria as Categoria]}`} className="field min-w-0" disabled={!editavel || estado === 'Salvando…'} value={funcao} onChange={e => { setFuncao(e.target.value); setEstado('Não salvo'); }} onBlur={() => void gravar()} /><span aria-live="polite" className="text-xs text-muted-foreground">{estado}</span></div>
    <input aria-label={`Quantidade ${funcao || ROTULOS[linha.categoria as Categoria]}`} className="field min-w-0" type="number" min="0" step="1" disabled={!editavel || estado === 'Salvando…'} value={qtd} onChange={e => { setQtd(e.target.value); setEstado('Não salvo'); }} onBlur={() => void gravar()} />
    {editavel && <Button variant="ghost" size="icon" disabled={estado === 'Salvando…'} aria-label={`Excluir ${funcao || 'função'}`} onClick={() => void gravar(true)}><Trash2 className="size-4" /></Button>}
  </div>;
}