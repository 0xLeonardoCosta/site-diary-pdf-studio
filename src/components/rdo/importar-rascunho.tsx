import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { FrenteBanco, ObraBanco, RdoBanco } from '@/lib/rdo/queries';
import { importarRascunho, lerRascunho, type Rascunho } from '@/lib/rdo/rascunho';
import { chaveLocal, mensagemErro } from '@/lib/rdo/rules';

const ler = (date: string) => { try { return lerRascunho(localStorage.getItem(chaveLocal(date))); } catch { return null; } };

export function ImportarRascunho({ date, rdo, obra, frentes }: { date: string; rdo: RdoBanco; obra: ObraBanco; frentes: FrenteBanco[] }) {
  const client = useQueryClient();
  const [rascunho, setRascunho] = useState<Rascunho | null>(() => ler(date));
  const [ocupado, setOcupado] = useState(false);
  if (!rascunho) return null;
  const guardar = (resto: Rascunho | null) => {
    try {
      if (resto) localStorage.setItem(chaveLocal(date), JSON.stringify(resto));
      else localStorage.removeItem(chaveLocal(date));
    } catch { /* The banner reappears on the next visit. */ }
    setRascunho(resto);
  };
  async function importar() {
    if (!rascunho) return;
    setOcupado(true);
    try {
      const resto = await importarRascunho(rascunho, rdo, obra, frentes);
      const sobrou = Object.keys(resto).length > 0;
      guardar(sobrou ? resto : null);
      if (sobrou) toast.error('Parte do rascunho não foi importada. Confira o que restou abaixo.');
      else toast.success('Rascunho importado para o banco.');
      await client.invalidateQueries({ queryKey: ['rdo'] });
    } catch (error) { toast.error(mensagemErro(error)); }
    finally { setOcupado(false); }
  }
  const semLocal = (rascunho.atividades ?? []).map(x => x.a).filter(Boolean);
  return (
    <section role="status" className="rounded-xl border-2 border-safety bg-accent p-4 text-sm text-accent-foreground">
      <p className="font-semibold">Este navegador guarda dados deste dia que ainda não estão no banco.</p>
      <p className="mt-1">Importar só preenche o que está vazio; nada que já foi lançado é substituído.</p>
      {semLocal.length > 0 && <p className="mt-1">Atividades que precisam de local e não são importadas sozinhas: {semLocal.join('; ')}.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button disabled={ocupado} onClick={() => void importar()}>{ocupado ? 'Importando…' : 'Importar para o banco'}</Button>
        <Button variant="outline" disabled={ocupado} onClick={() => { if (confirm('Descartar os dados deste navegador? Isso não pode ser desfeito.')) guardar(null); }}>Descartar</Button>
      </div>
    </section>
  );
}
