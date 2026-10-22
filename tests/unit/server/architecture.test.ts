import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

describe("Architecture boundaries", () => {
  it("keeps domain and application independent of outer layers", () => {
    for (const layer of ["domain", "application"]) {
      for (const path of files(resolve("src/server", layer)).filter((path) => path.endsWith(".ts"))) {
        const source = readFileSync(path, "utf8");
        const imports = [...source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)];
        for (const [, target] of imports) {
          const dependency = relative(resolve("src/server"), resolve(path, "..", target));
          expect(dependency, `${path}: ${target}`).not.toMatch(/^(infrastructure|presentation|composition)[\\/]/);
        }
      }
    }
  });

  it("keeps tests and CSS outside implementation directories", () => {
    const sourceFiles = files(resolve("src"));
    expect(sourceFiles.filter((path) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path))).toEqual([]);
    expect(sourceFiles.filter((path) => path.endsWith(".css") && relative(resolve("src/client/styles"), path).startsWith(".."))).toEqual([]);
  });
});
