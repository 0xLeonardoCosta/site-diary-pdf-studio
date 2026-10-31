import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { mensagemErro } from '@/lib/rdo/rules';
import { iniciarEnvio, terminarEnvio } from '@/lib/rdo/sincronia';

type Opcoes<T> = {
  /** Debounce in ms; null saves only through `confirmar` (partial numbers and dates would save mid-typing). */
  atraso?: number | null;
  /** While false the debounce waits; `confirmar` still submits, so invalid input is reported on blur. */
  pronto?: (valor: T) => boolean;
};

/**
 * Local value of one saved field. Shows typing immediately, saves with a debounce, and accepts
 * server updates only while the user has nothing unsaved. `salvar` receives the value the edit
 * started from, which is what lets the database refuse a stale write.
 */
export function useCampo<T>(servidor: T, salvar: (valor: T, base: T) => Promise<T>, { atraso = 700, pronto }: Opcoes<T> = {}) {
  const client = useQueryClient();
  const [valor, setValor] = useState(servidor);
  const ref = useRef({ valor: servidor, base: servidor, servidor, sujo: false, enviando: false, ocupado: false, montado: true, timer: undefined as ReturnType<typeof setTimeout> | undefined, salvar, pronto, atraso });
  Object.assign(ref.current, { servidor, salvar, pronto, atraso });

  const chave = JSON.stringify(servidor);
  useEffect(() => {
    const s = ref.current;
    if (s.sujo || s.enviando) return;
    s.base = s.servidor; s.valor = s.servidor; setValor(s.servidor);
  }, [chave]);

  const enviar = useCallback(async () => {
    const s = ref.current;
    clearTimeout(s.timer); s.timer = undefined;
    if (!s.sujo || s.enviando) return;
    s.enviando = true; s.sujo = false;
    let ok = true;
    try {
      const salvo = await s.salvar(s.valor, s.base);
      s.base = salvo;
      if (!s.sujo) { s.valor = salvo; if (s.montado) setValor(salvo); }
    } catch (error) {
      ok = false; s.sujo = false; clearTimeout(s.timer);
      s.valor = s.servidor; s.base = s.servidor;
      if (s.montado) setValor(s.servidor);
      toast.error(mensagemErro(error));
      void client.invalidateQueries({ queryKey: ['rdo'] });
    }
    s.enviando = false;
    if (s.sujo) { void enviar(); return; }
    s.ocupado = false;
    terminarEnvio(ok);
  }, [client]);

  const alterar = useCallback((novo: T) => {
    const s = ref.current;
    s.valor = novo; s.sujo = true; setValor(novo);
    if (!s.ocupado) { s.ocupado = true; iniciarEnvio(); }
    clearTimeout(s.timer);
    if (s.atraso === null) return;
    s.timer = setTimeout(() => { if (!s.pronto || s.pronto(s.valor)) void enviar(); }, s.atraso);
  }, [enviar]);

  // Leaving the day or section submits what is pending instead of dropping it.
  useEffect(() => {
    const s = ref.current;
    s.montado = true;
    return () => { s.montado = false; void enviar(); };
  }, [enviar]);

  return { valor, alterar, confirmar: enviar };
}
