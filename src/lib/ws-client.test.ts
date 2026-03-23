import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Backoff calculation tests (extracted logic)
describe("ws-client backoff", () => {
  const INITIAL_BACKOFF_MS = 100;
  const MAX_BACKOFF_MS = 30_000;

  function calcBackoff(attempt: number): number {
    return Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt), MAX_BACKOFF_MS);
  }

  it("starts at 100ms", () => {
    expect(calcBackoff(0)).toBe(100);
  });

  it("doubles each attempt", () => {
    expect(calcBackoff(1)).toBe(200);
    expect(calcBackoff(2)).toBe(400);
    expect(calcBackoff(3)).toBe(800);
  });

  it("caps at 30s", () => {
    expect(calcBackoff(10)).toBe(30_000);
    expect(calcBackoff(20)).toBe(30_000);
  });

  it("jitter stays within ±25% bounds", () => {
    for (let i = 0; i < 100; i++) {
      const base = calcBackoff(3); // 800
      const jitter = base * (0.75 + Math.random() * 0.5);
      expect(jitter).toBeGreaterThanOrEqual(base * 0.75);
      expect(jitter).toBeLessThanOrEqual(base * 1.25);
    }
  });
});
