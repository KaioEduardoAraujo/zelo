/*
 * Interface de envio de e-mail (decisão D3). O resto do sistema só conhece esta interface:
 * trocar Resend por SMTP (ou por outro serviço) é mudar uma variável de ambiente.
 */
export type MensagemEmail = {
  para: string;
  assunto: string;
  html: string;
  texto: string;
  anexos?: { nome: string; conteudo: Buffer; tipo: string }[];
};

export interface EmailProvider {
  enviar(mensagem: MensagemEmail & { de: string }): Promise<void>;
}
