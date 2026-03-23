import { describe, it, expect, beforeEach } from "vitest";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  checkRateLimit,
} from "./auth";

describe("auth", () => {
  describe("password hashing", () => {
    it("hashes and verifies a password", async () => {
      const hash = await hashPassword("test-password-123");
      expect(hash).toBeTruthy();
      expect(hash).not.toBe("test-password-123");

      const valid = await verifyPassword(hash, "test-password-123");
      expect(valid).toBe(true);
    });

    it("rejects wrong password", async () => {
      const hash = await hashPassword("correct-password");
      const valid = await verifyPassword(hash, "wrong-password");
      expect(valid).toBe(false);
    });

    it("generates different hashes for same password", async () => {
      const hash1 = await hashPassword("same-password");
      const hash2 = await hashPassword("same-password");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("JWT tokens", () => {
    it("signs and verifies a valid token", () => {
      const token = createSessionToken(1);
      const payload = verifySessionToken(token);
      expect(payload).not.toBeNull();
      expect(payload!.userId).toBe(1);
    });

    it("returns null for invalid token", () => {
      const payload = verifySessionToken("invalid.token.here");
      expect(payload).toBeNull();
    });

    it("returns null for tampered token", () => {
      const token = createSessionToken(1);
      const tampered = token.slice(0, -5) + "xxxxx";
      const payload = verifySessionToken(tampered);
      expect(payload).toBeNull();
    });
  });

  describe("rate limiting", () => {
    beforeEach(() => {
      // Force reset by using a unique IP per test
    });

    it("allows first 5 attempts", () => {
      const ip = `test-${Date.now()}-allow`;
      for (let i = 0; i < 5; i++) {
        expect(checkRateLimit(ip)).toBe(true);
      }
    });

    it("blocks after 5 attempts", () => {
      const ip = `test-${Date.now()}-block`;
      for (let i = 0; i < 5; i++) {
        checkRateLimit(ip);
      }
      expect(checkRateLimit(ip)).toBe(false);
    });
  });
});
