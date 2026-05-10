/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

vi.mock("../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

import { supabaseAdmin } from "../lib/supabaseAdmin.js";

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function makeRawReq(body: object, signature: string, provider = "pollfish") {
  const raw = Buffer.from(JSON.stringify(body));
  return {
    params: { provider },
    rawBody: raw,
    body,
    headers: { "x-webhook-signature": signature },
  };
}

const SECRET = "test-pollfish-secret";
const VALID_BODY = {
  user_id:        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  opportunity_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  transaction_id: "txn-789",
  status:         "completed",
};

function validSig(body: object) {
  return crypto.createHmac("sha256", SECRET).update(Buffer.from(JSON.stringify(body))).digest("hex");
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.EARN_WEBHOOK_SECRET_POLLFISH = SECRET;
  process.env.NODE_ENV = "test";
});

describe("earnWebhook: signature verification", () => {
  it("returns 200 but does not call rpc on invalid HMAC", async () => {
    const { default: router } = await import("../routes/earnWebhook.routes.js");
    const layer = router.stack.find((l: any) => l.route?.path === "/:provider");
    // Get the last handler (after captureRawBody)
    const handlers = layer?.route?.stack?.map((s: any) => s.handle);
    // The main async handler is the last one
    const mainHandler = handlers?.at(-1);
    expect(mainHandler).toBeDefined();

    const req = makeRawReq(VALID_BODY, "bad-signature");
    const res = mockRes();
    await mainHandler(req, res);

    expect(res.json).toHaveBeenCalledWith({ received: true });
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });
});

describe("earnWebhook: idempotency", () => {
  it("returns 200 but does not call rpc on duplicate transaction_id", async () => {
    const { default: router } = await import("../routes/earnWebhook.routes.js");
    const layer = router.stack.find((l: any) => l.route?.path === "/:provider");
    const mainHandler = layer?.route?.stack?.at(-1)?.handle;

    // Route: .from("earn_completions").select(...).eq("provider_transaction_id", ...)
    // Single .eq() that resolves with count > 0
    (supabaseAdmin.from as any).mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
      }),
    }));

    const sig = validSig(VALID_BODY);
    const req = makeRawReq(VALID_BODY, sig);
    const res = mockRes();
    await mainHandler(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ received: true, duplicate: true }));
    expect(supabaseAdmin.rpc).not.toHaveBeenCalled();
  });
});

describe("earnWebhook: valid payload", () => {
  it("calls rpc and returns received: true on valid payload", async () => {
    const { default: router } = await import("../routes/earnWebhook.routes.js");
    const layer = router.stack.find((l: any) => l.route?.path === "/:provider");
    const mainHandler = layer?.route?.stack?.at(-1)?.handle;

    // No existing completion
    (supabaseAdmin.from as any).mockImplementation((table: string) => {
      if (table === "earn_completions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          }),
        };
      }
      // admin_audit_log insert
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });
    (supabaseAdmin.rpc as any).mockResolvedValue({ data: { reward: 1 }, error: null });

    const sig = validSig(VALID_BODY);
    const req = makeRawReq(VALID_BODY, sig);
    const res = mockRes();
    await mainHandler(req, res);

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith(
      "complete_earn_opportunity",
      expect.objectContaining({ p_opportunity_id: VALID_BODY.opportunity_id })
    );
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});
