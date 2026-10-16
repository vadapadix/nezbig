import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeWithOpenRouter } from "./openrouterAi.js";

const ENV_KEYS = ["OPENROUTER_API_KEY", "OPENROUTER_MODEL", "OPENROUTER_FALLBACK_MODELS"] as const;
const savedEnv: Record<string, string | undefined> = {};

function orPayload(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] })
  } as Response;
}

function orError(message: string, status = 503) {
  return {
    ok: false,
    status,
    json: async () => ({ error: { message } })
  } as Response;
}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.OPENROUTER_MODEL = "model-a";
  process.env.OPENROUTER_FALLBACK_MODELS = "model-b,model-c";
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
});

const localAi = { probability: 12, signals: [] };

describe("analyzeWithOpenRouter", () => {
  it("returns null when no API key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.OPENROUTER_API_KEY;

    await expect(analyzeWithOpenRouter("Текст для аналізу.", localAi)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses json mode on the first attempt and parses the answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(orPayload('{"probability": 44, "signals": [{"label": "Ритм", "score": 61}]}'));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeWithOpenRouter("Текст для аналізу.", localAi);
    expect(result).toMatchObject({ aiProvider: "openrouter", aiModel: "model-a", aiProbability: 44 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).response_format).toEqual({ type: "json_object" });
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).messages[0].content).toContain("Never raise or lower");
  });

  it("retries without json mode when json mode is rejected", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(orError("provider returned error: response_format is not supported"))
      .mockResolvedValueOnce(orPayload('{"probability": 31}'));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeWithOpenRouter("Текст для аналізу.", localAi);
    expect(result?.aiModel).toBe("model-a");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(secondBody.response_format).toBeUndefined();
    expect(secondBody.model).toBe("model-a");
  });

  it("moves to the next model on non-json failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(orError("model-a is overloaded"))
      .mockResolvedValueOnce(orPayload('{"probability": 8}'));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeWithOpenRouter("Текст для аналізу.", localAi);
    expect(result?.aiModel).toBe("model-b");
    expect(result?.aiNote).toContain("fallback");
    expect(result?.aiProbability).toBe(8);
  });

  it("tries the next model when content is not valid JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(orPayload("Вибачте, але я не можу відповісти JSON-ом."))
      .mockResolvedValueOnce(orPayload('{"probability": 15}'));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeWithOpenRouter("Текст для аналізу.", localAi);
    expect(result?.aiModel).toBe("model-b");
    expect(result?.aiProbability).toBe(15);
  });

  it("throws a combined error when all models are exhausted", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => orError(`${JSON.parse(String(init?.body)).model} unavailable`));
    vi.stubGlobal("fetch", fetchMock);

    await expect(analyzeWithOpenRouter("Текст для аналізу.", localAi)).rejects.toThrow(/model-a.*model-b.*model-c/s);
  });
});
