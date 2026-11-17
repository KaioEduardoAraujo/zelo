import { formatDateTime } from "@/lib/format";
import type { AcaoCliente } from "@/lib/publico/otp";
import { textosDe, type TipoDocumento } from "@/lib/tipos";

/*
 * Templates de e-mail. Título da proposta e nome do prestador são digitados por usuários:
 * tudo o que entra no HTML passa por `escapeHtml` (evita injetar HTML/links num e-mail que
 * sai com o nome do Zelo).
 */
export function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailMontado = { assunto: string; html: string; texto: string };

export function emailCodigo(p: {
  codigo: string;
  acao: AcaoCliente;
  titulo: string;
  prestador: string;
  minutos: number;
  /** Proposta se omitido. */
  tipo?: TipoDocumento;
}): EmailMontado {
  const frase = `${textosDe(p.tipo).paraCodigo[p.acao]} “${p.titulo}”`;

  const texto = [
    `Seu código para ${frase}, de ${p.prestador}:`,
    "",
    p.codigo,
    "",
    `Ele vale por ${p.minutos} minutos e só pode ser usado uma vez.`,
    "Se você não pediu este código, ignore este e-mail.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#F1F5F5;font-family:Arial,Helvetica,sans-serif;color:#12263A">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #DCE5E6;border-radius:12px">
      <tr><td style="padding:28px 24px">
        <p style="margin:0 0 12px;font-size:16px;line-height:24px;color:#52667A">Seu código para ${escapeHtml(frase)}, de ${escapeHtml(p.prestador)}:</p>
        <p style="margin:0 0 16px;font-family:'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:#12263A">${escapeHtml(p.codigo)}</p>
        <p style="margin:0 0 8px;font-size:14px;line-height:20px;color:#52667A">Ele vale por ${p.minutos} minutos e só pode ser usado uma vez.</p>
        <p style="margin:0;font-size:14px;line-height:20px;color:#52667A">Se você não pediu este código, ignore este e-mail.</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { assunto: `${p.codigo} é o seu código no Zelo`, html, texto };
}

/**
 * Comprovante do aceite, com o PDF anexo. Vai para o cliente e para o prestador, com textos
 * diferentes. Nada de dados pessoais além do nome que já está no documento.
 */
export function emailComprovante(p: {
  para: "cliente" | "prestador";
  /** Proposta se omitido. */
  tipo?: TipoDocumento;
  titulo: string;
  prestador: string;
  clienteNome: string;
  codigo: string;
  registradoEm: string;
  urlVerificacao: string;
  urlPainel: string;
}): EmailMontado {
  const T = textosDe(p.tipo);
  const quando = formatDateTime(p.registradoEm);
  const abertura =
    p.para === "cliente"
      ? `${T.acaoPositiva.cliente} “${p.titulo}”, de ${p.prestador}, em ${quando}.`
      : `${p.clienteNome} ${T.acaoPositiva.prestador} “${p.titulo}” em ${quando}.`;
  const verificar = `${p.urlVerificacao}?codigo=${encodeURIComponent(p.codigo)}`;

  const texto = [
    abertura,
    "",
    `Código do comprovante: ${p.codigo}`,
    "O comprovante em PDF, com a trilha de auditoria e o hash do documento, está anexo.",
    "",
    `Para conferir a autenticidade: ${verificar}`,
    ...(p.para === "prestador" ? ["", `Ver a proposta no Zelo: ${p.urlPainel}`] : []),
  ].join("\n");

  const botaoPainel =
    p.para === "prestador"
      ? `<p style="margin:16px 0 0"><a href="${escapeHtml(p.urlPainel)}" style="display:inline-block;background:#1F7A70;color:#FFFFFF;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px">Ver a proposta no Zelo</a></p>`
      : "";

  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#F1F5F5;font-family:Arial,Helvetica,sans-serif;color:#12263A">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #DCE5E6;border-radius:12px">
      <tr><td style="padding:28px 24px">
        <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#1F7A70">${escapeHtml(T.registrado.aceito)}</p>
        <p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#12263A">${escapeHtml(abertura)}</p>
        <p style="margin:0 0 4px;font-size:13px;color:#52667A">Código do comprovante</p>
        <p style="margin:0 0 16px;font-family:'Courier New',monospace;font-size:20px;font-weight:700;letter-spacing:2px;color:#12263A">${escapeHtml(p.codigo)}</p>
        <p style="margin:0 0 8px;font-size:14px;line-height:20px;color:#52667A">O comprovante em PDF, com a trilha de auditoria e o hash do documento, está anexo. Guarde este e-mail.</p>
        <p style="margin:0;font-size:14px;line-height:20px;color:#52667A">Para conferir a autenticidade, acesse <a href="${escapeHtml(verificar)}" style="color:#1F7A70">${escapeHtml(p.urlVerificacao)}</a>.</p>
        ${botaoPainel}
      </td></tr>
    </table>
  </body>
</html>`;

  const assunto =
    p.para === "cliente"
      ? `${T.assuntoCliente}: ${p.titulo}`
      : `${T.assuntoPrestador}: ${p.titulo}`;

  return { assunto, html, texto };
}
