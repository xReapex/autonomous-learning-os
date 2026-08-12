import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

async function source(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

describe("contrat web SCIO", () => {
  it("rebaptise les métadonnées et le shell sans ancien nom", async () => {
    const [layout, shell, manifest] = await Promise.all([
      source("src/app/layout.tsx"),
      source("src/components/learning-shell.tsx"),
      source("src/app/manifest.ts"),
    ]);
    for (const content of [layout, shell, manifest]) {
      expect(content).toContain("SCIO");
      expect(content).not.toMatch(/Learning OS|Focus Ledger/);
    }
  });

  it("compose les providers de langue et de récompenses sans runtime natif", async () => {
    const [rootLayout, learningLayout, shell] = await Promise.all([
      source("src/app/layout.tsx"),
      source("src/app/(learning)/layout.tsx"),
      source("src/components/learning-shell.tsx"),
    ]);
    expect(learningLayout).toContain("<LocaleProvider>");
    expect(learningLayout).toContain("<RewardsProvider>");
    expect(rootLayout).not.toContain("<LocaleProvider>");
    expect(`${rootLayout}${learningLayout}`).not.toContain("NativeRuntime");
    expect(shell).not.toContain("@capacitor");
    expect(shell).toContain("useLocale");
    expect(shell).toContain("RewardSummary");
  });

  it("retire les dépendances et scripts Capacitor du package web", async () => {
    const packageJson = JSON.parse(await source("package.json")) as {
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(Object.keys(packageJson.scripts)).not.toContain(expect.stringMatching(/^mobile:/));
    expect(Object.keys(packageJson.dependencies)).not.toContain(expect.stringContaining("capacitor"));
    expect(Object.keys(packageJson.devDependencies)).not.toContain(expect.stringContaining("capacitor"));
  });

  it("branche toute page utilisateur sur le provider typé", async () => {
    const files = [
      "src/components/dashboard.tsx",
      "src/components/course-page.tsx",
      "src/components/exercises-page.tsx",
      "src/components/reviews-page.tsx",
      "src/components/settings-page.tsx",
      "src/components/curriculum-editor.tsx",
      "src/components/tracked-video.tsx",
    ];
    for (const file of files) expect(await source(file), file).toContain("useLocale");
  });

  it("garde des cibles de 44 px et un focus clavier visible", async () => {
    const css = await source("src/app/globals.css");
    expect(css).toMatch(/:focus-visible/);
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("min-width: 44px");
  });

  it("référence uniquement l'identité SCIO v4 dans le manifeste PWA", async () => {
    const [manifest, icon, layout] = await Promise.all([
      source("src/app/manifest.ts"),
      source("public/icon.svg"),
      source("src/app/layout.tsx"),
    ]);
    expect(manifest).toContain('theme_color: "#0B5D57"');
    expect(layout).toContain('themeColor: "#0B5D57"');
    expect(icon).toContain('aria-label="SCIO"');
    expect(icon).toContain("#0B5D57");
    expect(icon).toContain("#F4F1E9");
    expect(icon).not.toMatch(/#C44329|<circle|M182 154/);
  });

  it("garde tous les SVG de marque web sur les tracés serif v4", async () => {
    const [mark, mono, wordmark, reverse, lockup] = await Promise.all([
      source("public/scio-mark.svg"),
      source("public/scio-mark-mono.svg"),
      source("public/scio-wordmark.svg"),
      source("public/scio-wordmark-reverse.svg"),
      source("public/scio-lockup.svg"),
    ]);
    for (const asset of [mark, mono, wordmark, reverse, lockup]) {
      expect(asset).not.toMatch(/<circle|#E85D3F|M43 15H27|\n\d+\|/);
      expect(asset).toContain('aria-label="SCIO"');
    }
    expect(mark).toContain("#0B5D57");
    expect(mono).toContain("#10231F");
    expect(wordmark).toContain('viewBox="0 0 1544.00 811.00"');
    expect(reverse).toContain('viewBox="0 0 1544.00 811.00"');
    expect(lockup).toContain("#10231F");
  });
});
