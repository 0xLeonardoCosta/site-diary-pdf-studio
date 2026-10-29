import { useEffect } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useQueryErrorResetBoundary, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { mensagemErro } from '@/lib/rdo/rules';

export function RdoErro({ error }: { error: unknown }) {
  const router = useRouter();
  const { reset } = useQueryErrorResetBoundary();
  const client = useQueryClient();
  useEffect(() => { toast.error(mensagemErro(error)); }, [error]);
  return <main className="mx-auto max-w-4xl space-y-4 px-4 py-8"><h1 className="font-display text-2xl font-bold">Não foi possível carregar os dados</h1><p role="alert">{mensagemErro(error)}</p><Button onClick={() => { reset(); void client.resetQueries({ queryKey: ['rdo'] }).then(() => router.invalidate()); }}>Tentar novamente</Button></main>;
}
export function RdoNaoEncontrado() { return <p className="p-6">RDO não encontrado.</p>; }