import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { defaultCurriculumDocument } from "@/lib/curriculum";
import { createCurriculumStore, MAX_CURRICULUM_BYTES } from "@/lib/curriculum-store";
import { createCurriculumRouteHandlers } from "./route";

const directories: string[] = [];
const MUTATION_SECRET = "0123456789abcdef0123456789abcdef";
const TRUSTED_ORIGIN = "https://learning.test";

async function testStore() {
  const dataDir = await mkdtemp(join(tmpdir(), "learning-os-route-"));
  directories.push(dataDir);
  return createCurriculumStore({ dataDir, deliveredDocument: defaultCurriculumDocument });
}

beforeEach(() => {
  process.env.APP_URL = TRUSTED_ORIGIN;
  process.env.CURRICULUM_MUTATION_SECRET = MUTATION_SECRET;
});

afterEach(async () => {
  delete process.env.APP_URL;
  delete process.env.CURRICULUM_MUTATION_SECRET;
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("/api/curriculum", () => {
  it("renvoie le document actif sans cache avec son ETag", async () => {
    const handlers = createCurriculumRouteHandlers(await testStore());

    const response = await handlers.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("etag")).toMatch(/^"[a-f0-9]{64}"$/);
    expect(body.source).toBe("delivered");
    expect(body.document.version).toBe(1);
  });

  it("remplace le curriculum avec une requête JSON de même origine et révision", async () => {
    const store = await testStore();
    const handlers = createCurriculumRouteHandlers(store);
    const before = await store.load();
    const candidate = structuredClone(defaultCurriculumDocument);
    candidate.subject = "Cursus via API";
    const request = new Request("https://learning.test/api/curriculum", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "if-match": `"${before.revision}"`,
        origin: "https://learning.test",
        host: "learning.test",
        "x-learning-os-mutation-secret": MUTATION_SECRET,
      },
      body: JSON.stringify(candidate),
    });

    const response = await handlers.PUT(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.document.subject).toBe("Cursus via API");
    expect(body.revision).not.toBe(before.revision);
    expect((await store.load()).document.subject).toBe("Cursus via API");
  });

  it("refuse une mutation provenant d'une autre origine", async () => {
    const store = await testStore();
    const handlers = createCurriculumRouteHandlers(store);
    const before = await store.load();
    const request = new Request("https://learning.test/api/curriculum", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "if-match": `"${before.revision}"`,
        origin: "https://evil.example",
        host: "learning.test",
        "x-learning-os-mutation-secret": MUTATION_SECRET,
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify(defaultCurriculumDocument),
    });

    const response = await handlers.PUT(request);

    expect(response.status).toBe(403);
    expect((await store.load()).source).toBe("delivered");
  });

  it("refuse une mutation sans preuve d'authentification du reverse proxy", async () => {
    const store = await testStore();
    const handlers = createCurriculumRouteHandlers(store);
    const request = new Request("https://learning.test/api/curriculum", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "if-match": `"${(await store.load()).revision}"`,
        origin: TRUSTED_ORIGIN,
      },
      body: JSON.stringify(defaultCurriculumDocument),
    });

    expect((await handlers.PUT(request)).status).toBe(403);
  });

  it("refuse une mutation sans en-tête Origin", async () => {
    const store = await testStore();
    const handlers = createCurriculumRouteHandlers(store);
    const request = new Request("https://learning.test/api/curriculum", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "if-match": `"${(await store.load()).revision}"`,
        "x-learning-os-mutation-secret": MUTATION_SECRET,
      },
      body: JSON.stringify(defaultCurriculumDocument),
    });

    expect((await handlers.PUT(request)).status).toBe(403);
  });

  it("ignore les en-têtes X-Forwarded-* forgés par le client", async () => {
    const store = await testStore();
    const handlers = createCurriculumRouteHandlers(store);
    const request = new Request("https://learning.test/api/curriculum", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "if-match": `"${(await store.load()).revision}"`,
        origin: "https://evil.example",
        "sec-fetch-site": "none",
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
        "x-learning-os-mutation-secret": MUTATION_SECRET,
      },
      body: JSON.stringify(defaultCurriculumDocument),
    });

    expect((await handlers.PUT(request)).status).toBe(403);
  });

  it("refuse un If-Match faible", async () => {
    const store = await testStore();
    const handlers = createCurriculumRouteHandlers(store);
    const revision = (await store.load()).revision;
    const request = new Request("https://learning.test/api/curriculum", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "if-match": `W/"${revision}"`,
        origin: TRUSTED_ORIGIN,
        "x-learning-os-mutation-secret": MUTATION_SECRET,
      },
      body: JSON.stringify(defaultCurriculumDocument),
    });

    expect((await handlers.PUT(request)).status).toBe(400);
  });

  it("refuse un type de contenu autre que JSON", async () => {
    const store = await testStore();
    const handlers = createCurriculumRouteHandlers(store);
    const before = await store.load();
    const request = new Request("https://learning.test/api/curriculum", {
      method: "PUT",
      headers: {
        "content-type": "text/plain",
        "if-match": `"${before.revision}"`,
        origin: "https://learning.test",
        host: "learning.test",
        "x-learning-os-mutation-secret": MUTATION_SECRET,
      },
      body: JSON.stringify(defaultCurriculumDocument),
    });

    expect((await handlers.PUT(request)).status).toBe(415);
  });

  it("interrompt un corps supérieur à la limite même sans Content-Length", async () => {
    const store = await testStore();
    const handlers = createCurriculumRouteHandlers(store);
    const request = new Request("https://learning.test/api/curriculum", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "if-match": `"${(await store.load()).revision}"`,
        origin: "https://learning.test",
        host: "learning.test",
        "x-learning-os-mutation-secret": MUTATION_SECRET,
      },
      body: `"${"x".repeat(MAX_CURRICULUM_BYTES)}"`,
    });

    expect((await handlers.PUT(request)).status).toBe(413);
  });

  it("réinitialise la surcharge avec DELETE et If-Match", async () => {
    const store = await testStore();
    const handlers = createCurriculumRouteHandlers(store);
    const candidate = structuredClone(defaultCurriculumDocument);
    candidate.subject = "À réinitialiser";
    const saved = await store.replace(candidate, (await store.load()).revision);
    const request = new Request("https://learning.test/api/curriculum", {
      method: "DELETE",
      headers: {
        "if-match": `"${saved.revision}"`,
        origin: "https://learning.test",
        host: "learning.test",
        "x-learning-os-mutation-secret": MUTATION_SECRET,
      },
    });

    const response = await handlers.DELETE(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe("delivered");
    expect(body.document.subject).toBe(defaultCurriculumDocument.subject);
  });
});
