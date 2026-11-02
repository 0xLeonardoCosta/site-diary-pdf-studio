import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, usePermissao } from '@/components/auth-context';
import { Button } from '@/components/ui/button';
import type { RdoBanco } from '@/lib/rdo/queries';
import { mensagemErro } from '@/lib/rdo/rules';
import { assinarRdo, removerAssinaturaRdo } from '@/lib/rdo/salvar';
import { useSincronia } from '@/lib/rdo/sincronia';

const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function AssinarRdo({ rdo, userId, url }: { rdo: RdoBanco; userId: string; url: string | null }) {
  const { perfil } = useAuth();
  const alterarAssinados = usePermissao('alterar_assinados');
  const client = useQueryClient();
  const sincronia = useSincronia();
  const [ocupado, setOcupado] = useState(false);
  async function executar(acao: () => Promise<unknown>, sucesso: string) {
    setOcupado(true);
    try { await acao(); toast.success(sucesso); }
    catch (error) { toast.error(mensagemErro(error)); }
    finally {
      await client.invalidateQueries({ queryKey: ['rdo', userId] });
      setOcupado(false);
    }
  }
  if (rdo.assinado_em) {
    const podeRemover = perfil?.role === 'admin' || perfil?.id === rdo.assinado_por;
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
        {url && <div className="flex h-16 w-40 shrink-0 items-center justify-center rounded-md border bg-white p-1"><img src={url} alt={`Assinatura de ${rdo.assinado_nome}`} className="max-h-full max-w-full object-contain" /></div>}
        <div className="min-w-0 text-sm">
          <p className="font-semibold">Assinado por: {rdo.assinado_nome}</p>
          <p className="text-muted-foreground">{dataHora(rdo.assinado_em)}. {alterarAssinados ? 'Você tem permissão para alterar este RDO mesmo assinado.' : 'Este RDO está travado para alterações.'}</p>
        </div>
        {podeRemover && <Button variant="outline" className="ml-auto" disabled={ocupado} onClick={() => { if (confirm(`Remover a assinatura do RDO nº ${rdo.numero}?`)) void executar(() => removerAssinaturaRdo(rdo.id), 'Assinatura removida.'); }}>Remover assinatura</Button>}
      </div>
    );
  }
  if (!perfil?.assinatura_path) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
      <p className="min-w-0 flex-1 text-sm text-muted-foreground">Confira o relatório antes de assinar. Depois de assinado, ele fica travado para alterações.</p>
      {/* A field still saving would be locked out by the signature. */}
      <Button disabled={ocupado || sincronia === 'salvando'} onClick={() => { if (confirm(`Assinar o RDO nº ${rdo.numero} como ${perfil.nome}?`)) void executar(() => assinarRdo(rdo.id), 'RDO assinado.'); }}><PenLine />{ocupado ? 'Assinando…' : 'Assinar RDO'}</Button>
    </div>
  );
}
