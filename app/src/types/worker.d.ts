declare module "../../../worker/server.mjs" {
  import type { Server } from "node:http";
  export function isPrivateAddress(address: string): boolean;
  export function validCurriculumRelations(document: unknown): boolean;
  export function verifyHttpsUrl(url: string, options?: { signal?: AbortSignal; deadlineAt?: number; redirects?: number }): Promise<unknown>;
  export function createWorkerServer(options?: { secret?: string; ignoreBudget?: boolean; onError?: (code: string) => void; generate?: (transcript: unknown[], options?: { signal?: AbortSignal; generationAuthorized?: boolean }) => Promise<unknown> }): Server;
}
