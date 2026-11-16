import { createCn } from "cn/config";

/*
 * `cn` = junta classes e resolve conflitos (a última vence), no padrão do shadcn/ui.
 *
 * As classes de tipografia da Zelo (text-h1, text-support…, definidas em app/globals.css) são
 * TAMANHOS de fonte. Sem avisar isso, o motor acha que `text-h1` é uma COR (tudo que começa
 * com `text-` e não conhece) e descarta o tamanho quando há uma cor junto:
 *   cn("text-h1 text-navy-950")  →  "text-navy-950"   (título sem tamanho nenhum)
 * Registrá-las como "font-size" corrige o conflito: tamanho e cor convivem.
 */
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "h1", "h2", "h3", "body", "support", "label"] }],
    },
  },
});
