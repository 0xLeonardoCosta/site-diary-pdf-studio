import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const TABELAS = ['obra', 'frentes', 'rdos', 'mao_obra', 'equipamentos', 'atividades', 'anotacoes', 'fotos'] as const;

// Realtime only signals that something changed; the data is always re-read through RLS.
// Unfiltered on purpose: DELETE events cannot be filtered, and one site's change volume is small.
export function useRdoTempoReal(userId: string) {
  const client = useQueryClient();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reler = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // Signed photo URLs stay valid; re-signing them would only make the images flicker.
        void client.invalidateQueries({ predicate: q => q.queryKey[0] === 'rdo' && q.queryKey[1] === userId && q.queryKey[2] !== 'fotos-url' });
      }, 300);
    };
    const canal = supabase.channel(`rdo360-${userId}`);
    for (const table of TABELAS) canal.on('postgres_changes', { event: '*', schema: 'public', table }, reler);
    // Also covers whatever changed while the connection was down.
    canal.subscribe(status => { if (status === 'SUBSCRIBED') reler(); });
    return () => { clearTimeout(timer); void supabase.removeChannel(canal); };
  }, [client, userId]);
}
