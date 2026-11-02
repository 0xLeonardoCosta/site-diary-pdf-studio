import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, LockOpen } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissao } from '@/components/auth-context';
import { Button } from '@/components/ui/button';
import type { RdoBanco } from '@/lib/rdo/queries';
import { mensagemErro } from '@/lib/rdo/rules';
import { salvarCampo } from '@/lib/rdo/salvar';
import { useSincronia } from '@/lib/rdo/sincronia';

export function FecharRdo({ rdo, userId }: { rdo: Pick<RdoBanco, 'id' | 'numero' | 'status'>; userId: string }) {
  const permitido = usePermissao('fechar_reabrir');
  const sincronia = useSincronia();
  const client = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  if (!permitido) return null;
  const fechado = rdo.status === 'fechado';
  async function alternar() {
    const pergunta = fechado
      ? `Reabrir o RDO nº ${rdo.numero}? Os lançamentos voltam a poder ser alterados.`
      : `Fechar o RDO nº ${rdo.numero}? Só quem tem permissão de fechar e reabrir poderá alterá-lo.`;
    if (!confirm(pergunta)) return;
    setOcupado(true);
    try {
      await salvarCampo('rdos', rdo.id, 'status', rdo.status, fechado ? 'aberto' : 'fechado');
      toast.success(fechado ? 'RDO reaberto.' : 'RDO fechado.');
    } catch (error) { toast.error(mensagemErro(error)); }
    finally {
      await client.invalidateQueries({ queryKey: ['rdo', userId] });
      setOcupado(false);
    }
  }
  // Closing while a field is still saving would lock that write out.
  return <Button variant="outline" disabled={ocupado || sincronia === 'salvando'} onClick={() => void alternar()}>{fechado ? <LockOpen /> : <Lock />}{fechado ? 'Reabrir RDO' : 'Fechar RDO'}</Button>;
}
