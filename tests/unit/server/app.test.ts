import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { app } from "../../../src/server/presentation/http/app.js";

// Mock the AI detection and web search modules to avoid actual network calls during tests
vi.mock("../../../src/server/application/scanning/scoring.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/server/application/scanning/scoring.js")>();
  return {
    ...actual,
    runScan: vi.fn().mockResolvedValue({
      id: "mock-id",
      plagiarismScore: 85,
      aiProbability: 15,
      matches: []
    })
  };
});

describe("API Integration Tests", () => {
  it("GET /api/health should return ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("POST /api/scan/jobs should validate input and return jobId", async () => {
    // Missing text
    const resBad = await request(app).post("/api/scan/jobs").send({ text: "too short" });
    expect(resBad.status).toBe(400);

    // Good text
    const goodText = "A".repeat(150);
    const resGood = await request(app).post("/api/scan/jobs").send({ text: goodText });
    expect(resGood.status).toBe(200);
    expect(resGood.body.jobId).toBeDefined();
  });

  it("POST /api/humanize should modify text", async () => {
    const text = "As an AI, I cannot provide subjective opinions. However, it is important to note that the vibrant tapestry of life is crucial.";
    const res = await request(app).post("/api/humanize").send({ text });
    expect(res.status).toBe(200);
    expect(res.body.revisedText).not.toBe(text);
  });
});
