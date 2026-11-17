import path from "node:path";

import {
  Circle,
  Document,
  Font,
  Image,
  Page,
  Path,
  StyleSheet,
  Svg,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import type { DadosComprovante } from "@/lib/comprovante/dados";
import { formatCentavos, formatDateTime, maskCpf, maskEmail } from "@/lib/format";
import { formatDecimal } from "@/lib/masks";
import { EVENTO } from "@/lib/status";
import { summarizeUserAgent } from "@/lib/user-agent";
import { sanitizarParaPdf } from "@/lib/pdf/texto";
import { textosDe } from "@/lib/tipos";
import { totalItemCentavos } from "@/lib/validation/proposta";

/*
 * O comprovante em PDF, escrito em JSX com flexbox (@react-pdf/renderer, escolhido na Fase 7:
 * fica parecido com o resto do app; o pdf-lib exigiria posicionar cada texto por coordenadas).
 *
 * Fontes: Manrope e JetBrains Mono embutidas (licença OFL, em lib/pdf/fonts/). As fontes padrão
 * do PDF (Helvetica) só conhecem um conjunto pequeno de caracteres; com fonte embutida, acentos,
 * aspas e "m²" saem certos, e o comprovante tem a cara da marca.
 * O next.config.ts inclui a pasta de fontes no pacote do servidor (outputFileTracingIncludes).
 */

const PASTA_FONTES = path.join(process.cwd(), "lib/pdf/fonts");
let fontesRegistradas = false;

function registrarFontes() {
  if (fontesRegistradas) return;
  Font.register({
    family: "Manrope",
    fonts: [
      { src: path.join(PASTA_FONTES, "manrope-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(PASTA_FONTES, "manrope-latin-600-normal.woff"), fontWeight: 600 },
      { src: path.join(PASTA_FONTES, "manrope-latin-700-normal.woff"), fontWeight: 700 },
      { src: path.join(PASTA_FONTES, "manrope-latin-800-normal.woff"), fontWeight: 800 },
    ],
  });
  Font.register({
    family: "JetBrains Mono",
    fonts: [
      { src: path.join(PASTA_FONTES, "jetbrains-mono-latin-400-normal.woff"), fontWeight: 400 },
      { src: path.join(PASTA_FONTES, "jetbrains-mono-latin-500-normal.woff"), fontWeight: 500 },
    ],
  });
  // Sem hifenização automática (ela é feita para inglês e quebraria palavras em português).
  // Só palavras enormes (ex.: um link colado) são partidas, para não vazar da página.
  Font.registerHyphenationCallback((palavra) =>
    palavra.length > 64 ? (palavra.match(/.{1,40}/g) ?? [palavra]) : [palavra],
  );
  fontesRegistradas = true;
}

// Tokens da marca (styles/tokens.css). O PDF não lê CSS: os valores são repetidos aqui.
const COR = {
  navy950: "#0E1D2B",
  navy900: "#12263A",
  navy800: "#1A3349",
  slate600: "#52667A",
  teal600: "#1F7A70",
  teal500: "#38A095",
  teal50: "#EEF8F6",
  surface2: "#F7FAFA",
  line: "#DCE5E6",
  warning: "#8A5A00",
  warningBg: "#FFF4DC",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Manrope",
    fontSize: 9.5,
    lineHeight: 1.45,
    color: COR.navy900,
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
  },
  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  marca: { flexDirection: "row", alignItems: "center", gap: 8 },
  wordmark: {
    fontSize: 20,
    fontWeight: 800,
    color: COR.navy800,
    letterSpacing: -0.4,
    lineHeight: 1,
  },
  assinatura: { fontSize: 8, color: COR.slate600, marginTop: 3 },
  topoDireita: { alignItems: "flex-end" },
  rotulo: { fontSize: 7.5, color: COR.slate600, textTransform: "uppercase", letterSpacing: 0.6 },
  tituloDoc: { fontSize: 15, fontWeight: 800, color: COR.navy950 },
  codigo: { fontFamily: "JetBrains Mono", fontSize: 11, fontWeight: 500, color: COR.navy900 },
  selo: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: COR.teal50,
    borderWidth: 1,
    borderColor: "#C9E6E1",
    borderRadius: 8,
  },
  seloTitulo: { fontSize: 12, fontWeight: 700, color: COR.teal600 },
  secao: { marginTop: 18 },
  secaoTitulo: {
    fontSize: 10.5,
    fontWeight: 700,
    color: COR.navy950,
    paddingBottom: 4,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COR.line,
  },
  grade: { flexDirection: "row", flexWrap: "wrap" },
  campo: { width: "50%", paddingRight: 10, marginBottom: 6 },
  campoInteiro: { width: "100%", marginBottom: 6 },
  valor: { color: COR.navy900 },
  valorForte: { fontWeight: 700, color: COR.navy950 },
  paragrafo: { color: COR.navy900, marginBottom: 4 },
  // Larguras fixas em vez de `flex: 1`/`gap`: com eles, o react-pdf não media a altura da coluna
  // e a descrição se sobrepunha ao detalhe do item.
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: COR.line,
  },
  itemColuna: { width: "75%" },
  itemDescricao: { fontWeight: 600 },
  itemDetalhe: { color: COR.slate600, fontSize: 8.5 },
  itemTotal: { width: "25%", fontWeight: 600, textAlign: "right" },
  total: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    fontWeight: 800,
    fontSize: 11,
    color: COR.navy950,
  },
  exclusoes: {
    marginTop: 8,
    padding: 8,
    backgroundColor: COR.warningBg,
    borderRadius: 6,
  },
  exclusoesTitulo: { fontWeight: 700, color: COR.warning, marginBottom: 2 },
  consentimento: {
    padding: 8,
    backgroundColor: COR.surface2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COR.line,
  },
  hash: { fontFamily: "JetBrains Mono", fontSize: 8, color: COR.navy800 },
  fotos: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  foto: { width: "50%", paddingRight: 8, marginBottom: 8 },
  fotoImagem: { width: "100%", height: 130, objectFit: "cover", borderRadius: 4 },
  fotoSem: { alignItems: "center", justifyContent: "center", backgroundColor: COR.surface2 },
  hashFoto: { fontFamily: "JetBrains Mono", fontSize: 5.5, color: COR.slate600 },
  tabela: { borderWidth: 1, borderColor: COR.line, borderRadius: 6 },
  linhaTabela: { flexDirection: "row", borderTopWidth: 1, borderTopColor: COR.line },
  cabecalhoTabela: { flexDirection: "row", backgroundColor: COR.surface2 },
  celula: { paddingVertical: 4, paddingHorizontal: 6, fontSize: 8 },
  rodape: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: COR.slate600,
    borderTopWidth: 1,
    borderTopColor: COR.line,
    paddingTop: 6,
  },
});

const COLUNAS = { data: "19%", evento: "31%", ip: "20%", dispositivo: "30%" } as const;

const RESULTADO: Record<DadosComprovante["aceite"]["resultado"], string> = {
  aceito: "Aceito",
  recusado: "Recusado",
  ajuste: "Ajuste solicitado",
};

/** Fotos da entrega já baixadas (só JPEG e PNG: o react-pdf não desenha WebP), por caminho. */
export type ImagensPdf = Record<string, { data: Buffer; formato: "jpg" | "png" }>;

export type ComprovanteProps = {
  dados: Omit<DadosComprovante, "prestadorEmail">;
  /** Bytes das fotos de uma entrega. Ficam FORA de `dados` porque o texto de `dados` é sanitizado. */
  imagens?: ImagensPdf;
  /** Endereço da página pública de verificação, ex.: https://zelo.app/verificar */
  urlVerificacao: string;
};

/** Selo da marca (anel + check), o mesmo desenho do <AcceptanceStamp />. */
function Selo({ tamanho }: { tamanho: number }) {
  return (
    <Svg width={tamanho} height={tamanho} viewBox="0 0 48 48">
      <Circle cx="24" cy="24" r="21" fill="none" stroke={COR.teal600} strokeWidth={2.5} />
      <Circle
        cx="24"
        cy="24"
        r="17"
        fill="none"
        stroke={COR.teal600}
        strokeWidth={1}
        strokeDasharray="2 2.6"
      />
      <Path
        d="M15.5 24.5 L21.5 30.5 L33 18"
        fill="none"
        stroke={COR.teal600}
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Campo({
  rotulo,
  children,
  inteiro = false,
}: {
  rotulo: string;
  children: React.ReactNode;
  inteiro?: boolean;
}) {
  return (
    <View style={inteiro ? s.campoInteiro : s.campo} wrap={false}>
      <Text style={s.rotulo}>{rotulo}</Text>
      <Text style={s.valor}>{children}</Text>
    </View>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <View style={s.secao}>
      <Text style={s.secaoTitulo} minPresenceAhead={40}>
        {titulo}
      </Text>
      {children}
    </View>
  );
}

export function ComprovantePdf({ dados, urlVerificacao, imagens = {} }: ComprovanteProps) {
  const { aceite, partes, conteudo, versao, eventos, entrega } = dados;
  const T = textosDe(dados.proposta.tipo);
  const prestador = partes.prestador.empresa
    ? `${partes.prestador.empresa} (${partes.prestador.nome})`
    : partes.prestador.nome;
  const registradoEm = formatDateTime(aceite.criadoEm);

  return (
    <Document
      title={`${T.tituloPdf} ${aceite.codigo}`}
      author="Zelo"
      subject={partes.titulo}
      creator="Zelo"
      producer="Zelo"
      language="pt-BR"
    >
      <Page size="A4" style={s.page}>
        {/* Topo: marca e identificação do comprovante */}
        <View style={s.topo}>
          <View style={s.marca}>
            <Selo tamanho={30} />
            <View>
              <Text style={s.wordmark}>Zelo</Text>
              <Text style={s.assinatura}>Combinou? Registrou.</Text>
            </View>
          </View>
          <View style={s.topoDireita}>
            <Text style={s.rotulo}>{T.tituloPdf}</Text>
            <Text style={s.codigo}>{aceite.codigo}</Text>
          </View>
        </View>

        {/* Resumo do registro */}
        <View style={s.selo} wrap={false}>
          <Selo tamanho={40} />
          <View style={{ flex: 1 }}>
            <Text style={s.seloTitulo}>
              {aceite.resultado === "aceito"
                ? T.registrado.aceito
                : `Resposta registrada: ${RESULTADO[aceite.resultado]}`}
            </Text>
            <Text>
              Em {registradoEm} (horário de Brasília), por {aceite.clienteNome}
              {aceite.clienteCpf ? `, CPF ${maskCpf(aceite.clienteCpf)}` : ""}, com confirmação por
              código enviado ao e-mail {maskEmail(partes.cliente.email)}.
            </Text>
          </View>
        </View>

        <Secao titulo="Partes">
          <View style={s.grade}>
            <Campo rotulo="Prestador">{prestador}</Campo>
            <Campo rotulo="Cliente">{partes.cliente.nome}</Campo>
          </View>
        </Secao>

        <Secao titulo={entrega ? "Entrega confirmada" : "Documento aceito"}>
          <View style={s.grade}>
            <Campo rotulo="Título" inteiro>
              {partes.titulo}
            </Campo>
            {partes.referencia && (
              <Campo rotulo="Refere-se à proposta" inteiro>
                {`${partes.referencia.titulo} (hash ${partes.referencia.hash_documento.slice(0, 16)}…)`}
              </Campo>
            )}
            <Campo rotulo="Versão">{String(versao.numero)}</Campo>
            <Campo rotulo="Enviada em">
              {versao.enviadaEm ? formatDateTime(versao.enviadaEm) : "—"}
            </Campo>
            {!entrega && <Campo rotulo="Prazo">{conteudo.prazo || "—"}</Campo>}
            {!entrega && (
              <Campo rotulo="Valor total">{formatCentavos(conteudo.valor_total_centavos)}</Campo>
            )}
          </View>

          {entrega ? (
            <CorpoEntrega entrega={entrega} imagens={imagens} />
          ) : (
            <CorpoProposta conteudo={conteudo} />
          )}
        </Secao>

        <Secao titulo="Registro da resposta">
          <View style={s.grade}>
            <Campo rotulo="Resultado">{RESULTADO[aceite.resultado]}</Campo>
            <Campo rotulo="Data e hora">{registradoEm}</Campo>
            <Campo rotulo="Nome informado">{aceite.clienteNome}</Campo>
            <Campo rotulo="CPF">{aceite.clienteCpf ? maskCpf(aceite.clienteCpf) : "—"}</Campo>
            <Campo rotulo="Código confirmado em">{formatDateTime(aceite.otpVerificadoEm)}</Campo>
            <Campo rotulo="IP">{aceite.ip ?? "não identificado"}</Campo>
            <Campo rotulo="Dispositivo" inteiro>
              {summarizeUserAgent(aceite.userAgent)}
            </Campo>
          </View>
          <View style={s.consentimento} wrap={false}>
            <Text style={s.rotulo}>Texto confirmado pelo cliente</Text>
            <Text>{aceite.textoConsentimento}</Text>
          </View>
          {aceite.comentario ? (
            <View style={{ marginTop: 6 }} wrap={false}>
              <Text style={s.rotulo}>Comentário do cliente</Text>
              <Text>{aceite.comentario}</Text>
            </View>
          ) : null}
        </Secao>

        <Secao titulo="Integridade">
          <View wrap={false}>
            <Text style={s.rotulo}>Hash SHA-256 do documento enviado</Text>
            <Text style={s.hash}>{aceite.hashDocumento}</Text>
            <Text style={{ marginTop: 4, color: COR.slate600 }}>
              O hash é uma impressão digital do documento: se qualquer letra mudar, ele muda. Para
              conferir, acesse {urlVerificacao} e informe o código {aceite.codigo}.
            </Text>
          </View>
        </Secao>

        <Secao titulo="Trilha de auditoria">
          <View style={s.tabela}>
            <View style={s.cabecalhoTabela} fixed>
              <Text style={[s.celula, s.rotulo, { width: COLUNAS.data }]}>Data e hora</Text>
              <Text style={[s.celula, s.rotulo, { width: COLUNAS.evento }]}>Evento</Text>
              <Text style={[s.celula, s.rotulo, { width: COLUNAS.ip }]}>IP</Text>
              <Text style={[s.celula, s.rotulo, { width: COLUNAS.dispositivo }]}>Dispositivo</Text>
            </View>
            {eventos.map((e, i) => (
              <View key={i} style={s.linhaTabela} wrap={false}>
                <Text style={[s.celula, { width: COLUNAS.data }]}>
                  {formatDateTime(e.criadoEm)}
                </Text>
                <Text style={[s.celula, { width: COLUNAS.evento }]}>{EVENTO[e.tipo]}</Text>
                <Text style={[s.celula, { width: COLUNAS.ip }]}>{e.ip ?? "—"}</Text>
                <Text style={[s.celula, { width: COLUNAS.dispositivo }]}>
                  {e.userAgent ? summarizeUserAgent(e.userAgent) : "—"}
                </Text>
              </View>
            ))}
          </View>
          <Text style={{ marginTop: 4, fontSize: 7.5, color: COR.slate600 }}>
            Horários de Brasília. Eventos registrados pelo servidor do Zelo e guardados sem
            possibilidade de alteração.
          </Text>
        </Secao>

        <View style={s.rodape} fixed>
          <Text>Zelo · {aceite.codigo}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/** Escopo, itens, exclusões, pagamento e garantia (proposta e aditivo). */
function CorpoProposta({ conteudo }: { conteudo: DadosComprovante["conteudo"] }) {
  return (
    <>
      {conteudo.escopo ? (
        <View style={{ marginTop: 2 }}>
          <Text style={s.rotulo}>Escopo</Text>
          <Text style={s.paragrafo}>{conteudo.escopo}</Text>
        </View>
      ) : null}

      {conteudo.itens.length > 0 && (
        <View style={{ marginTop: 6 }}>
          <Text style={s.rotulo}>O que está incluso</Text>
          {conteudo.itens.map((item, i) => (
            <View key={i} style={s.item} wrap={false}>
              <View style={s.itemColuna}>
                <Text style={s.itemDescricao}>{item.descricao}</Text>
                <Text style={s.itemDetalhe}>
                  {formatDecimal(item.quantidade)} {item.unidade} ×{" "}
                  {formatCentavos(item.valor_unitario_centavos)}
                </Text>
              </View>
              <Text style={s.itemTotal}>{formatCentavos(totalItemCentavos(item))}</Text>
            </View>
          ))}
          <View style={s.total} wrap={false}>
            <Text>Total</Text>
            <Text>{formatCentavos(conteudo.valor_total_centavos)}</Text>
          </View>
        </View>
      )}

      {conteudo.exclusoes.length > 0 && (
        <View style={s.exclusoes} wrap={false}>
          <Text style={s.exclusoesTitulo}>Não está incluso</Text>
          {conteudo.exclusoes.map((e, i) => (
            <Text key={i}>• {e}</Text>
          ))}
        </View>
      )}

      <View style={[s.grade, { marginTop: 8 }]}>
        <Campo rotulo="Pagamento" inteiro>
          {conteudo.pagamento || "—"}
        </Campo>
        <Campo rotulo="Garantia" inteiro>
          {conteudo.garantia || "—"}
        </Campo>
        {conteudo.observacoes ? (
          <Campo rotulo="Observações" inteiro>
            {conteudo.observacoes}
          </Campo>
        ) : null}
      </View>
    </>
  );
}

/** Resumo, checklist e fotos da entrega. Cada foto leva o seu SHA-256 (o hash do documento cobre os bytes). */
function CorpoEntrega({
  entrega,
  imagens,
}: {
  entrega: NonNullable<DadosComprovante["entrega"]>;
  imagens: ImagensPdf;
}) {
  return (
    <>
      <View style={{ marginTop: 2 }}>
        <Text style={s.rotulo}>O que foi entregue</Text>
        <Text style={s.paragrafo}>{entrega.resumo}</Text>
      </View>

      <View style={{ marginTop: 6 }}>
        <Text style={s.rotulo}>Checklist</Text>
        {entrega.checklist.map((item, i) => (
          <View key={i} style={s.item} wrap={false}>
            <View style={s.itemColuna}>
              <Text style={s.itemDescricao}>{item.texto}</Text>
            </View>
            <Text style={s.itemTotal}>{item.feito ? "Entregue" : "Pendente"}</Text>
          </View>
        ))}
      </View>

      {entrega.fotos.length > 0 && (
        <View style={{ marginTop: 8 }}>
          <Text style={s.rotulo}>{`Fotos (${entrega.fotos.length})`}</Text>
          <View style={s.fotos}>
            {entrega.fotos.map((f) => {
              const img = imagens[f.path];
              return (
                <View key={f.path} style={s.foto} wrap={false}>
                  {img ? (
                    // <Image> do react-pdf (não é um <img> de HTML; PDF não tem atributo alt):
                    // a legenda abaixo descreve a foto.
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image src={{ data: img.data, format: img.formato }} style={s.fotoImagem} />
                  ) : (
                    <View style={[s.fotoImagem, s.fotoSem]}>
                      <Text style={s.itemDetalhe}>Imagem não incluída neste PDF</Text>
                    </View>
                  )}
                  <Text style={s.itemDetalhe}>{f.nome}</Text>
                  {f.sha256 && <Text style={s.hashFoto}>{`SHA-256 ${f.sha256}`}</Text>}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {entrega.observacoes ? (
        <View style={{ marginTop: 6 }}>
          <Text style={s.rotulo}>Observações</Text>
          <Text style={s.paragrafo}>{entrega.observacoes}</Text>
        </View>
      ) : null}
    </>
  );
}

/** Gera o PDF em memória. Roda só no servidor (runtime Node). */
export async function renderizarComprovante(props: ComprovanteProps): Promise<Buffer> {
  registrarFontes();
  // Textos digitados por pessoas podem ter caracteres que a fonte não desenha (lib/pdf/texto.ts).
  const dados = sanitizarParaPdf(props.dados);
  return renderToBuffer(
    <ComprovantePdf dados={dados} urlVerificacao={props.urlVerificacao} imagens={props.imagens} />,
  );
}
