import type { ScanJob } from "../../types/jobStore.types.js";
export type { ScanJobStatus, ScanJob } from "../../types/jobStore.types.js";
import crypto from "node:crypto";
import { DistributedCache, MemoryTtlCache } from "./searchCache.js";
import type { ScanReport } from "../../../shared/types/index.js";

const accountJobs = new DistributedCache<ScanJob>("scan-job-v2", 1000 * 60 * 30, 200);
const guestJobs = new MemoryTtlCache<ScanJob>(1000 * 60 * 30, 200);
export const reportCache = new MemoryTtlCache<ScanReport>(1000 * 60 * 30, 100);

export function reportCacheKey(principal: string, input: unknown): string {
  return `${principal}:${crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
}

export function invalidatePrincipalReports(principal: string): void {
  reportCache.deleteMatching((key) => key.startsWith(`${principal}:`));
  guestJobs.deleteMatching((_key, job) => job.principal === principal);
}

export const scanJobCache = {
  async get(id: string): Promise<ScanJob | null | undefined> {
    return guestJobs.get(id) ?? (await accountJobs.get(id));
  },
  async set(id: string, job: ScanJob, ttl?: number): Promise<void> {
    if (job.principal.startsWith("guest:")) {
      guestJobs.set(id, job, ttl);
      return;
    }
    const { result, ...metadata } = job;
    await accountJobs.set(id, { ...metadata, reportId: result?.id ?? metadata.reportId }, ttl);
  }
};
