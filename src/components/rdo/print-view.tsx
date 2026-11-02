import { Fragment, type ReactNode } from "react";
import { MARCA } from "@/lib/marca";
import { posicaoAssinatura } from "@/lib/rdo/assinatura";
import type { DiaRdo, FrenteBanco, ObraBanco, RdoBanco } from "@/lib/rdo/queries";
import { CATEGORIAS, COLETAS, ROTULOS, TURNOS, climaIcone, diaSemana, fmtData, numeroParaTexto, ordenarPorFrente, totalCategoria, totalEfetivo } from "@/lib/rdo/rules";

export type DocumentoRdo = Omit<DiaRdo, "rdo"> & { rdo: RdoBanco; obra: ObraBanco; frentes: FrenteBanco[]; urls: Record<string, string>; logoUrl: string | null; assinaturaUrl: string | null };

const fmt = (d: string | null) => (d ? fmtData(d) : "—");
const mareTxt = (r: RdoBanco) =>
  r.mare_max_hora || r.mare_max_nivel !== null ? `${r.mare_max_hora?.slice(0, 5) || "--:--"} - ${numeroParaTexto(r.mare_max_nivel) || "0"} m` : "—";

// Contract names are long; the size steps down so they fit the header without pushing the RDO number away.
const tamanhoNome = (nome: string) => (nome.length <= 45 ? "text-2xl leading-tight" : nome.length <= 90 ? "text-lg leading-tight" : "text-[13px] leading-snug");
// White plate: logos are usually made for light backgrounds and would vanish on the navy header.
export function LogoObra({ url, className = "" }: { url: string; className?: string }) {
  return <div className={`flex h-12 w-28 shrink-0 items-center justify-center rounded bg-white p-1 ${className}`}><img src={url} alt="Logo da empresa contratada" className="max-h-full max-w-full object-contain" /></div>;
}
// Ink crossing the line at a slight, per-RDO angle: multiply lets the printed line show through, as on paper.
function AssinaturaNoPapel({ url, numero }: { url: string; numero: number }) {
  const { angulo, x, y } = posicaoAssinatura(numero);
  return <img src={url} alt="" className="absolute bottom-full left-1/2 z-10 max-h-24 max-w-[90%] mix-blend-multiply" style={{ transform: `translate(calc(-50% + ${x}px), ${y}px) rotate(${angulo}deg)` }} />;
}
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
export function PrintView({ doc, novaPagina }: { doc: DocumentoRdo; novaPagina?: boolean }) {
  const { rdo: r, obra, maoObra, frentes, urls } = doc;
  const total = totalEfetivo(maoObra);
  const atividades = ordenarPorFrente(doc.atividades, frentes);
  const textos = (tipo: string) => doc.anotacoes.filter((a) => a.tipo === tipo && a.texto.trim()).map((a) => a.texto.trim());
  const ocorrencias = textos("ocorrencia"), seguranca = textos("seguranca");
  const fotos = r.fotos_no_pdf ? doc.fotos : [];
  const nomeFrente = (id: string) => frentes.find((f) => f.id === id)?.nome ?? "Sem local";
  return (
    <div className={`print-only text-[11px] text-foreground ${novaPagina ? "break-before-page" : ""}`}>
      <div className="stripes h-2" />
      <div className="flex items-center gap-3 bg-navy px-3 py-2 text-navy-foreground">
        {doc.logoUrl && <LogoObra url={doc.logoUrl} />}
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-safety">{MARCA} – Diário de obra:</div>
          <div className={`font-display font-bold uppercase ${tamanhoNome(obra.nome)}`}>{obra.nome}</div>
        </div>
        <div className="shrink-0 whitespace-nowrap text-right">
          <div className="font-display text-xl font-bold">RDO Nº {r.numero}</div>
          <div>{fmtData(r.data)} · {diaSemana(r.data)}</div>
        </div>
      </div>

      <PH n={1}>Dados da obra</PH>
      <table className="w-full border-collapse">
        <tbody>
          {[["Cliente", obra.cliente, "Fiscalização", obra.fiscalizacao], ["Local", obra.endereco, "Gerenciadora", obra.gerenciadora], ["Contratada", obra.responsavel_tecnico, "Contrato nº", obra.contrato], ["Início contratual", fmt(obra.data_inicio), "Término contratual", fmt(obra.prazo_previsto)]].map((l, i) => (
            <tr key={i} className="border-b">
              <td className="w-32 whitespace-nowrap bg-muted px-2 py-0.5 font-semibold">{l[0]}</td><td className="px-2 py-0.5">{l[1] || "—"}</td>
              <td className="w-32 whitespace-nowrap bg-muted px-2 py-0.5 font-semibold">{l[2]}</td><td className="px-2 py-0.5">{l[3] || "—"}</td>
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
            <div className="text-[8px] uppercase leading-tight text-muted-foreground">Precipitação (mm)<br />{c.hora}</div>
            <div className="font-semibold">{r[c.coluna] !== null ? numeroParaTexto(r[c.coluna]) : "—"}</div>
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
        <div className={`${doc.assinaturaUrl ? "mt-24" : "mt-10"} grid grid-cols-2 gap-10 text-center`}>
          <div className="relative">
            {doc.assinaturaUrl && <AssinaturaNoPapel url={doc.assinaturaUrl} numero={r.numero} />}
            <div className="min-h-5 border-t border-foreground pt-1 font-semibold">{r.assinante_obra || " "}</div>
            <div className="text-[9px] uppercase text-muted-foreground">Contratada</div>
          </div>
          <div>
            <div className="min-h-5 border-t border-foreground pt-1 font-semibold">{r.assinante_fiscalizacao || " "}</div>
            <div className="text-[9px] uppercase text-muted-foreground">Gerenciadora</div>
          </div>
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
