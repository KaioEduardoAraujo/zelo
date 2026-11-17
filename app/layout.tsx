import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";

import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Zelo — Combinou? Registrou.",
    template: "%s · Zelo",
  },
  description:
    "Propostas, escopos e entregas que o cliente aceita pelo celular, com comprovante e trilha de auditoria.",
};

export const viewport: Viewport = {
  themeColor: "#F1F5F5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
