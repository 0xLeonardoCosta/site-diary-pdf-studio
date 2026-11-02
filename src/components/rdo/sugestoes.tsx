import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sugestoesQuery } from '@/lib/rdo/queries';
import { fmtData } from '@/lib/rdo/rules';

// Suggests descriptions already used on the selected work front; anything typed stays valid and nothing fills itself in.
export function DescricaoComSugestoes({ userId, frente, valor, alterar, enviar }: { userId: string; frente: string; valor: string; alterar: (v: string) => void; enviar: () => void }) {
  const lista = useId();
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [busca, setBusca] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setBusca(valor.trim()), 200);
    return () => clearTimeout(timer);
  }, [valor]);
  const { data = [] } = useQuery(sugestoesQuery(userId, frente, busca));
  const opcoes = data.filter(s => s.descricao !== valor.trim());
  const visivel = aberto && opcoes.length > 0;
  const escolher = (descricao: string) => { alterar(descricao); setAberto(false); setAtivo(-1); };
  function teclado(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setAberto(false); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      const opcao = visivel ? opcoes[ativo] : undefined;
      if (opcao) escolher(opcao.descricao); else enviar();
      return;
    }
    if (!visivel || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    e.preventDefault();
    const passo = e.key === 'ArrowDown' ? 1 : -1;
    setAtivo(i => (i + passo + opcoes.length) % opcoes.length);
  }
  return (
    <div className="relative min-w-0 flex-1">
      <input
        role="combobox" aria-label="Nova atividade" aria-expanded={visivel} aria-controls={lista} aria-autocomplete="list" autoComplete="off"
        className="field" placeholder={frente ? 'Nova atividade' : 'Selecione o local para ver sugestões'} value={valor}
        onChange={e => { alterar(e.target.value); setAberto(true); setAtivo(-1); }}
        onFocus={() => setAberto(true)} onBlur={() => setAberto(false)} onKeyDown={teclado}
      />
      {visivel && (
        <ul id={lista} role="listbox" aria-label="Sugestões anteriores" className="absolute z-20 mt-1 max-h-56 w-full min-w-64 overflow-auto rounded-md border bg-card shadow-lg">
          {opcoes.map((s, i) => (
            // mousedown would blur the input and close the list before the click lands.
            <li key={s.descricao} role="option" aria-selected={i === ativo} onMouseDown={e => e.preventDefault()} onClick={() => escolher(s.descricao)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-2 text-sm hover:bg-muted ${i === ativo ? 'bg-muted' : ''}`}>
              <span className="min-w-0">{s.descricao}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{fmtData(s.ultima_vez)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
