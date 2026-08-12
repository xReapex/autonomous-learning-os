import schemaDocument from "../../content/curriculum.schema.json";

export type CurriculumValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

type SchemaRule = {
  $ref?: string;
  const?: unknown;
  type?: "object" | "array" | "string" | "integer" | "number";
  enum?: unknown[];
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: "date" | "uri";
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  items?: SchemaRule;
  required?: string[];
  additionalProperties?: boolean;
  properties?: Record<string, SchemaRule>;
};

type SchemaDocument = SchemaRule & { $defs?: Record<string, SchemaRule> };

function valueType(value: unknown): string {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function primaryLanguage(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().split(/[-_]/, 1)[0] : "";
}

function youtubeVideoId(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password) return "";
    if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(host)) return "";
    if (url.pathname === "/watch") return url.searchParams.get("v") ?? "";
    return /^\/(?:shorts|live)\/([^/?#]+)/.exec(url.pathname)?.[1] ?? "";
  } catch {
    return "";
  }
}

function youtubeEmbedId(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hostname.toLowerCase() !== "www.youtube-nocookie.com"
    ) return "";
    return /^\/embed\/([^/?#]+)/.exec(url.pathname)?.[1] ?? "";
  } catch {
    return "";
  }
}

function resolveRef(ref: string, schema: SchemaDocument): SchemaRule | undefined {
  return ref
    .replace(/^#\//, "")
    .split("/")
    .reduce<unknown>((node, key) =>
      typeof node === "object" && node !== null ? (node as Record<string, unknown>)[key] : undefined,
    schema) as SchemaRule | undefined;
}

function validateSchema(
  value: unknown,
  rule: SchemaRule | undefined,
  schema: SchemaDocument,
  path: string,
  errors: string[],
): void {
  if (!rule) return;
  if (rule.$ref) {
    validateSchema(value, resolveRef(rule.$ref, schema), schema, path, errors);
    return;
  }

  if (rule.const !== undefined && value !== rule.const) {
    errors.push(`${path}: doit valoir ${JSON.stringify(rule.const)}`);
    return;
  }

  if (rule.type) {
    const actual = valueType(value);
    const matches = rule.type === "number"
      ? actual === "integer" || actual === "number"
      : actual === rule.type;
    if (!matches) {
      errors.push(`${path}: attendu ${rule.type}, reçu ${actual}`);
      return;
    }
  }

  if (rule.enum && !rule.enum.includes(value)) {
    errors.push(`${path}: valeur hors liste (${rule.enum.join(", ")})`);
  }

  if (typeof value === "string") {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      errors.push(`${path}: trop court (${value.length} < ${rule.minLength})`);
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      errors.push(`${path}: trop long (${value.length} caractères, maximum ${rule.maxLength} caractères)`);
    }
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
      errors.push(`${path}: format invalide`);
    }
    if (rule.format === "date") {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
      if (!match) {
        errors.push(`${path}: date attendue au format AAAA-MM-JJ`);
      } else {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const parsed = new Date(Date.UTC(year, month - 1, day));
        if (
          parsed.getUTCFullYear() !== year ||
          parsed.getUTCMonth() !== month - 1 ||
          parsed.getUTCDate() !== day
        ) {
          errors.push(`${path}: date impossible`);
        }
      }
    }
    if (rule.format === "uri") {
      try {
        const parsed = new URL(value);
        if (parsed.protocol !== "https:") errors.push(`${path}: une URL HTTPS est obligatoire`);
      } catch {
        errors.push(`${path}: URL invalide`);
      }
    }
  }

  if (typeof value === "number") {
    if (rule.minimum !== undefined && value < rule.minimum) {
      errors.push(`${path}: doit être ≥ ${rule.minimum}`);
    }
    if (rule.maximum !== undefined && value > rule.maximum) {
      errors.push(`${path}: doit être ≤ ${rule.maximum}`);
    }
  }

  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < rule.minItems) {
      errors.push(`${path}: au moins ${rule.minItems} élément(s) requis`);
    }
    if (rule.maxItems !== undefined && value.length > rule.maxItems) {
      errors.push(`${path}: au plus ${rule.maxItems} élément(s)`);
    }
    value.forEach((item, index) => validateSchema(item, rule.items, schema, `${path}[${index}]`, errors));
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const object = value as Record<string, unknown>;
    for (const key of rule.required ?? []) {
      if (object[key] === undefined) errors.push(`${path}: champ requis manquant : ${key}`);
    }
    if (rule.additionalProperties === false && rule.properties) {
      for (const key of Object.keys(object)) {
        if (!Object.hasOwn(rule.properties, key)) errors.push(`${path}.${key}: champ inconnu`);
      }
    }
    for (const [key, childRule] of Object.entries(rule.properties ?? {})) {
      if (object[key] !== undefined) {
        validateSchema(object[key], childRule, schema, `${path}.${key}`, errors);
      }
    }
  }
}

export function validateCurriculumDocument(value: unknown): CurriculumValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const schema = schemaDocument as SchemaDocument;

  validateSchema(value, schema, schema, "curriculum", errors);

  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const document = value as {
      language?: unknown;
      subjects?: Array<{
        id?: unknown;
        lessons?: Array<{
          id?: unknown;
          source?: { url?: unknown; embedUrl?: unknown; kind?: unknown; language?: unknown; totalMinutes?: unknown; minutes?: unknown; segmentStartSeconds?: unknown; verifiedAt?: unknown };
          alternatives?: Array<{ url?: unknown; embedUrl?: unknown; kind?: unknown; language?: unknown; totalMinutes?: unknown; minutes?: unknown; segmentStartSeconds?: unknown; verifiedAt?: unknown }>;
        }>;
      }>;
      cards?: Array<{ id?: unknown; subjectId?: unknown; lessonId?: unknown }>;
    };

    const subjectIds = new Set<string>();
    const lessonIds = new Set<string>();
    const lessonSubjectIds = new Map<string, string>();
    const documentLanguage = primaryLanguage(document.language);
    for (const [subjectIndex, subject] of (document.subjects ?? []).entries()) {
      if (typeof subject.id === "string") {
        if (subjectIds.has(subject.id)) {
          errors.push(`curriculum.subjects[${subjectIndex}].id: identifiant dupliqué « ${subject.id} »`);
        }
        subjectIds.add(subject.id);
      }
      for (const [lessonIndex, lesson] of (subject.lessons ?? []).entries()) {
        if (typeof lesson.id === "string") {
          if (lessonIds.has(lesson.id)) {
            errors.push(`curriculum.subjects[${subjectIndex}].lessons[${lessonIndex}].id: identifiant dupliqué « ${lesson.id} »`);
          }
          lessonIds.add(lesson.id);
          if (typeof subject.id === "string") lessonSubjectIds.set(lesson.id, subject.id);
        }
        const sources = [lesson.source, ...(lesson.alternatives ?? [])];
        for (const source of sources) {
          if (!source) continue;
          if (source.kind !== "video") {
            errors.push("source.kind: seule une vidéo YouTube est autorisée");
          }
          const videoId = youtubeVideoId(source.url);
          if (!videoId) {
            errors.push("source.url: une URL de vidéo YouTube HTTPS est obligatoire");
          }
          const embedId = youtubeEmbedId(source.embedUrl);
          if (!embedId) {
            errors.push("source.embedUrl: un lecteur youtube-nocookie.com/embed/... est obligatoire");
          }
          if (videoId && embedId && videoId !== embedId) {
            errors.push("source.embedUrl: la vidéo intégrée ne correspond pas à l’URL YouTube");
          }
          if (!documentLanguage || primaryLanguage(source.language) !== documentLanguage) {
            errors.push("source.language: la langue de la vidéo doit correspondre à celle du curriculum");
          }
          if (source.kind === "video" && typeof source.embedUrl !== "string") {
            errors.push("source.embedUrl: kind=video exige un lecteur youtube-nocookie.com");
          }
          if (typeof source.embedUrl === "string") {
            if (source.kind !== "video") {
              errors.push("source.embedUrl: interdit pour une source non vidéo");
            }
            try {
              const embed = new URL(source.embedUrl);
              if (
                embed.protocol !== "https:" ||
                embed.hostname !== "www.youtube-nocookie.com" ||
                !embed.pathname.startsWith("/embed/")
              ) {
                errors.push("source.embedUrl: seul youtube-nocookie.com/embed/... est autorisé");
              }
            } catch {
              errors.push("source.embedUrl: URL youtube-nocookie.com invalide");
            }
          }
          if (
            typeof source.minutes === "number" &&
            typeof source.totalMinutes === "number" &&
            source.minutes > source.totalMinutes
          ) {
            errors.push("source.minutes: la capsule dépasse la durée totale");
          }
          if (
            typeof source.segmentStartSeconds === "number" &&
            typeof source.totalMinutes === "number" &&
            source.segmentStartSeconds > source.totalMinutes * 60
          ) {
            errors.push("source.segmentStartSeconds: le segment commence après la fin de la ressource");
          }
        }
      }
    }

    const cardIds = new Set<string>();
    for (const [index, card] of (document.cards ?? []).entries()) {
      if (typeof card.id === "string") {
        if (cardIds.has(card.id)) errors.push(`curriculum.cards[${index}].id: identifiant dupliqué « ${card.id} »`);
        cardIds.add(card.id);
      }
      if (typeof card.subjectId === "string" && !subjectIds.has(card.subjectId)) {
        errors.push(`curriculum.cards[${index}].subjectId: matière inconnue`);
      }
      if (typeof card.lessonId === "string" && !lessonIds.has(card.lessonId)) {
        errors.push(`curriculum.cards[${index}].lessonId: leçon inconnue`);
      } else if (
        typeof card.lessonId === "string" &&
        typeof card.subjectId === "string" &&
        lessonSubjectIds.get(card.lessonId) !== card.subjectId
      ) {
        errors.push(`curriculum.cards[${index}].lessonId: la leçon n'appartient pas à la matière référencée`);
      }
    }

    if ((document.subjects ?? []).length > 5) {
      warnings.push("Plus de cinq matières : la file de révision peut devenir difficile à maintenir.");
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
