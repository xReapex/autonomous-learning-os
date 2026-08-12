import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const REGRESSION_LESSON_ID = "ts-01-generiques";
const dataDir = mkdtempSync(join(tmpdir(), "learning-os-reviews-red-"));
const progressPath = join(dataDir, "progress.json");
let server;
let browser;
let serverOutput = "";

function assertNoProgress(label) {
  const keys = existsSync(progressPath)
    ? Object.keys(JSON.parse(readFileSync(progressPath, "utf8")))
    : [];
  if (keys.includes(REGRESSION_LESSON_ID)) {
    throw new Error(`${label}: effet de bord détecté, progress.json contient ${REGRESSION_LESSON_ID}`);
  }
  console.log(`PASS ${label}: aucune progression créée`);
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") return reject(new Error("Port local introuvable"));
      probe.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForServer(url) {
  const deadline = Date.now() + 60_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Le serveur local n'a pas démarré : ${String(lastError)}\n${serverOutput}`);
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    const modulePath = process.env.PLAYWRIGHT_MODULE;
    if (modulePath && existsSync(modulePath)) return import(pathToFileURL(modulePath).href);
    throw new Error(`Playwright introuvable. Installer playwright ou définir PLAYWRIGHT_MODULE (${error instanceof Error ? error.message : String(error)}).`);
  }
}

function installIsolatedCurriculum() {
  const deliveredPath = join(process.cwd(), "content", "curriculum.json");
  const delivered = JSON.parse(readFileSync(deliveredPath, "utf8"));
  const originalFirstLessonId = delivered.subjects[0].lessons[0].id;
  const fixture = JSON.parse(
    JSON.stringify(delivered).replaceAll(originalFirstLessonId, REGRESSION_LESSON_ID),
  );
  writeFileSync(join(dataDir, "curriculum.json"), `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
}

async function freshPage(baseUrl, initialPath) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.route(/youtube(?:-nocookie)?\.com/, (route) => route.abort());
  await page.goto(`${baseUrl}${initialPath}`);
  return { context, page };
}

async function run() {
  installIsolatedCurriculum();
  const { chromium } = await loadPlaywright();
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    {
      cwd: process.cwd(),
      env: { ...process.env, LEARNING_DATA_DIR: dataDir, STORAGE_DRIVER: "file" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on("data", (chunk) => { serverOutput += String(chunk); });
  server.stderr.on("data", (chunk) => { serverOutput += String(chunk); });
  await waitForServer(`${baseUrl}/reviews`);
  browser = await chromium.launch({ headless: true });

  // Contrôle 1 : Révisions elle-même ne monte aucun lecteur suivi.
  {
    const { context, page } = await freshPage(baseUrl, "/reviews");
    await page.waitForResponse((response) => response.url().endsWith("/api/cards"));
    assertNoProgress("ouverture directe de /reviews");
    await context.close();
  }

  // Contrôle 2 : une navigation entre deux pages sans lecteur reste sans mutation.
  {
    const { context, page } = await freshPage(baseUrl, "/reviews");
    await page.locator('a[href="/settings"]:visible').click();
    await page.waitForURL(`${baseUrl}/settings`);
    await page.waitForTimeout(500);
    assertNoProgress("navigation /reviews → /settings");
    await context.close();
  }

  // Cas RED : l'accueil monte TrackedVideo ; son démontage vers /reviews force un PUT vierge.
  {
    const { context, page } = await freshPage(baseUrl, "");
    const progressPuts = [];
    page.on("request", (request) => {
      if (request.method() === "PUT" && request.url().includes("/api/progress/")) {
        progressPuts.push(request.url());
      }
    });
    await page.waitForResponse((response) =>
      response.request().method() === "GET" && response.url().endsWith(`/api/progress/${REGRESSION_LESSON_ID}`),
    );
    assertNoProgress("accueil au repos avant navigation");
    await page.locator('.bx-sidebar a[href="/reviews"]').click();
    await page.waitForURL(`${baseUrl}/reviews`);
    await page.waitForTimeout(1_000);
    console.log(`TRACE PUT progression: ${progressPuts.join(", ") || "aucun"}`);
    assertNoProgress("navigation / → /reviews");
    await context.close();
  }
}

try {
  await run();
  console.log("GREEN: ouvrir Révisions n'a créé aucune progression utilisateur.");
} catch (error) {
  console.error(`RED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => undefined);
  if (server && !server.killed) {
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      server.once("exit", resolve);
      setTimeout(resolve, 5_000);
    });
  }
  rmSync(dataDir, { recursive: true, force: true });
}
