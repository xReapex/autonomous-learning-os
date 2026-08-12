// Le point d'entrée du stockage. Une seule instance par processus.
//
// Le choix du pilote est fait ici, une fois, à partir de l'environnement. Si
// STORAGE_DRIVER=postgres mais que DATABASE_URL manque, on retombe sur le
// fichier avec un avertissement : mieux vaut une app qui étudie en local qu'une
// app qui refuse de démarrer.
//
// Les deux pilotes sont importés statiquement, mais aucun n'ouvre quoi que ce
// soit à l'import : le pool Postgres n'est créé qu'à la première requête. Ce
// module reste donc côté serveur uniquement — il n'a rien à faire dans un
// composant client.

import type { Storage } from "./types";
import { createFileStorage } from "./file-storage";
import { createPostgresStorage } from "./postgres-storage";

let instance: Storage | null = null;

export function getStorage(): Storage {
  if (instance) return instance;

  const driver = (process.env.STORAGE_DRIVER || "file").toLowerCase();

  if (driver === "postgres") {
    if (!process.env.DATABASE_URL) {
      console.warn("[storage] STORAGE_DRIVER=postgres sans DATABASE_URL — repli sur le stockage fichier.");
      instance = createFileStorage();
      return instance;
    }
    instance = createPostgresStorage();
    return instance;
  }

  instance = createFileStorage();
  return instance;
}

export type { Storage, StoredAnswer } from "./types";
export type { RewardEvent, RewardGrant, RewardState } from "@/lib/rewards";
