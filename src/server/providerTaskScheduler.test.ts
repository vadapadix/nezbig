import { describe, expect, it } from "vitest";
import { ProviderTaskScheduler } from "./providerTaskScheduler.js";

describe("ProviderTaskScheduler", () => {
  it("limits concurrent work independently for each provider", async () => {
    const scheduler = new ProviderTaskScheduler(2);
    let activeDuckDuckGo = 0;
    let maximumDuckDuckGo = 0;

    const tasks = Array.from({ length: 7 }, (_, index) => scheduler.run("DuckDuckGo", async () => {
      activeDuckDuckGo += 1;
      maximumDuckDuckGo = Math.max(maximumDuckDuckGo, activeDuckDuckGo);
      await new Promise((resolve) => setTimeout(resolve, 5));
      activeDuckDuckGo -= 1;
      return index;
    }));

    await expect(Promise.all(tasks)).resolves.toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(maximumDuckDuckGo).toBe(2);
  });
});
