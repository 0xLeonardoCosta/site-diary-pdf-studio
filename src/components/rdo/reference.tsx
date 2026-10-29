import { createContext, useContext, type ReactNode } from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { referenciaQuery } from '@/lib/rdo/queries';

const ObraContext = createContext<{ ref_numero: number; ref_data: string } | null>(null);
export function ObraProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const { data } = useSuspenseQuery(referenciaQuery(userId));
  return <ObraContext.Provider value={data}>{children}</ObraContext.Provider>;
}
export function useReferencia() {
  const ref = useContext(ObraContext);
  if (!ref) throw new Error('Referência da obra indisponível.');
  return ref;
}