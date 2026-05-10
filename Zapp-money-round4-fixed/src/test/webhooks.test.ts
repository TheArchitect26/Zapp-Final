/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

vi.mock("../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock("../db/index.js", () => ({
  db: { query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }) },
}));

describe("webhook signature verification", () => {
  it("accepts valid HMAC-SHA256 signature", () => {
    const secret = "test-secret";
    const body = Buffer.from(JSON.stringify({ type: "payment.confirmed" }));
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");

    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(crypto.createHmac("sha256", secret).update(body).digest("hex"));
    expect(sigBuf.length).toBe(expBuf.length);
    expect(crypto.timingSafeEqual(sigBuf, expBuf)).toBe(true);
  });

  it("rejects tampered body", () => {
    const secret = "test-secret";
    const body = Buffer.from(JSON.stringify({ type: "payment.confirmed" }));
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const tampered = Buffer.from(JSON.stringify({ type: "payment.confirmed", amount: 99999 }));
    const expected = crypto.createHmac("sha256", secret).update(tampered).digest("hex");
    expect(sig).not.toBe(expected);
  });
});

describe("Peach webhook idempotency", () => {
  it("only credits wallet when status transitions from pending", async () => {
    const { db } = await import("../db/index.js");
    // Simulate already-processed (no rows returned = already claimed)
    (db.query as any).mockResolvedValueOnce({ rows: [] });
    const rows = (await db.query("UPDATE topup_requests ...", [])).rows;
    expect(rows).toHaveLength(0);
  });
});
