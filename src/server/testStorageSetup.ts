import { afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nezbig-tests-"));
process.env.NEZBIG_DATA_DIR = directory;
// Never use connected production stores when running repository tests.
delete process.env.REDIS_URL;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
afterAll(() => {
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("nezbig-tests-")) throw new Error("Unsafe test cleanup path");
  fs.rmSync(resolved, { recursive: true, force: true });
});
