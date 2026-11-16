/*
 * Resume o user agent para exibir na trilha de auditoria ("Android 15, Chrome 131").
 * O user agent completo continua gravado no banco; isto é só para leitura humana.
 */
export function summarizeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Dispositivo não identificado";

  const os =
    match(ua, /Android (\d+)/, (v) => `Android ${v}`) ??
    match(ua, /iPhone OS (\d+)/, (v) => `iPhone, iOS ${v}`) ??
    match(ua, /iPad; CPU OS (\d+)/, (v) => `iPad, iPadOS ${v}`) ??
    match(ua, /Windows NT/, () => "Windows") ??
    match(ua, /Mac OS X/, () => "macOS") ??
    match(ua, /CrOS/, () => "ChromeOS") ??
    match(ua, /Linux/, () => "Linux");

  const browser =
    match(ua, /Edg\/(\d+)/, (v) => `Edge ${v}`) ??
    match(ua, /SamsungBrowser\/(\d+)/, (v) => `Samsung Internet ${v}`) ??
    match(ua, /OPR\/(\d+)/, (v) => `Opera ${v}`) ??
    match(ua, /Firefox\/(\d+)/, (v) => `Firefox ${v}`) ??
    match(ua, /CriOS\/(\d+)/, (v) => `Chrome ${v}`) ??
    match(ua, /Chrome\/(\d+)/, (v) => `Chrome ${v}`) ??
    match(ua, /Version\/(\d+).*Safari/, (v) => `Safari ${v}`);

  return [os, browser].filter(Boolean).join(", ") || "Dispositivo não identificado";
}

function match(ua: string, re: RegExp, fmt: (v: string) => string): string | undefined {
  const m = ua.match(re);
  return m ? fmt(m[1] ?? "") : undefined;
}
