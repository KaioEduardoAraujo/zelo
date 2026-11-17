import { createCn } from "cn/config";

// text-h1, text-support… são tamanhos de fonte. Sem registrá-los, o merge os trata como cor
// e descarta o tamanho quando há uma cor junto.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display", "h1", "h2", "h3", "body", "support", "label"] }],
    },
  },
});
