

export type CacheEntry<T> = {
  expiresAt: number;
  value: T;
  timer?: ReturnType<typeof setTimeout>;
};
