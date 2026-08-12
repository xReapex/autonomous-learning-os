import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(process.cwd(), "..");

async function deploymentFile(name: string) {
  return readFile(join(repositoryRoot, "deploy", name), "utf8");
}

async function markdownFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", ".next", "node_modules"].includes(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path);
  }
  return files;
}

describe("contrat de déploiement isolé", () => {
  it("exécute la preview sur le même artefact avec identité et stockage isolés", async () => {
    const [service, environment, nginx] = await Promise.all([
      deploymentFile("scio-preview.service"),
      deploymentFile("scio-preview.env.example"),
      deploymentFile("nginx-scio-preview.conf"),
    ]);

    expect(service).toContain("WorkingDirectory=/opt/autonomous-learning-os/app");
    expect(service).toContain("EnvironmentFile=/etc/scio-preview/runtime.env");
    expect(service).toContain("-p 4324");
    expect(service).toContain("ReadWritePaths=/var/lib/scio-preview");
    expect(environment).toContain("NODE_ENV=production");
    expect(environment).toContain("SCIO_DEPLOYMENT_ENV=preview");
    expect(environment).toContain("SCIO_AUTH_MODE=development");
    expect(environment).toContain("SCIO_AUTH_DATA_DIR=/var/lib/scio-preview/scio-auth");
    expect(environment).toContain("SCIO_USER_DATA_DIR=/var/lib/scio-preview/scio-users");
    expect(environment).not.toContain("MOBILE_API_TOKEN");
    expect(nginx).toContain("server_name scio-preview.141.227.152.154.nip.io");
    expect(nginx).toContain("proxy_pass http://127.0.0.1:4324");
    expect(nginx).toContain("limit_req_status 429;");
    expect(nginx).toContain("location ^~ /api/mobile/auth/");
    expect(nginx).toContain("location ^~ /api/mobile/data/");
    expect(nginx).toContain("location = /api/mobile/curriculum/interview");
    expect(nginx).toContain("proxy_read_timeout 360s;");
    expect(nginx).toContain("proxy_send_timeout 360s;");
    expect(nginx).toMatch(/location \/ \{\s*return 404;/);
  });

  it("lie Next.js à loopback avec le profil fail-closed", async () => {
    const [service, environment] = await Promise.all([
      deploymentFile("autonomous-learning-os.service"),
      deploymentFile("runtime.env.example"),
    ]);

    expect(service).toContain("-H 127.0.0.1 -p 4310");
    expect(service).toContain("EnvironmentFile=/etc/autonomous-learning-os/runtime.env");
    expect(service).toContain("IPAddressDeny=any");
    expect(environment).toContain("HOSTED_SAFE_MODE=true");
    expect(environment).toContain("TELEGRAM_ENABLED=false");
    expect(environment).toContain("CURRICULUM_MUTATION_SECRET=");
    expect(environment).not.toContain("MOBILE_API_TOKEN=");
    expect(environment).toContain("APP_URL=https://");
  });

  it("authentifie tout le virtual host et remplace le secret client", async () => {
    const nginx = await deploymentFile("nginx-autonomous-learning-os.conf");

    expect(nginx).toContain('auth_basic "Autonomous Learning OS"');
    expect(nginx).toContain("location = /api/curriculum");
    expect(nginx).toContain("location = /api/curriculum/interview");
    expect(nginx).toContain("autonomous-learning-os-mutation-secret.conf");
    expect(nginx.match(/proxy_set_header X-Learning-OS-Mutation-Secret "";/g)?.length).toBeGreaterThanOrEqual(2);
    expect(nginx).toContain("proxy_pass http://127.0.0.1:4310");
    expect(nginx.match(/proxy_set_header Authorization "";/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("n’expose publiquement que les routes mobiles protégées par session SCIO", async () => {
    const nginx = await deploymentFile("nginx-autonomous-learning-os.conf");
    expect(nginx).toContain("limit_req_status 429;");
    const mobileInterview = /location = \/api\/mobile\/curriculum\/interview \{([\s\S]*?)\n    \}/.exec(nginx)?.[1] ?? "";

    const mobileAuth = /location \^~ \/api\/mobile\/auth\/ \{([\s\S]*?)\n    \}/.exec(nginx)?.[1] ?? "";
    const mobileData = /location \^~ \/api\/mobile\/data\/ \{([\s\S]*?)\n    \}/.exec(nginx)?.[1] ?? "";

    expect(mobileInterview).toContain("auth_basic off");
    expect(mobileInterview).toContain("proxy_set_header Authorization $http_authorization");
    expect(mobileInterview).toContain('proxy_set_header X-Learning-OS-Mutation-Secret ""');
    expect(mobileInterview).toContain("proxy_read_timeout 360s");

    for (const boundary of [mobileAuth, mobileData]) {
      expect(boundary).toContain("auth_basic off");
      expect(boundary).toContain("proxy_set_header Authorization $http_authorization");
      expect(boundary).toContain('proxy_set_header X-Learning-OS-Mutation-Secret ""');
      expect(boundary).toContain('proxy_set_header X-Learning-OS-Authenticated-User ""');
    }

    expect(nginx).not.toContain("location = /api/mobile/session");
  });

  it("isole le worker dans un compte, un état et un HOME dédiés", async () => {
    const [service, environment] = await Promise.all([
      deploymentFile("learningos-codex.service"),
      deploymentFile("codex-worker.env.example"),
    ]);
    expect(service).toContain("User=learningos-codex");
    expect(service).toContain("ProtectSystem=strict");
    expect(service).toContain("ProtectHome=true");
    expect(service).toContain("NoNewPrivileges=true");
    expect(service).toContain("PrivateTmp=true");
    expect(service).toContain("InaccessiblePaths=/var/lib/autonomous-learning-os");
    expect(service).toContain("RuntimeDirectory=learningos-codex");
    expect(service).toContain("IPAddressDeny=");
    expect(environment).toContain("CODEX_AUTH_FILE=/var/lib/learningos-codex/auth.json");
    expect(environment).toContain("CODEX_INTERVIEW_WORKER_SECRET=");
  });

  it("ne prétend plus qu'APP_PASSWORD protège l'application", async () => {
    const environment = await readFile(join(process.cwd(), ".env.example"), "utf8");
    expect(environment).not.toMatch(/^APP_PASSWORD=/m);
  });

  it("ne documente plus l’ancien token mobile partagé", async () => {
    const readme = await deploymentFile("README.md");
    expect(readme).not.toContain("MOBILE_API_TOKEN");
    expect(readme).not.toContain("/api/mobile/session");
    expect(readme).toContain("session SCIO");
  });

  it("ne documente aucun déploiement direct incompatible avec la frontière sécurisée", async () => {
    for (const path of await markdownFiles(repositoryRoot)) {
      const content = await readFile(path, "utf8");
      expect(content, path).not.toMatch(/\bvercel\b/i);

      if (path.endsWith(join("docs", "DATABASE.md"))) continue;
      for (const line of content.split("\n").filter((item) => /\brailway\b/i.test(item))) {
        expect(line, path).toMatch(/postgres|database|stockage|storage|supabase|neon|détect|railway\s+(?:whoami|login|add)/i);
      }
    }
  });
});
