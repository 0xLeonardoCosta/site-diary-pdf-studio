import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { fmtData, mensagemErro } from '@/lib/rdo/rules';
import { excluirRdos, resumoExclusao, type ResumoExclusao } from '@/lib/rdo/salvar';

export function ExcluirRdos({ userId, ids, aoExcluir }: { userId: string; ids: string[]; aoExcluir: () => void }) {
  const client = useQueryClient();
  const [resumo, setResumo] = useState<ResumoExclusao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  // Reads the selection first: it can include RDOs from months not loaded on screen.
  async function abrir() {
    setOcupado(true);
    try { setResumo(await resumoExclusao(ids)); }
    catch (error) { toast.error(mensagemErro(error)); }
    finally { setOcupado(false); }
  }
  async function confirmar() {
    if (!resumo) return;
    setOcupado(true);
    try {
      const total = await excluirRdos(resumo.rdos.map(r => r.id), resumo.caminhos);
      toast.success(total === 1 ? '1 RDO excluído.' : `${total} RDOs excluídos.`);
      setResumo(null);
      aoExcluir();
    } catch (error) { toast.error(mensagemErro(error)); }
    finally {
      await client.invalidateQueries({ queryKey: ['rdo', userId] });
      setOcupado(false);
    }
  }
  const rdos = resumo?.rdos ?? [];
  const assinados = rdos.filter(r => r.assinado_nome);
  const primeiro = rdos[0], ultimo = rdos[rdos.length - 1];
  return (
    <>
      <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={!ids.length || ocupado} onClick={() => void abrir()}><Trash2 />Excluir RDO's</Button>
      <AlertDialog open={Boolean(resumo)} onOpenChange={aberto => { if (!aberto && !ocupado) setResumo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{rdos.length === 1 ? 'Excluir 1 RDO?' : `Excluir ${rdos.length} RDOs?`}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {primeiro && ultimo && <p>{rdos.length === 1 ? `RDO nº ${primeiro.numero}, de ${fmtData(primeiro.data)}.` : `Do RDO nº ${primeiro.numero} (${fmtData(primeiro.data)}) ao nº ${ultimo.numero} (${fmtData(ultimo.data)}).`}</p>}
                <p>Serão apagados o RDO e tudo o que foi lançado nele: mão de obra, equipamentos, atividades, ocorrências e fotos.</p>
                {assinados.length > 0 && <p className="font-semibold text-destructive">{assinados.length === 1 ? 'Atenção: 1 destes RDOs já está assinado' : `Atenção: ${assinados.length} destes RDOs já estão assinados`}: {[...new Set(assinados.map(r => r.assinado_nome))].join(', ')}.</p>}
                <p className="font-semibold">Esta ação não pode ser desfeita pelo sistema.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ocupado}>Cancelar</AlertDialogCancel>
            {/* preventDefault keeps the dialog open until the deletion has finished. */}
            <AlertDialogAction disabled={ocupado} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={e => { e.preventDefault(); void confirmar(); }}>{ocupado ? 'Excluindo…' : 'Confirmar exclusão'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
