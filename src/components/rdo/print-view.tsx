import { useEffect, useRef, useState, type ReactNode } from "react";
import { MARCA } from "@/lib/marca";
import { posicaoAssinatura } from "@/lib/rdo/assinatura";
import type { DiaRdo, FrenteBanco, ObraBanco, RdoBanco } from "@/lib/rdo/queries";
import { CATEGORIAS, COLETAS, ROTULOS, TURNOS, climaIcone, diaSemana, distribuirColunas, entradasServicos, fmtData, paginarServicos, numeroParaTexto, ordenarPorFrente, totalCategoria, totalEfetivo, type TrechoServicos } from "@/lib/rdo/rules";

export type DocumentoRdo = Omit<DiaRdo, "rdo"> & { rdo: RdoBanco; obra: ObraBanco; frentes: FrenteBanco[]; logoUrl: string | null; assinaturaUrl: string | null };

const fmt = (d: string | null) => (d ? fmtData(d) : "—");
const mareTxt = (r: RdoBanco) =>
  r.mare_max_hora || r.mare_max_nivel !== null ? `${r.mare_max_hora?.slice(0, 5) || "--:--"} – ${numeroParaTexto(r.mare_max_nivel) || "0"} m` : "—";

// Contract names are long; the size steps down so they fit the header without pushing the RDO number away.
const tamanhoNome = (nome: string) => (nome.length <= 45 ? "text-xl leading-tight" : nome.length <= 90 ? "text-[15px] leading-tight" : "text-[12.5px] leading-snug");
// White plate: logos are usually made for light backgrounds.
export function LogoObra({ url, className = "" }: { url: string; className?: string }) {
  return <div className={`flex h-12 w-28 shrink-0 items-center justify-center rounded bg-white p-1 ${className}`}><img src={url} alt="Logo da empresa contratada" className="max-h-full max-w-full object-contain" /></div>;
}
// Ink crossing the line at a slight, per-RDO angle: multiply lets the printed line show through, as on paper.
function AssinaturaNoPapel({ url, numero }: { url: string; numero: number }) {
  const { angulo, x, y } = posicaoAssinatura(numero);
  return <img src={url} alt="" className="absolute bottom-full left-1/2 z-10 max-h-20 max-w-[90%] mix-blend-multiply" style={{ transform: `translate(calc(-50% + ${x}px), ${y}px) rotate(${angulo}deg)` }} />;
}
function PH({ n, children, extra }: { n: number; children: ReactNode; extra?: ReactNode }) {
  return (
    <div data-secao className="mb-1 mt-1.5 shrink-0 border-l-4 border-safety bg-navy px-2 py-[3px] text-[10px] font-bold uppercase tracking-wide text-navy-foreground">
      {n}. {children}{extra !== undefined && <span className="text-[8.5px] font-medium tracking-wider opacity-80"> · {extra}</span>}
    </div>
  );
}
// Same group heading for labor and services, so both sections read alike.
function PGrupo({ titulo, total, entrada }: { titulo: string; total: ReactNode; entrada?: number }) {
  return <div data-entrada={entrada} className="flex justify-between bg-muted px-1 py-px font-bold uppercase"><span>{titulo}</span><span>{total}</span></div>;
}
function PItem({ nome, qtd }: { nome: string; qtd: ReactNode }) {
  return <div className="flex break-inside-avoid justify-between gap-2 border-b border-dotted px-1 py-px"><span className="min-w-0">{nome}</span><b>{qtd}</b></div>;
}
function PServico({ texto, entrada }: { texto: string; entrada?: number }) {
  return <div data-entrada={entrada} className="flex break-inside-avoid gap-1.5 border-b border-dotted px-1 py-px"><span aria-hidden className="mt-[0.45em] size-[5px] shrink-0 rounded-[1px] bg-safety" /><span className="min-w-0">{texto}</span></div>;
}
// Each work front once, with its services in launch order.
const frentesEmOrdem = (atividades: { frente_id: string; descricao: string }[]): TrechoServicos[] =>
  atividades.reduce<TrechoServicos[]>((lista, a) => {
    const ultimo = lista[lista.length - 1];
    if (ultimo?.frente === a.frente_id) ultimo.itens.push(a.descricao); else lista.push({ frente: a.frente_id, titulo: "novo", itens: [a.descricao] });
    return lista;
  }, []);
// Empty dotted lines that take the free space of the page, as on a paper form. An SVG tile stays
// sharp in the PDF, where a CSS gradient line would print as a blurred grey band.
const PAUTA = {
  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='6' height='16'><line x1='0' y1='15.5' x2='6' y2='15.5' stroke='#b8bcc6' stroke-width='0.8' stroke-dasharray='1.2 1.8'/></svg>")}")`,
  backgroundSize: "6px 1.6em",
};

// The RDO is one A4 page (277 mm inside the print margins). Printing asks every document to measure
// its natural height first; content taller than the page is scaled down to fit it.
export const EVENTO_PAGINAR = "rdo360:paginar";
const ESCALA_MINIMA = 0.55;
function medirEscala(raiz: HTMLElement): number {
  const folha = raiz.querySelector<HTMLElement>("[data-folha]");
  if (!folha) return 1;
  const zoomAntes = folha.style.zoom;
  raiz.classList.add("medindo");
  try {
    const sonda = document.createElement("div");
    sonda.style.height = "277mm";
    raiz.appendChild(sonda);
    const pagina = sonda.getBoundingClientRect().height;
    sonda.remove();
    // Natural height at a given scale. Scaled text also rewraps on a wider line, so the height is
    // measured at each candidate instead of being divided out.
    const altura = (k: number) => { folha.style.zoom = String(k); return folha.getBoundingClientRect().height; };
    if (!pagina || altura(1) <= pagina) return 1;
    if (altura(ESCALA_MINIMA) > pagina) return ESCALA_MINIMA;
    let cabe = ESCALA_MINIMA, nao = 1;
    while (nao - cabe > 0.005) { const k = (cabe + nao) / 2; if (altura(k) <= pagina * 0.99) cabe = k; else nao = k; }
    return Math.floor(cabe * 1000) / 1000;
  } finally {
    folha.style.zoom = zoomAntes;
    raiz.classList.remove("medindo");
  }
}
export function PrintView({ doc, novaPagina }: { doc: DocumentoRdo; novaPagina?: boolean }) {
  const { rdo: r, obra, maoObra, frentes } = doc;
  const total = totalEfetivo(maoObra);
  const totalEquipamentos = doc.equipamentos.reduce((n, e) => n + e.quantidade, 0);
  const atividades = ordenarPorFrente(doc.atividades, frentes);
  const textos = (tipo: string) => doc.anotacoes.filter((a) => a.tipo === tipo && a.texto.trim()).map((a) => a.texto.trim());
  const ocorrencias = textos("ocorrencia"), seguranca = textos("seguranca");
  const nomeFrente = (id: string) => frentes.find((f) => f.id === id)?.nome ?? "Sem local";
  const raiz = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  useEffect(() => {
    const paginar = () => { if (raiz.current) setEscala(medirEscala(raiz.current)); };
    window.addEventListener(EVENTO_PAGINAR, paginar);
    return () => window.removeEventListener(EVENTO_PAGINAR, paginar);
  }, []);
  const colunasEfetivo = distribuirColunas(CATEGORIAS.map((c) => ({ chave: c, itens: maoObra.filter((x) => x.categoria === c) })), 4, 10);
  // One page: services are balanced in two columns, a front that moves to the second column keeps no
  // repeated heading. A handful of services stays in the first column instead of being split.
  const entradas = entradasServicos(atividades, 1, (t) => Math.max(1, Math.ceil(t.length / 70)));
  const [servicos] = entradas.length <= 8
    ? [{ novaPagina: false, colunas: [frentesEmOrdem(atividades), []] as [TrechoServicos[], TrechoServicos[]] }]
    : paginarServicos(entradas, { disponivel: Infinity, pagina: Infinity, espacoGrupo: 0 });
  // Headings and services render in order, so a counter matches each entry's index.
  let entrada = 0;
  // Below the minimum scale the page grows instead, and the printer continues on a second sheet.
  const cabe = escala > ESCALA_MINIMA;
  return (
    <div ref={raiz} className={`print-only text-[10px] leading-snug text-foreground ${novaPagina ? "break-before-page" : ""}`}>
      <div data-folha className="flex flex-col overflow-hidden" style={{ zoom: escala, height: cabe ? `calc(277mm / ${escala})` : undefined }}>
        <div className="flex shrink-0 items-center gap-3 rounded-md border px-3 py-1.5">
          {doc.logoUrl && <LogoObra url={doc.logoUrl} />}
          <div className="min-w-0 flex-1">
            <div className="text-[8px] font-bold uppercase tracking-widest text-safety">{MARCA} – Diário de obra</div>
            <div className={`font-bold uppercase text-navy ${tamanhoNome(obra.nome)}`}>{obra.nome}</div>
          </div>
          <div className="shrink-0 whitespace-nowrap text-right">
            <div className="text-2xl font-extrabold leading-none text-navy">RDO Nº {r.numero}</div>
            <div className="mt-0.5 text-muted-foreground">{fmtData(r.data)} · {diaSemana(r.data)}</div>
          </div>
        </div>

        <PH n={1}>Dados da obra</PH>
        <table className="w-full shrink-0 border-collapse">
          <tbody>
            {[["Cliente", obra.cliente, "Contratada", obra.responsavel_tecnico], ["Fiscalização", obra.fiscalizacao, "Gerenciadora", obra.gerenciadora], ["Local", obra.endereco, "Contrato nº", obra.contrato], ["Início contratual", fmt(obra.data_inicio), "Término contratual", fmt(obra.prazo_previsto)]].map((l, i) => (
              <tr key={i} className="border-b">
                <td className="w-28 whitespace-nowrap bg-muted px-2 py-px font-semibold">{l[0]}</td><td className="px-2 py-px">{l[1] || "—"}</td>
                <td className="w-28 whitespace-nowrap bg-muted px-2 py-px font-semibold">{l[2]}</td><td className="px-2 py-px">{l[3] || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <PH n={2} extra={`Horário: ${r.horario_trabalho || "—"}`}>Condições climáticas</PH>
        <div className="grid shrink-0 grid-cols-7 gap-1">
          {TURNOS.map((t) => (
            <div key={t.rotulo} className="rounded border px-1 py-0.5 text-center">
              <div className="text-[7.5px] uppercase text-muted-foreground">{t.rotulo}</div>
              <div className="font-semibold">{r[t.coluna] ? `${climaIcone(t.rotulo, r[t.coluna] ?? "")} ${r[t.coluna]}` : "—"}</div>
            </div>
          ))}
          {COLETAS.map((c) => (
            <div key={c.hora} className="rounded border px-1 py-0.5 text-center">
              <div className="text-[7.5px] uppercase text-muted-foreground">Precipitação {c.hora}</div>
              <div className="font-semibold">{r[c.coluna] !== null ? `${numeroParaTexto(r[c.coluna])} mm` : "—"}</div>
            </div>
          ))}
          <div className="rounded border border-safety px-1 py-0.5 text-center">
            <div className="text-[7.5px] uppercase text-muted-foreground">Maré máxima</div>
            <div className="font-semibold">{mareTxt(r)}</div>
          </div>
        </div>

        <PH n={3} extra={`Efetivo total ${total}`}>Mão de obra</PH>
        {colunasEfetivo.length ? (
          <div className="grid shrink-0 grid-cols-4 items-start gap-x-3">
            {colunasEfetivo.map((coluna, i) => (
              <div key={i}>
                {coluna.map((cel, j) => cel.tipo === "grupo"
                  ? <div key={j} className={j > 0 ? "mt-1" : ""}><PGrupo titulo={`${ROTULOS[cel.chave as keyof typeof ROTULOS]}${cel.continuacao ? " (cont.)" : ""}`} total={cel.continuacao ? "" : totalCategoria(maoObra, cel.chave as keyof typeof ROTULOS)} /></div>
                  : <PItem key={j} nome={cel.item.funcao} qtd={cel.item.quantidade} />)}
              </div>
            ))}
          </div>
        ) : <p className="shrink-0 px-1 text-muted-foreground">Nenhum efetivo registrado.</p>}

        <PH n={4} extra={`Total ${totalEquipamentos}`}>Equipamentos</PH>
        {doc.equipamentos.length
          ? <div className="shrink-0 columns-4 gap-x-3">{doc.equipamentos.map((x) => <PItem key={x.id} nome={x.descricao} qtd={x.quantidade} />)}</div>
          : <p className="shrink-0 px-1 text-muted-foreground">Nenhum equipamento registrado.</p>}

        <PH n={5}>Atividades executadas</PH>
        {/* Grows into the free space, with ruled blank lines under the services. */}
        <div className="flex min-h-[3em] flex-[3_1_auto] flex-col">
          {atividades.length && servicos ? (
            <div data-servicos className="grid shrink-0 grid-cols-2 items-start gap-x-4">
              {servicos.colunas.map((coluna, c) => (
                <div key={c}>
                  {coluna.map((t, i) => (
                    <div key={i} className={i > 0 ? "mt-1" : ""}>
                      {t.titulo === "novo" && <PGrupo entrada={entrada++} titulo={nomeFrente(t.frente)} total={atividades.filter((a) => a.frente_id === t.frente).length} />}
                      {t.itens.map((texto, j) => <PServico key={j} entrada={entrada++} texto={texto} />)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : <p className="shrink-0 px-1 text-muted-foreground">Nenhuma atividade registrada.</p>}
          <div aria-hidden className="grid flex-1 grid-cols-2 gap-x-4"><div style={PAUTA} /><div style={PAUTA} /></div>
        </div>

        <PH n={6}>Ocorrências e observações</PH>
        <div className="min-h-[3em] flex-[2_1_auto] space-y-1 rounded border px-2 py-1">
          {!ocorrencias.length && !seguranca.length && <p className="text-muted-foreground">Sem ocorrências ou observações.</p>}
          {ocorrencias.map((t, i) => <p key={i} className="whitespace-pre-wrap">{t}</p>)}
          {seguranca.length > 0 && (
            <>
              <div className="pt-0.5 font-semibold">Segurança do trabalho</div>
              {seguranca.map((t, i) => <p key={i} className="whitespace-pre-wrap">{t}</p>)}
            </>
          )}
        </div>

        <div className="shrink-0 break-inside-avoid">
          <PH n={7}>Assinaturas</PH>
          <div className={`${doc.assinaturaUrl ? "mt-16" : "mt-10"} grid grid-cols-2 gap-16 px-6 text-center`}>
            <div className="relative">
              {doc.assinaturaUrl && <AssinaturaNoPapel url={doc.assinaturaUrl} numero={r.numero} />}
              <div className="min-h-4 border-t border-foreground pt-0.5 font-semibold">{r.assinante_obra || " "}</div>
              <div className="text-[8px] uppercase tracking-widest text-muted-foreground">Contratada</div>
            </div>
            <div>
              <div className="min-h-4 border-t border-foreground pt-0.5 font-semibold">{r.assinante_fiscalizacao || " "}</div>
              <div className="text-[8px] uppercase tracking-widest text-muted-foreground">Gerenciadora</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// Images (logo and signature) load asynchronously; printing earlier would leave blank frames in the PDF.
export async function imprimir() {
  window.dispatchEvent(new Event(EVENTO_PAGINAR));
  // Let React render the measured layout before the print snapshot.
  await new Promise((pronto) => setTimeout(pronto, 50));
  await new Promise((pronto) => requestAnimationFrame(() => requestAnimationFrame(pronto)));
  const imagens = Array.from(document.querySelectorAll<HTMLImageElement>(".print-only img"));
  await Promise.all(imagens.map((img) => img.decode().catch(() => undefined)));
  window.print();
}
