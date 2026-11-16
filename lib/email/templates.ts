import type { AcaoCliente } from "@/lib/publico/otp";

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

const PARA_QUE: Record<AcaoCliente, (titulo: string) => string> = {
  aceito: (t) => `aceitar a proposta “${t}”`,
  recusado: (t) => `recusar a proposta “${t}”`,
  ajuste: (t) => `pedir ajuste na proposta “${t}”`,
};

export type EmailMontado = { assunto: string; html: string; texto: string };

export function emailCodigo(p: {
  codigo: string;
  acao: AcaoCliente;
  titulo: string;
  prestador: string;
  minutos: number;
}): EmailMontado {
  const frase = PARA_QUE[p.acao](p.titulo);

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
