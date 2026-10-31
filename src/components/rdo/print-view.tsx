import { Fragment, type ReactNode } from "react";
import { MARCA } from "@/lib/marca";
import type { DiaRdo, FrenteBanco, ObraBanco, RdoBanco } from "@/lib/rdo/queries";
import { CATEGORIAS, COLETAS, ROTULOS, TURNOS, climaIcone, diaSemana, fmtData, numeroParaTexto, ordenarPorFrente, totalCategoria, totalEfetivo } from "@/lib/rdo/rules";

export type DocumentoRdo = Omit<DiaRdo, "rdo"> & { rdo: RdoBanco; obra: ObraBanco; frentes: FrenteBanco[]; urls: Record<string, string> };

const fmt = (d: string | null) => (d ? fmtData(d) : "—");
const mareTxt = (r: RdoBanco) =>
  r.mare_max_hora || r.mare_max_nivel !== null ? `${r.mare_max_hora?.slice(0, 5) || "--:--"} - ${numeroParaTexto(r.mare_max_nivel) || "0"} m` : "—";

function PH({ n, children }: { n: number; children: ReactNode }) {
  return <div className="mb-1 mt-3 break-after-avoid border-l-4 border-safety bg-navy px-2 py-0.5 font-display text-sm font-bold uppercase text-navy-foreground">{n}. {children}</div>;
}
// Compact "name … qty" entries meant to flow across columns, so long lists fill the page width instead of one tall table.
function PLista({ itens }: { itens: { id: string; nome: string; qtd: ReactNode }[] }) {
  return <>{itens.map((x) => <div key={x.id} className="flex break-inside-avoid justify-between gap-2 border-b border-dotted px-1 py-px"><span className="min-w-0">{x.nome}</span><b>{x.qtd}</b></div>)}</>;
}
function PAnotacoes({ titulo, textos, recuo }: { titulo: string; textos: string[]; recuo?: boolean }) {
  if (!textos.length) return null;
  return (
    <>
      <div className={`font-semibold ${recuo ? "mt-1.5" : ""}`}>{titulo}</div>
      <div className="space-y-1">{textos.map((t, i) => <p key={i} className="whitespace-pre-wrap rounded border px-2 py-1">{t}</p>)}</div>
    </>
  );
}
export function PrintView({ doc }: { doc: DocumentoRdo }) {
  const { rdo: r, obra, maoObra, frentes, urls } = doc;
  const total = totalEfetivo(maoObra);
  const atividades = ordenarPorFrente(doc.atividades, frentes);
  const textos = (tipo: string) => doc.anotacoes.filter((a) => a.tipo === tipo && a.texto.trim()).map((a) => a.texto.trim());
  const ocorrencias = textos("ocorrencia"), seguranca = textos("seguranca");
  const fotos = r.fotos_no_pdf ? doc.fotos : [];
  const nomeFrente = (id: string) => frentes.find((f) => f.id === id)?.nome ?? "Sem local";
  return (
    <div className="print-only text-[11px] text-foreground">
      <div className="stripes h-2" />
      <div className="flex items-end justify-between bg-navy px-4 py-2.5 text-navy-foreground">
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-widest text-safety">{MARCA} – Diário de obra:</div>
          <div className="font-display text-2xl font-bold uppercase">{obra.nome}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-xl font-bold">RDO Nº {r.numero}</div>
          <div>{fmtData(r.data)} · {diaSemana(r.data)}</div>
        </div>
      </div>

      <PH n={1}>Dados da obra</PH>
      <table className="w-full border-collapse">
        <tbody>
          {[["Cliente", obra.cliente, "Contrato / ART", obra.contrato], ["Endereço", obra.endereco, "Resp. técnico", obra.responsavel_tecnico], ["Início", fmt(obra.data_inicio), "Prazo previsto", fmt(obra.prazo_previsto)]].map((l, i) => (
            <tr key={i} className="border-b">
              <td className="w-24 bg-muted px-2 py-0.5 font-semibold">{l[0]}</td><td className="px-2 py-0.5">{l[1] || "—"}</td>
              <td className="w-28 bg-muted px-2 py-0.5 font-semibold">{l[2]}</td><td className="px-2 py-0.5">{l[3] || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <PH n={2}>Condições climáticas · Horário: {r.horario_trabalho || "—"}</PH>
      <div className="grid grid-cols-7 gap-1.5">
        {TURNOS.map((t) => (
          <div key={t.rotulo} className="rounded border px-1 py-1 text-center">
            <div className="text-[8px] uppercase text-muted-foreground">{t.rotulo}</div>
            <div className="font-semibold">{r[t.coluna] ? `${climaIcone(t.rotulo, r[t.coluna] ?? "")} ${r[t.coluna]}` : "—"}</div>
          </div>
        ))}
        {COLETAS.map((c) => (
          <div key={c.hora} className="rounded border px-1 py-1 text-center">
            <div className="text-[8px] uppercase text-muted-foreground">Pluviôm. {c.hora}</div>
            <div className="font-semibold">{r[c.coluna] !== null ? `${numeroParaTexto(r[c.coluna])} mm` : "—"}</div>
          </div>
        ))}
        <div className="rounded border border-safety px-1 py-1 text-center">
          <div className="text-[8px] uppercase text-muted-foreground">Maré máxima</div>
          <div className="font-semibold">{mareTxt(r)}</div>
        </div>
      </div>

      <PH n={3}>Mão de obra · {CATEGORIAS.map((c) => `${ROTULOS[c]} ${totalCategoria(maoObra, c)}`).join(" · ")} · Efetivo total {total}</PH>
      {maoObra.length ? (
        <div className="columns-3 gap-4">
          {CATEGORIAS.map((c) => {
            const linhas = maoObra.filter((x) => x.categoria === c);
            if (!linhas.length) return null;
            return (
              <Fragment key={c}>
                <div className="mt-1 flex break-inside-avoid break-after-avoid justify-between bg-muted px-1 py-px font-bold uppercase first:mt-0"><span>{ROTULOS[c]}</span><span>{totalCategoria(maoObra, c)}</span></div>
                <PLista itens={linhas.map((x) => ({ id: x.id, nome: x.funcao, qtd: x.quantidade }))} />
              </Fragment>
            );
          })}
        </div>
      ) : <p className="px-1 text-muted-foreground">Nenhum efetivo registrado.</p>}

      <PH n={4}>Equipamentos</PH>
      {doc.equipamentos.length
        ? <div className="columns-3 gap-4"><PLista itens={doc.equipamentos.map((x) => ({ id: x.id, nome: x.descricao, qtd: x.quantidade }))} /></div>
        : <p className="px-1 text-muted-foreground">Nenhum equipamento registrado.</p>}

      <PH n={5}>Atividades executadas</PH>
      {atividades.length ? (
        <table className="w-full border-collapse">
          <thead><tr className="bg-muted text-left"><th className="w-28 px-2 py-0.5">Local</th><th className="px-2 py-0.5">Descrição do serviço</th></tr></thead>
          <tbody>
            {atividades.map((x, i) => (
              <tr key={x.id} className="break-inside-avoid border-b">
                <td className="px-2 py-0.5 align-top font-semibold">{i === 0 || atividades[i - 1]?.frente_id !== x.frente_id ? nomeFrente(x.frente_id) : ""}</td>
                <td className="px-2 py-0.5">{x.descricao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className="px-1 text-muted-foreground">Nenhuma atividade registrada.</p>}

      <PH n={6}>Ocorrências e observações</PH>
      {!ocorrencias.length && !seguranca.length && <p className="px-1 text-muted-foreground">Sem ocorrências ou observações.</p>}
      <PAnotacoes titulo="Ocorrências / observações gerais" textos={ocorrencias} />
      <PAnotacoes titulo="Segurança do trabalho" textos={seguranca} recuo={ocorrencias.length > 0} />

      {fotos.length > 0 && (
        <>
          <PH n={7}>Registro fotográfico</PH>
          <div className="grid grid-cols-3 gap-2">
            {fotos.map((f, i) => (
              <figure key={f.id} className="avoid-break overflow-hidden rounded border">
                <img src={urls[f.storage_path]} alt={f.legenda ?? ""} className="aspect-[4/3] w-full object-cover" />
                <figcaption className="px-1.5 py-1 text-[9px]"><b>Foto {i + 1}.</b> {f.legenda}</figcaption>
              </figure>
            ))}
          </div>
        </>
      )}

      <div className="avoid-break">
        <PH n={fotos.length > 0 ? 8 : 7}>Assinaturas</PH>
        <div className="mt-10 grid grid-cols-2 gap-10 text-center">
          {[["Responsável pela obra", r.assinante_obra], ["Fiscalização / Cliente", r.assinante_fiscalizacao]].map(([l, n]) => (
            <div key={l}><div className="border-t border-foreground pt-1 font-semibold">{n || " "}</div><div className="text-[9px] uppercase text-muted-foreground">{l}</div></div>
          ))}
        </div>
      </div>
      <div className="stripes mt-4 h-1.5" />
    </div>
  );
}

// Signed photo URLs load asynchronously; printing earlier would leave blank frames in the PDF.
export async function imprimir() {
  const imagens = Array.from(document.querySelectorAll<HTMLImageElement>(".print-only img"));
  await Promise.all(imagens.map((img) => img.decode().catch(() => undefined)));
  window.print();
}
