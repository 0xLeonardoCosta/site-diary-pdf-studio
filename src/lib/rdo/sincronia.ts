import { useSyncExternalStore } from 'react';

export type EstadoSincronia = 'salvo' | 'salvando' | 'erro';
let pendentes = 0;
let erro = false;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach(ouvinte => ouvinte());
const estado = (): EstadoSincronia => (pendentes > 0 ? 'salvando' : erro ? 'erro' : 'salvo');
const assinar = (ouvinte: () => void) => { ouvintes.add(ouvinte); return () => { ouvintes.delete(ouvinte); }; };

export function iniciarEnvio() { pendentes += 1; avisar(); }
export function terminarEnvio(ok: boolean) { pendentes = Math.max(0, pendentes - 1); erro = !ok; avisar(); }
export const useSincronia = () => useSyncExternalStore(assinar, estado, () => 'salvo' as EstadoSincronia);
