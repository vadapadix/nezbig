import crypto from "node:crypto";
import { DistributedCache, MemoryTtlCache } from "./searchCache.js";
const accountJobs = new DistributedCache("scan-job-v2", 1000 * 60 * 30, 200);
const guestJobs = new MemoryTtlCache(1000 * 60 * 30, 200);
export const reportCache = new MemoryTtlCache(1000 * 60 * 30, 100);
export function reportCacheKey(principal, input) {
    return `${principal}:${crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex")}`;
}
export function invalidatePrincipalReports(principal) {
    reportCache.deleteMatching(key => key.startsWith(`${principal}:`));
    guestJobs.deleteMatching((_key, job) => job.principal === principal);
}
export const scanJobCache = {
    async get(id) {
        return guestJobs.get(id) ?? await accountJobs.get(id);
    },
    async set(id, job, ttl) {
        if (job.principal.startsWith("guest:")) {
            guestJobs.set(id, job, ttl);
            return;
        }
        const { result, ...metadata } = job;
        await accountJobs.set(id, { ...metadata, reportId: result?.id ?? metadata.reportId }, ttl);
    }
};
