/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));
vi.mock("../services/pushNotification.service.js", () => ({
  sendPush: vi.fn().mockResolvedValue(undefined),
}));

import { supabaseAdmin } from "../lib/supabaseAdmin.js";

// Minimal Express-like mock helpers
function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(body: any, userId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa") {
  return { body, user: { id: userId }, headers: {} };
}

// Import route handlers directly by importing the module and extracting the router's stack
// Instead, test via the handler functions extracted from the route file.
// We test the logic by calling the route handler functions directly.

// Helper: build a chainable Supabase mock
function makeChain(result: any) {
  const chain: any = {};
  ["from", "select", "eq", "gte", "single", "maybeSingle", "insert", "update"].forEach((m) => {
    chain[m] = vi.fn().mockReturnValue(chain);
  });
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  // count queries resolve directly
  chain._countResult = result;
  return chain;
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/v1/earn/complete", () => {
  it("returns 409 when once-only opportunity already completed", async () => {
    const { default: router } = await import("../routes/earn.routes.js");

    // Find the /complete handler
    const layer = router.stack.find((l: any) => l.route?.path === "/complete");
    const handler = layer?.route?.stack?.at(-1)?.handle;
    expect(handler).toBeDefined();

    const oppChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: "opp-1", status: "active", availability_type: "once", title: "Test", reward_amount: 1 },
        error: null,
      }),
    };
    const countChain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      // count = 1 → already completed
      then: undefined,
    };
    // Resolve count query
    Object.defineProperty(countChain, Symbol.toStringTag, { value: "Promise" });
    countChain.select = vi.fn().mockReturnValue({ ...countChain, count: 1 });

    let callCount = 0;
    (supabaseAdmin.from as any).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return oppChain;
      // Second call is the count query — return object with count property
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
          }),
        }),
      };
    });

    const req = mockReq({ opportunity_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" });
    const res = mockRes();
    await handler(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe("ALREADY_COMPLETED");
  });

  it("returns 400 for invalid input", async () => {
    const { default: router } = await import("../routes/earn.routes.js");
    const layer = router.stack.find((l: any) => l.route?.path === "/complete");
    const handler = layer?.route?.stack?.at(-1)?.handle;

    const req = mockReq({ opportunity_id: "not-a-uuid" });
    const res = mockRes();
    await handler(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("POST /api/v1/earn/daily", () => {
  it("returns 409 when already claimed today", async () => {
    const { default: router } = await import("../routes/earn.routes.js");
    const layer = router.stack.find((l: any) => l.route?.path === "/daily");
    const handler = layer?.route?.stack?.at(-1)?.handle;
    expect(handler).toBeDefined();

    const today = new Date().toISOString().split("T")[0];
    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { last_claim_date: today, current_day: 3 },
        error: null,
      }),
    });

    const req = mockReq({});
    const res = mockRes();
    await handler(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toBe("ALREADY_CLAIMED_TODAY");
  });
});

describe("POST /api/v1/earn/academy/complete", () => {
  it("returns 403 when quiz required but no correct answer exists", async () => {
    const { default: router } = await import("../routes/earn.routes.js");
    const layer = router.stack.find((l: any) => l.route?.path === "/academy/complete");
    const handler = layer?.route?.stack?.at(-1)?.handle;
    expect(handler).toBeDefined();

    let callCount = 0;
    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      callCount++;
      if (table === "academy_lessons") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: "lesson-1", status: "active", requires_quiz: true, reward_amount: 2 },
            error: null,
          }),
        };
      }
      if (table === "lesson_completions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        };
      }
      // quiz_answers — no correct answers
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        }),
      };
    });

    const req = mockReq({ lesson_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" });
    const res = mockRes();
    await handler(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].error).toBe("QUIZ_REQUIRED");
  });
});
