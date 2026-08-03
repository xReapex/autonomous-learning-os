#!/usr/bin/env node
// Valide app/content/curriculum.json contre research/curriculum.schema.json.
//
// Volontairement sans dépendance : un validateur JSON Schema complet (ajv) est
// un arbre de dépendances de plus à installer avant que l'app n'existe. Le
// sous-ensemble implémenté ici couvre ce que le schéma utilise réellement —
// et il connaît les règles métier qu'un schéma ne peut pas exprimer (une vidéo
// sans embedUrl ne peut pas être trackée, une capsule ne peut pas dépasser la
// durée totale, un id doit être unique).

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaPath = resolve(root, "research/curriculum.schema.json");
const target = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(root, "app/content/curriculum.json");

const errors = [];
const warnings = [];
const fail = (path, message) => errors.push(`${path}: ${message}`);

function typeOf(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function resolveRef(ref, schema) {
  // Uniquement les pointeurs internes ("#/$defs/x") — le schéma n'en a pas d'autres.
  return ref
    .replace(/^#\//, "")
    .split("/")
    .reduce((node, key) => node?.[key], schema);
}

function validate(value, rule, schema, path) {
  if (!rule) return;
  if (rule.$ref) return validate(value, resolveRef(rule.$ref, schema), schema, path);

  if (rule.const !== undefined && value !== rule.const) {
    fail(path, `doit valoir ${JSON.stringify(rule.const)}, reçu ${JSON.stringify(value)}`);
    return;
  }

  if (rule.type) {
    const actual = typeOf(value);
    const ok = rule.type === "number" ? actual === "integer" || actual === "number" : actual === rule.type;
    if (!ok) {
      fail(path, `attendu ${rule.type}, reçu ${actual}`);
      return;
    }
  }

  if (rule.enum && !rule.enum.includes(value)) {
    fail(path, `valeur hors liste (${rule.enum.join(", ")})`);
  }

  if (typeof value === "string") {
    if (rule.minLength && value.length < rule.minLength) {
      fail(path, `trop court (${value.length} < ${rule.minLength})`);
    }
    if (rule.maxLength && value.length > rule.maxLength) {
      fail(path, `trop long (${value.length} > ${rule.maxLength})`);
    }
    if (rule.pattern && !new RegExp(rule.pattern).test(value)) {
      fail(path, `ne respecte pas le format attendu (${rule.pattern})`);
    }
    if (rule.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      fail(path, "date attendue au format AAAA-MM-JJ");
    }
    if (rule.format === "uri" && !/^https?:\/\/\S+$/.test(value)) {
      fail(path, "URL invalide");
    }
  }

  if (typeOf(value) === "integer" || typeOf(value) === "number") {
    if (rule.minimum !== undefined && value < rule.minimum) fail(path, `doit être ≥ ${rule.minimum}`);
    if (rule.maximum !== undefined && value > rule.maximum) fail(path, `doit être ≤ ${rule.maximum}`);
  }

  if (Array.isArray(value)) {
    if (rule.minItems && value.length < rule.minItems) fail(path, `au moins ${rule.minItems} éléments requis`);
    if (rule.maxItems && value.length > rule.maxItems) fail(path, `au plus ${rule.maxItems} éléments`);
    if (rule.items) value.forEach((item, i) => validate(item, rule.items, schema, `${path}[${i}]`));
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of rule.required ?? []) {
      if (value[key] === undefined) fail(path, `champ requis manquant : ${key}`);
    }
    if (rule.additionalProperties === false && rule.properties) {
      for (const key of Object.keys(value)) {
        if (!(key in rule.properties)) fail(`${path}.${key}`, "champ inconnu");
      }
    }
    for (const [key, sub] of Object.entries(rule.properties ?? {})) {
      if (value[key] !== undefined) validate(value[key], sub, schema, `${path}.${key}`);
    }
  }
}

// ── Règles métier que le schéma ne peut pas porter ───────────────────────────
function businessRules(doc) {
  const subjectIds = new Set();
  const lessonIds = new Set();
  const today = new Date().toISOString().slice(0, 10);

  for (const [si, subject] of (doc.subjects ?? []).entries()) {
    const sPath = `subjects[${si}]`;
    if (subjectIds.has(subject.id)) fail(sPath, `id de matière dupliqué : ${subject.id}`);
    subjectIds.add(subject.id);

    for (const [li, lesson] of (subject.lessons ?? []).entries()) {
      const lPath = `${sPath}.lessons[${li}]`;
      if (lessonIds.has(lesson.id)) fail(lPath, `id de leçon dupliqué : ${lesson.id}`);
      lessonIds.add(lesson.id);

      for (const [source, sourcePath] of [
        [lesson.source, `${lPath}.source`],
        ...(lesson.alternatives ?? []).map((a, i) => [a, `${lPath}.alternatives[${i}]`]),
      ]) {
        if (!source) continue;

        // Une vidéo sans embed ne peut pas être découpée ni reprise : c'est la
        // fonction centrale du produit, on la refuse plutôt que de la dégrader.
        if (source.kind === "video" && !source.embedUrl) {
          fail(sourcePath, "kind=video exige embedUrl (https://www.youtube-nocookie.com/embed/…) pour le lecteur tracké");
        }
        if (source.totalMinutes && source.minutes > source.totalMinutes) {
          fail(sourcePath, `la capsule (${source.minutes} min) dépasse la durée totale (${source.totalMinutes} min)`);
        }
        if (source.totalMinutes && source.segmentStartSeconds > source.totalMinutes * 60) {
          fail(sourcePath, "segmentStartSeconds commence après la fin de la ressource");
        }
        if (source.verifiedAt > today) {
          fail(sourcePath, `verifiedAt est dans le futur (${source.verifiedAt})`);
        }
        if (source.verifiedAt < "2020-01-01") {
          warnings.push(`${sourcePath}: source vérifiée il y a longtemps (${source.verifiedAt}) — reconfirme le lien`);
        }
        if (/^https:\/\/(www\.)?youtube\.com\/embed\//.test(source.embedUrl ?? "")) {
          warnings.push(`${sourcePath}: préfère youtube-nocookie.com à youtube.com pour l'embed`);
        }
      }
    }
  }

  const cardIds = new Set();
  for (const [ci, card] of (doc.cards ?? []).entries()) {
    const path = `cards[${ci}]`;
    if (cardIds.has(card.id)) fail(path, `id de carte dupliqué : ${card.id}`);
    cardIds.add(card.id);
    if (card.subjectId && !subjectIds.has(card.subjectId)) {
      fail(path, `subjectId inconnu : ${card.subjectId}`);
    }
    if (card.lessonId && !lessonIds.has(card.lessonId)) {
      fail(path, `lessonId inconnu : ${card.lessonId}`);
    }
  }

  // Recommandation, jamais un blocage : c'est l'apprenant qui décide combien de
  // matières il mène de front. On signale le compromis, on ne l'impose pas.
  const active = (doc.subjects ?? []).length;
  if (active > 5) {
    warnings.push(`${active} matières : 3 à 5 est ce qui tient le mieux dans la durée — au-delà, la file de révision se remplit plus vite qu'elle ne se vide (docs/LEARNING-SCIENCE.md). Si c'est voulu, ignore cet avertissement.`);
  }
}

// ── Exécution ───────────────────────────────────────────────────────────────
if (!existsSync(target)) {
  console.error(`✗ Fichier introuvable : ${target}`);
  process.exit(1);
}

let doc;
try {
  doc = JSON.parse(readFileSync(target, "utf8"));
} catch (error) {
  console.error(`✗ JSON invalide dans ${target}\n  ${error.message}`);
  process.exit(1);
}

const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
validate(doc, schema, schema, "curriculum");
businessRules(doc);

for (const warning of warnings) console.warn(`! ${warning}`);

if (errors.length > 0) {
  console.error(`\n✗ ${errors.length} erreur(s) dans ${target}\n`);
  for (const error of errors) console.error(`  ${error}`);
  console.error("\nCorrige puis relance : node scripts/validate-curriculum.mjs\n");
  process.exit(1);
}

const lessons = (doc.subjects ?? []).reduce((n, s) => n + s.lessons.length, 0);
console.log(`✓ Curriculum valide — ${doc.subjects.length} matière(s), ${lessons} leçon(s), ${doc.cards.length} carte(s)`);
if (warnings.length > 0) console.log(`  (${warnings.length} avertissement(s) non bloquant(s))`);
