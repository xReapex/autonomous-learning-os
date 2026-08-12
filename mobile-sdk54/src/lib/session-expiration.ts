const subscribers = new Set<() => void>();

export function subscribeSessionExpired(subscriber: () => void): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}

export function emitSessionExpired(): void {
  for (const subscriber of subscribers) subscriber();
}
