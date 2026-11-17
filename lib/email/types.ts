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
