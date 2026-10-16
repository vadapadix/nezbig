import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeWithNvidiaNim } from "./nvidiaNimAi.js";

const ENV_KEYS = ["NVIDIA_NIM_API_KEY", "NVIDIA_API_KEY", "NVIDIA_NIM_MODEL", "NVIDIA_NIM_FALLBACK_MODELS"] as const;
const savedEnv: Record<string, string | undefined> = {};

function nimPayload(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] })
  } as Response;
}

function nimError(message: string, status = 503) {
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
  process.env.NVIDIA_NIM_API_KEY = "test-key";
  process.env.NVIDIA_NIM_MODEL = "model-primary";
  process.env.NVIDIA_NIM_FALLBACK_MODELS = "model-secondary";
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
});

const localAi = { probability: 30, signals: [] };

describe("analyzeWithNvidiaNim", () => {
  it("returns null when no API key is configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.NVIDIA_NIM_API_KEY;

    await expect(analyzeWithNvidiaNim("Текст перевірки.", localAi)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("parses a successful model response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      nimPayload('{"probability": 64, "signals": [{"label": "Шаблонні переходи", "score": 70, "detail": "Багато слів-звʼязок.", "evidence": ["however"]}]}')
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeWithNvidiaNim("Текст перевірки.", localAi);
    expect(result).toMatchObject({ aiProvider: "nvidia-nim", aiModel: "model-primary", aiProbability: 64 });
    expect(result?.aiSignals[0]).toMatchObject({ label: "Шаблонні переходи", score: 70 });
    expect(result?.aiNote).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.model).toBe("model-primary");
    expect(body.messages.at(-1).content).toContain("Local heuristic probability: 30");
    expect(body.messages[0].content).toContain("presence or absence of citations");
    expect(body.messages[0].content).toContain("Never raise or lower");
  });

  it("falls back to the next model after an HTTP failure and records the note", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(nimError("quota exceeded"))
      .mockResolvedValueOnce(nimPayload('{"probability": 20, "signals": []}'));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeWithNvidiaNim("Текст перевірки.", localAi);
    expect(result?.aiModel).toBe("model-secondary");
    expect(result?.aiNote).toContain("fallback");
    expect(result?.aiNote).toContain("model-primary");
    expect(result?.aiSignals[0]?.score).toBe(20);
  });

  it("tries remaining models when one returns an empty response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ choices: [{ message: {} }] }) })
      .mockResolvedValueOnce(nimPayload('{"probability": 55}'));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeWithNvidiaNim("Текст перевірки.", localAi);
    expect(result?.aiModel).toBe("model-secondary");
    expect(result?.aiProbability).toBe(55);
  });

  it("throws a combined error when every model fails", async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return nimError(`${body.model} is down`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(analyzeWithNvidiaNim("Текст перевірки.", localAi)).rejects.toThrow(/model-primary.*model-secondary/s);
  });

  it("sends suspicious excerpts to the model for long documents", async () => {
    const fetchMock = vi.fn().mockResolvedValue(nimPayload('{"probability": 40}'));
    vi.stubGlobal("fetch", fetchMock);

    await analyzeWithNvidiaNim("Текст. ".repeat(2000), { ...localAi, suspiciousExcerpts: ["підозрілий уривок"] });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.messages.at(-1).content).toContain("підозрілий уривок");
    expect(body.messages.at(-1).content).toContain("=== ПОЧАТОК ДОКУМЕНТА ===");
  });
});
