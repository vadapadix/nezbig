import type { ScanReport } from "../../shared/types/index.js";

export type StoredReport = ScanReport & { ownerId?: string };
