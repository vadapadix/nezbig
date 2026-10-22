import { afterEach, describe, expect, it, vi } from "vitest";
import { assessmentService } from "../../../src/server/composition/ai.js";
import type { LlmOpinion } from "../../../src/shared/types/index.js";

vi.mock("../../../src/server/infrastructure/ai/nvidiaNimAi.js", () => ({
  analyzeWithNvidiaNim: vi.fn()
}));

vi.mock("../../../src/server/infrastructure/ai/openrouterAi.js", () => ({
  analyzeWithOpenRouter: vi.fn()
}));

import { analyzeWithNvidiaNim } from "../../../src/server/infrastructure/ai/nvidiaNimAi.js";
import { analyzeWithOpenRouter } from "../../../src/server/infrastructure/ai/openrouterAi.js";

const mockedNim = vi.mocked(analyzeWithNvidiaNim);
const mockedOpenRouter = vi.mocked(analyzeWithOpenRouter);

const localAi = { probability: 20, signals: [] };
const nimAnswer: LlmOpinion = {
  aiProbability: 33,
  aiProvider: "nvidia-nim",
  aiModel: "nim-model",
  aiSignals: [{ label: "Сигнал NIM", score: 40, detail: "d", category: "pattern" }]
};
const openRouterAnswer: LlmOpinion = {
  aiProbability: 51,
  aiProvider: "openrouter",
  aiModel: "or-model",
  aiSignals: [{ label: "Сигнал OR", score: 55, detail: "d", category: "pattern" }]
};

afterEach(() => {
  vi.resetAllMocks();
});

describe("assessmentService.assess", () => {
  it("prefers NVIDIA NIM and skips OpenRouter on success", async () => {
    mockedNim.mockResolvedValue(nimAnswer);

    const result = await assessmentService.assess("Текст.", localAi);

    expect(result).toEqual(nimAnswer);
    expect(mockedNim).toHaveBeenCalledWith("Текст.", localAi);
    expect(mockedOpenRouter).not.toHaveBeenCalled();
  });

  it("falls back to OpenRouter when NIM throws", async () => {
    mockedNim.mockRejectedValue(new Error("Усі NVIDIA NIM моделі недоступні"));
    mockedOpenRouter.mockResolvedValue(openRouterAnswer);

    const result = await assessmentService.assess("Текст.", localAi);

    expect(result).toEqual(openRouterAnswer);
  });

  it("combines provider errors when both fail", async () => {
    mockedNim.mockRejectedValue(new Error("NIM down"));
    mockedOpenRouter.mockRejectedValue(new Error("OpenRouter down"));

    await expect(assessmentService.assess("Текст.", localAi)).rejects.toThrow(/NVIDIA NIM: NIM down.*OpenRouter: OpenRouter down/s);
  });

  it("returns null when no provider is configured", async () => {
    mockedNim.mockResolvedValue(null);
    mockedOpenRouter.mockResolvedValue(null);

    await expect(assessmentService.assess("Текст.", localAi)).resolves.toBeNull();
  });

  it("passes suspicious excerpts through to the providers", async () => {
    mockedNim.mockResolvedValue(nimAnswer);
    const context = { ...localAi, suspiciousExcerpts: ["уривок"] };

    await assessmentService.assess("Текст.", context);

    expect(mockedNim).toHaveBeenCalledWith("Текст.", context);
  });
});
