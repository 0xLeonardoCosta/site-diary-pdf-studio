import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { EVENTO_PAGINAR, type DocumentoRdo } from "./print-view";
import { COLETAS, TURNOS, diaSemana, fmtData, ordenarPorFrente } from "@/lib/rdo/rules";
import { LEGENDA_CLIMA, codigoClima, colunasServicos, montarEfetivoExcel, textoExcel, type CelulaExcel } from "@/lib/rdo/layout-excel";

// Grid of the contract spreadsheet, in points measured on its PDF (A4, 595 × 842 pt).
// Page 1 columns: labor name and quantity three times, with the header and weather cells on the same lines.
const COLUNAS_1 = [126.7, 46.5, 128.3, 60.7, 84.9, 24.9, 12.3, 12.8, 58.6];
const COLUNAS_2 = [301.5, 254.2];
const LINHA_EFETIVO = 9.48, LINHA_SERVICO_ALTA = 19.3, LINHA_SERVICO = 15.4, LINHA_LIBERACAO = 15.4;
// Height a sheet can take below its top margin; taller content is scaled down to fit.
const ALTURA_UTIL = "787pt";

const pt = (n: number): CSSProperties => ({ height: `${n}pt` });
function Grade({ colunas, children }: { colunas: number[]; children: ReactNode }) {
  return (
    <table>
      <colgroup>{colunas.map((w, i) => <col key={i} style={{ width: `${w}pt` }} />)}</colgroup>
      <tbody>{children}</tbody>
    </table>
  );
}
const Qtd = ({ c }: { c: CelulaExcel | undefined }) => <td className="b">{c?.qtd ?? ""}</td>;

function medirFolhas(raiz: HTMLElement): number[] {
  const conteudos = Array.from(raiz.querySelectorAll<HTMLElement>("[data-conteudo]"));
  raiz.classList.add("medindo");
  try {
    const sonda = document.createElement("div");
    sonda.style.height = ALTURA_UTIL;
    raiz.appendChild(sonda);
    const util = sonda.getBoundingClientRect().height;
    sonda.remove();
    return conteudos.map((el) => {
      const antes = el.style.zoom;
      el.style.zoom = "1";
      const altura = el.getBoundingClientRect().height;
      el.style.zoom = antes;
      // Column widths are fixed, so text does not rewrap and the height scales in proportion.
      return util && altura > util ? Math.floor((util / altura) * 1000) / 1000 : 1;
    });
  } finally {
    raiz.classList.remove("medindo");
  }
}

export function PrintExcel({ doc, novaPagina }: { doc: DocumentoRdo; novaPagina?: boolean }) {
  const { rdo: r, obra, frentes } = doc;
  const raiz = useRef<HTMLDivElement>(null);
  const [escalas, setEscalas] = useState([1, 1]);
  useEffect(() => {
    const paginar = () => { if (raiz.current) setEscalas(medirFolhas(raiz.current)); };
    window.addEventListener(EVENTO_PAGINAR, paginar);
    return () => window.removeEventListener(EVENTO_PAGINAR, paginar);
  }, []);
  const ef = montarEfetivoExcel(doc.maoObra, doc.equipamentos);
  const nomeFrente = (id: string) => frentes.find((f) => f.id === id)?.nome ?? "Sem local";
  const [servEsq, servDir] = colunasServicos(ordenarPorFrente(doc.atividades, frentes), nomeFrente);
  const textos = (tipo: string) => doc.anotacoes.filter((a) => a.tipo === tipo && a.texto.trim()).map((a) => a.texto.trim());
  const observacoes = [...textos("ocorrencia"), ...textos("seguranca")];
  const mare = r.mare_max_hora || r.mare_max_nivel !== null ? `${r.mare_max_hora?.slice(0, 5) || "--:--"} – ${textoExcel(r.mare_max_nivel)} m` : "-";
  const [c1, c2, c3] = ef.consorcio, [t1, t2] = ef.terceirizados;
  const v = (texto: string | null | undefined) => <span className="uppercase">{texto || ""}</span>;

  return (
    <div ref={raiz} className={`print-only excel ${novaPagina ? "break-before-page" : ""}`}>
      <section className="folha-excel" data-pagina="1">
        <div data-conteudo style={{ zoom: escalas[0] }}>
          <Grade colunas={COLUNAS_1}>
            <tr style={pt(30.1)}>
              <td rowSpan={2}>{doc.logoUrl && <img src={doc.logoUrl} alt="Logo da empresa contratada" className="logo" />}</td>
              <td rowSpan={2} colSpan={4} className="esq b titulo">{v(obra.nome)}</td>
              <td colSpan={2} className="esq b">FOLHA:</td>
              <td className="esq b">Nº:</td>
              <td className="b numero">{r.numero}</td>
            </tr>
            <tr style={pt(10.7)}>
              <td className="esq b">DATA:</td>
              <td colSpan={3}>{fmtData(r.data)}</td>
            </tr>
            <tr style={pt(19.3)}>
              <td colSpan={5} className="cinza" />
              <td colSpan={4} className="b dia">{diaSemana(r.data)}</td>
            </tr>
            <tr style={pt(20.3)}>
              <td colSpan={3} className="esq b">Cliente: {v(obra.cliente)}</td>
              <td colSpan={6} className="esq b">Fiscalização: {v(obra.fiscalizacao)}</td>
            </tr>
            <tr style={pt(17.5)}><td colSpan={9} className="esq b">OBRA: {v(obra.nome)}</td></tr>
            <tr style={pt(23.3)}>
              <td colSpan={4} className="esq b">LOCAL: {v(obra.endereco)}</td>
              <td className="b">INÍCIO CONTRATUAL<br />{obra.data_inicio ? fmtData(obra.data_inicio) : ""}</td>
              <td colSpan={4} className="b">TÉRMINO CONTRATUAL<br />{obra.prazo_previsto ? fmtData(obra.prazo_previsto) : ""}</td>
            </tr>
            <tr style={pt(11.7)}>
              <td colSpan={4} className="esq b sem-base">CLIENTE: {v(obra.cliente)}</td>
              <td colSpan={5} className="b">CONTRATO Nº</td>
            </tr>
            <tr style={pt(11.6)}>
              <td colSpan={4} className="esq b sem-topo sem-base">GERENCIADORA: {v(obra.gerenciadora)}</td>
              <td colSpan={5} rowSpan={2} className="b contrato">{obra.contrato}</td>
            </tr>
            <tr style={pt(11.6)}><td colSpan={4} className="esq b sem-topo">CONTRATADA: {v(obra.responsavel_tecnico)}</td></tr>
            <tr style={pt(9.6)}><td colSpan={9} /></tr>
            <tr className="grossa" style={pt(12)}>
              <td colSpan={4} className="b">CONDIÇÕES DO TEMPO</td>
              <td className="b">TÁBUA DE MARÉ</td>
              <td colSpan={4} className="b">ÍNDICE PLUVIOMÉTRICO</td>
            </tr>
            {TURNOS.map((t, i) => {
              const [n1, l1, n2, l2] = LEGENDA_CLIMA[i]!;
              const coleta = COLETAS[i]!;
              return (
                <tr key={t.coluna} className={i === 0 ? "grossa" : ""} style={pt(9.8)}>
                  <td className="b">{t.rotulo.toUpperCase()}</td>
                  <td>{codigoClima(r[t.coluna])}</td>
                  <td className="esq legenda sem-dir"><b>( {n1} )</b> {l1}</td>
                  <td className="esq sem-esq"><b>( {n2} )</b> {l2}</td>
                  {i === 0 && <td rowSpan={3}>{mare}</td>}
                  <td>{coleta.hora}</td>
                  <td colSpan={3}>{textoExcel(r[coleta.coluna])}</td>
                </tr>
              );
            })}
            <tr style={pt(3.6)}><td colSpan={9} /></tr>
            <tr className="grossa" style={pt(12)}>
              <td colSpan={2} className="esq b">HORÁRIO DE EXPEDIENTE: {r.horario_trabalho || ""}</td>
              <td colSpan={7} />
            </tr>
            <tr className="grossa" style={pt(9.9)}>
              <td className="b">MÃO DE OBRA CONSÓRCIO</td><td className="b">QUANT.</td>
              <td className="b">MÃO DE OBRA CONSÓRCIO</td><td className="b">QUANT.</td>
              <td colSpan={4} className="b">MÃO DE OBRA CONSÓRCIO</td><td className="b">QUANT.</td>
            </tr>
            {c1.map((a, i) => (
              <tr key={i} data-efetivo style={pt(LINHA_EFETIVO)}>
                <td>{a.nome}</td><Qtd c={a} />
                <td>{c2[i]?.nome}</td><Qtd c={c2[i]} />
                <td colSpan={4}>{c3[i]?.nome}</td><Qtd c={c3[i]} />
              </tr>
            ))}
            <tr className="grossa" style={pt(9.9)}>
              <td colSpan={3} className="b">TOTAL CONSÓRCIO</td><td className="b total">{ef.totalConsorcio}</td><td colSpan={5} />
            </tr>
            <tr className="grossa" style={pt(9.2)}>
              <td className="b">MÃO DE OBRA TERCEIRIZADOS</td><td className="b">QUANT.</td>
              <td className="b">MÃO DE OBRA TERCEIRIZADOS</td><td className="b">QUANT.</td>
              <td colSpan={4} className="b">EQUIPAMENTOS</td><td className="b">QUANT.</td>
            </tr>
            {t1.map((a, i) => (
              <tr key={i} data-terceirizado style={pt(LINHA_EFETIVO)} className={i === 0 ? "grossa" : ""}>
                <td>{a.nome}</td><Qtd c={a} />
                <td>{t2[i]?.nome}</td><Qtd c={t2[i]} />
                <td colSpan={4}>{ef.equipamentos[i]?.nome}</td><Qtd c={ef.equipamentos[i]} />
              </tr>
            ))}
            <tr className="grossa" style={pt(9.6)}>
              <td colSpan={3} className="b">TOTAL TERCEIRIZADO</td><td className="b">{ef.totalTerceirizado}</td>
              <td colSpan={4} className="b">TOTAL EQUIPAMENTOS</td><td className="b">{ef.totalEquipamentos}</td>
            </tr>
            <tr className="grossa" style={pt(9.4)}>
              <td colSpan={3} className="b">TOTAL GERAL</td><td className="b">{ef.totalGeral}</td><td colSpan={5} />
            </tr>
          </Grade>
        </div>
      </section>

      <section className="folha-excel" data-pagina="2">
        <div data-conteudo style={{ zoom: escalas[1] }}>
          <Grade colunas={COLUNAS_2}>
            <tr style={pt(26.4)}><td colSpan={2} className="cinza b secao">REGISTROS DE ATIVIDADES SOLICITADAS PELA CONTRATADA:</td></tr>
            <tr className="grossa" style={pt(18.2)}><td /><td /></tr>
            <tr style={pt(18.9)}><td /><td /></tr>
            <tr style={pt(15.7)}><td colSpan={2} className="claro b secao">SERVIÇOS EXECUTADOS</td></tr>
            {servEsq.map((s, i) => (
              <tr key={i} data-servico style={pt(i < 8 ? LINHA_SERVICO_ALTA : LINHA_SERVICO)}>
                <td className="esq servico">{s}</td><td className="esq servico">{servDir[i]}</td>
              </tr>
            ))}
            <tr style={pt(15.4)}><td colSpan={2} className="claro b secao">OBSERVAÇÕES</td></tr>
            <tr style={pt(91.8)}>
              <td colSpan={2} className="esq observacoes">{observacoes.map((t, i) => <p key={i}>{t}</p>)}</td>
            </tr>
            <tr className="grossa" style={pt(14.8)}><td className="esq b liberacoes">DATA DAS LIBERAÇÕES DOS IMÓVEIS DESAPROPRIADOS:</td><td /></tr>
            {Array.from({ length: 7 }, (_, i) => <tr key={i} style={pt(LINHA_LIBERACAO)}><td /><td /></tr>)}
            <tr style={pt(15)}><td colSpan={2} className="b secao">CONSIDERAÇÕES GERENCIADORA:</td></tr>
            <tr className="grossa" style={pt(14.5)}><td /><td /></tr>
            <tr style={pt(15)}><td /><td /></tr>
            <tr className="grossa" style={pt(15.5)}><td className="b">CONTRATADA</td><td className="b">GERENCIADORA</td></tr>
            <tr className="grossa" style={pt(39.4)}>
              <td className="assinatura">
                {doc.assinaturaUrl && <img src={doc.assinaturaUrl} alt="" />}
                <span>{r.assinante_obra || ""}</span>
              </td>
              <td className="assinatura"><span>{r.assinante_fiscalizacao || ""}</span></td>
            </tr>
          </Grade>
        </div>
      </section>

    </div>
  );
}
