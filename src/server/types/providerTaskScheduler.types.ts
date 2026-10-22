export type ProviderQueue = {
  active: number;
  waiters: Array<() => void>;
};
