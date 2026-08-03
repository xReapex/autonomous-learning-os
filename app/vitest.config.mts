import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Les tests portent sur la logique pure (planification, SM-2, parsing du
// curriculum, fonds d'écran). Pas de DOM : les composants sont vérifiés par le
// smoke test HTTP de scripts/05-verify.sh, qui teste ce qui compte vraiment —
// que les pages répondent.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
