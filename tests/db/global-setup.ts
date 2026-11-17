import { execSync } from "node:child_process";

import type { TestProject } from "vitest/node";

// Só roda contra o Supabase local.
export default function setup(project: TestProject) {
  let raw: string;
  try {
    raw = execSync("npx supabase status -o json", {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
  } catch {
    throw new Error(
      "Supabase local não está rodando. Execute `npm run db:start` antes de `npm run test:db`.",
    );
  }
  const status = JSON.parse(raw) as Record<string, string>;
  const url = status.API_URL;
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
    throw new Error("Os testes de banco só rodam contra o Supabase local.");
  }
  project.provide("supabase", {
    url,
    publishableKey: status.PUBLISHABLE_KEY,
    secretKey: status.SECRET_KEY,
  });
}

declare module "vitest" {
  export interface ProvidedContext {
    supabase: { url: string; publishableKey: string; secretKey: string };
  }
}
