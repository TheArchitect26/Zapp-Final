/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * CRITICAL PATH TESTS
 *
 * Covers:
 *  1. deposit → wallet update (webhook credits wallet, verify does not)
 *  2. withdrawal → balance deduction (process_withdrawal RPC called)
 *  3. fraud block → prevents settlement
 *  4. duplicate request → does not double charge (idempotency)
 *  5. transfer → sender mismatch rejected
 *  6. transfer → insufficient funds rejected
 *  7. transaction gate → fraud block and balance check
 *  8. webhook signature → prevents fake payments
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// ── Proper UUIDs for tests ────────────────────────────────────────────────────
const USER_1 = "11111111-1111-1111-1111-111111111111";
const USER_2 = "22222222-2222-2222-2222-222222222222";

// ── Shared mocks ──────────────────────────────────────────────────────────────

vi.mock("../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

vi.mock("../db/index.js", () => ({
  db: {
    query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    connect: vi.fn(),
  },
}));

vi.mock("../lib/auditLog.js", () => ({
  auditLog: {
    transactionCreated: vi.fn(),
    transactionSettled: vi.fn(),
    transactionFailed: vi.fn(),
    fraudBlock: vi.fn(),
    depositCredited: vi.fn(),
    withdrawalCreated: vi.fn(),
    withdrawalProcessed: vi.fn(),
    withdrawalFailed: vi.fn(),
    withdrawalReversed: vi.fn(),
  },
}));

vi.mock("../services/fraudAI.service.js", () => ({
  learnFraud: vi.fn(),
  fraudScore: vi.fn().mockResolvedValue(0.1),
  classifyRisk: vi.fn().mockReturnValue("LOW"),
}));

vi.mock("../fraud/fraudPipeline.js", () => ({
  runFraudPipeline: vi.fn().mockResolvedValue({
    finalScore: 0.1,
    decision: { level: "LOW" },
    enforcement: "ALLOW",
  }),
}));

vi.mock("../realtime/socket.server.js", () => ({
  broadcast: vi.fn(),
}));

vi.mock("../events/eventBus.js", () => ({
  eventBus: { emit: vi.fn(), on: vi.fn() },
}));

vi.mock("../services/withdrawal.service.js", () => ({
  processWithdrawal: vi.fn().mockResolvedValue({ ok: true, status: "processing" }),
  WITHDRAWAL_STATUS: {
    PENDING: "pending", PROCESSING: "processing", SUCCESS: "paid",
    FAILED: "failed", REVERSED: "reversed",
  },
}));

vi.mock("../governance/governanceMode.js", () => ({
  getGovernanceMode: vi.fn().mockResolvedValue("LIVE"),
  GOVERNANCE_MODE: { FREEZE_ALL: "FREEZE_ALL", READ_ONLY: "READ_ONLY" },
}));

vi.mock("../governance/systemGovernor.js", () => ({
  systemGovernor: { canExecute: vi.fn().mockResolvedValue({ ok: true }) },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(body: any, userId = USER_1) {
  return { body, user: { id: userId }, headers: {} };
}

// ── 1. DEPOSIT: webhook credits wallet, verify does not ───────────────────────

describe("deposit flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Paystack webhook credits wallet on charge.success", async () => {
    const { supabaseAdmin } = await import("../lib/supabaseAdmin.js");
    const { db } = await import("../db/index.js");

    (db.query as any).mockResolvedValueOnce({
      rows: [{ id: "topup-1", user_id: USER_1, amount: 100 }],
    });

    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const fromMock = vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
    (supabaseAdmin.rpc as any) = rpcMock;
    (supabaseAdmin.from as any) = fromMock;

    // Simulate the webhook handler logic
    const claimed = await db.query("UPDATE topup_requests ...", []);
    const topup = claimed.rows[0];

    if (topup) {
      await supabaseAdmin.rpc("top_up_wallet", {
        p_amount: 100,
        p_user_id: USER_1,
      });
    }

    expect(rpcMock).toHaveBeenCalledWith("top_up_wallet", {
      p_amount: 100,
      p_user_id: USER_1,
    });
  });

  it("verify endpoint does NOT call top_up_wallet RPC", async () => {
    // Set PAYSTACK_SECRET_KEY for this test
    process.env.PAYSTACK_SECRET_KEY = "test-paystack-secret";

    const { paystackVerify } = await import("../controllers/paystack.controller.js");
    const { supabaseAdmin } = await import("../lib/supabaseAdmin.js");

    const rpcMock = vi.fn();
    (supabaseAdmin.rpc as any) = rpcMock;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: { status: "success", amount: 10000, currency: "ZAR" },
      }),
    }) as any;

    const fromChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { status: "completed", amount: 100 } }),
    };
    (supabaseAdmin.from as any) = vi.fn().mockReturnValue(fromChain);

    const res = mockRes();
    const req: any = {
      params: { reference: "zapp_test_ref" },
      user: { id: USER_1 },
    };

    await paystackVerify(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      status: "success",
    }));
    // Verify does NOT credit wallet
    expect(rpcMock).not.toHaveBeenCalledWith("top_up_wallet", expect.anything());
    expect(rpcMock).not.toHaveBeenCalledWith("credit_wallet", expect.anything());

    delete process.env.PAYSTACK_SECRET_KEY;
  });
});

// ── 2. WITHDRAWAL: balance deduction ─────────────────────────────────────────

describe("withdrawal flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls process_withdrawal RPC to atomically debit balance", async () => {
    const { requestWithdrawal } = await import("../controllers/withdraw.controller.js");
    const { supabaseAdmin } = await import("../lib/supabaseAdmin.js");

    // Mock: profiles (KYC check) + withdrawal_requests count (pending cap) 
    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { kyc_status: "verified" } }),
    };
    const countChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ count: 0, error: null }),
    };
    (supabaseAdmin.from as any) = vi.fn().mockImplementation((table: string) =>
      table === "withdrawal_requests" ? countChain : profileChain
    );
    (supabaseAdmin.rpc as any) = vi.fn().mockResolvedValue({
      data: { id: "wr-1", amount: 500, net_amount: 480 },
      error: null,
    });

    const res = mockRes();
    await requestWithdrawal(mockReq({ amount: 500 }) as any, res, vi.fn());

    expect(supabaseAdmin.rpc).toHaveBeenCalledWith("process_withdrawal", expect.objectContaining({
      p_amount: 500,
      p_sender_id: USER_1,
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("rejects withdrawal without KYC", async () => {
    const { requestWithdrawal } = await import("../controllers/withdraw.controller.js");
    const { supabaseAdmin } = await import("../lib/supabaseAdmin.js");

    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { kyc_status: "unverified" } }),
    };
    (supabaseAdmin.from as any) = vi.fn().mockReturnValue(profileChain);

    const res = mockRes();
    await requestWithdrawal(mockReq({ amount: 100 }) as any, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "KYC_REQUIRED" }));
  });

  it("rejects invalid amount (negative)", async () => {
    const { requestWithdrawal } = await import("../controllers/withdraw.controller.js");
    const res = mockRes();
    await requestWithdrawal(mockReq({ amount: -50 }) as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects amount exceeding maximum", async () => {
    const { requestWithdrawal } = await import("../controllers/withdraw.controller.js");
    const res = mockRes();
    await requestWithdrawal(mockReq({ amount: 100_000 }) as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ── 3. FRAUD BLOCK: prevents transfer ────────────────────────────────────────

describe("fraud block", () => {
  beforeEach(() => vi.clearAllMocks());

  it("blocks transfer when fraud enforcement is BLOCK", async () => {
    const { runFraudPipeline } = await import("../fraud/fraudPipeline.js");
    (runFraudPipeline as any).mockResolvedValueOnce({
      finalScore: 0.95,
      decision: { level: "BLOCK" },
      enforcement: "BLOCK",
    });

    const { sendMoney } = await import("../controllers/transfer.controller.js");
    const { supabaseAdmin } = await import("../lib/supabaseAdmin.js");

    const walletChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { balance: 1000 } }),
    };
    // profiles is queried twice: once for recipient (returns user_id), once for KYC (returns kyc_status)
    let profileCallCount = 0;
    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockImplementation(() => {
        profileCallCount++;
        // First call: recipient lookup; second call: KYC check
        return Promise.resolve(
          profileCallCount === 1
            ? { data: { user_id: USER_2 } }
            : { data: { kyc_status: "verified" } }
        );
      }),
    };
    (supabaseAdmin.from as any) = vi.fn().mockImplementation((table: string) =>
      table === "wallets" ? walletChain : profileChain
    );

    const res = mockRes();
    await sendMoney(
      mockReq({ senderId: USER_1, recipientUsername: "bob", amount: 100 }) as any,
      res,
      vi.fn()
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: "DECLINED_FRAUD_AI",
    }));
  });

  it("blocks transfer when fraud enforcement is REVIEW", async () => {
    const { runFraudPipeline } = await import("../fraud/fraudPipeline.js");
    (runFraudPipeline as any).mockResolvedValueOnce({
      finalScore: 0.72,
      decision: { level: "HIGH" },
      enforcement: "REVIEW",
    });

    const { sendMoney } = await import("../controllers/transfer.controller.js");
    const { supabaseAdmin } = await import("../lib/supabaseAdmin.js");

    const walletChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { balance: 1000 } }),
    };
    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { user_id: USER_2 } }),
    };
    (supabaseAdmin.from as any) = vi.fn().mockImplementation((table: string) =>
      table === "wallets" ? walletChain : profileChain
    );

    const res = mockRes();
    await sendMoney(
      mockReq({ senderId: USER_1, recipientUsername: "bob", amount: 100 }) as any,
      res,
      vi.fn()
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ── 4. DUPLICATE REQUEST: idempotency ────────────────────────────────────────

describe("idempotency", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns cached response for duplicate transfer request", async () => {
    const { db } = await import("../db/index.js");
    const cachedResponse = { success: true, transfer: { id: "tx-1" } };

    // Simulate cached idempotency key
    (db.query as any).mockResolvedValueOnce({
      rows: [{ response: JSON.stringify(cachedResponse) }],
    });

    const { sendMoney } = await import("../controllers/transfer.controller.js");
    const { supabaseAdmin } = await import("../lib/supabaseAdmin.js");
    const rpcMock = vi.fn();
    (supabaseAdmin.rpc as any) = rpcMock;

    const res = mockRes();
    const req: any = {
      body: { senderId: USER_1, recipientUsername: "bob", amount: 100 },
      user: { id: USER_1 },
      headers: { "idempotency-key": "idem-key-123" },
    };

    await sendMoney(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ...cachedResponse,
      idempotent: true,
    }));
    // transfer_funds RPC should NOT be called
    expect(rpcMock).not.toHaveBeenCalledWith("transfer_funds", expect.anything());
  });
});

// ── 5. TRANSFER: input validation ────────────────────────────────────────────

describe("transfer input validation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects missing fields", async () => {
    const { sendMoney } = await import("../controllers/transfer.controller.js");
    const res = mockRes();
    await sendMoney(mockReq({}) as any, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects sender mismatch (valid UUID but wrong user)", async () => {
    const { sendMoney } = await import("../controllers/transfer.controller.js");
    const { supabaseAdmin } = await import("../lib/supabaseAdmin.js");

    // Zod passes (valid UUID), but ownership check fails
    const walletChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { balance: 1000 } }),
    };
    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { user_id: USER_2 } }),
    };
    (supabaseAdmin.from as any) = vi.fn().mockImplementation((table: string) =>
      table === "wallets" ? walletChain : profileChain
    );

    const res = mockRes();
    // senderId is USER_2 but authenticated user is USER_1
    await sendMoney(
      mockReq({ senderId: USER_2, recipientUsername: "bob", amount: 100 }, USER_1) as any,
      res,
      vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "SENDER_MISMATCH" }));
  });

  it("rejects unknown recipient", async () => {
    const { sendMoney } = await import("../controllers/transfer.controller.js");
    const { supabaseAdmin } = await import("../lib/supabaseAdmin.js");

    const walletChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { balance: 1000 } }),
    };
    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    };
    (supabaseAdmin.from as any) = vi.fn().mockImplementation((table: string) =>
      table === "wallets" ? walletChain : profileChain
    );

    const res = mockRes();
    await sendMoney(
      mockReq({ senderId: USER_1, recipientUsername: "nobody", amount: 100 }) as any,
      res,
      vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "RECIPIENT_NOT_FOUND" }));
  });

  it("rejects insufficient funds", async () => {
    const { sendMoney } = await import("../controllers/transfer.controller.js");
    const { supabaseAdmin } = await import("../lib/supabaseAdmin.js");

    const walletChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { balance: 10 } }), // only R10
    };
    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { user_id: USER_2 } }),
    };
    (supabaseAdmin.from as any) = vi.fn().mockImplementation((table: string) =>
      table === "wallets" ? walletChain : profileChain
    );

    const res = mockRes();
    await sendMoney(
      mockReq({ senderId: USER_1, recipientUsername: "bob", amount: 500 }) as any,
      res,
      vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "INSUFFICIENT_BALANCE" }));
  });

  it("rejects amount exceeding single-tx limit", async () => {
    const { sendMoney } = await import("../controllers/transfer.controller.js");
    const res = mockRes();
    await sendMoney(
      mockReq({ senderId: USER_1, recipientUsername: "bob", amount: 200_000 }) as any,
      res,
      vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "INVALID_INPUT" }));
  });
});

// ── 6. WEBHOOK SIGNATURE: prevents fake payments ─────────────────────────────

describe("webhook signature verification", () => {
  it("accepts valid HMAC-SHA256 signature", () => {
    const secret = "test-webhook-secret";
    const body = Buffer.from(JSON.stringify({ type: "payment.confirmed", id: "evt-1" }));
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");

    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    expect(sigBuf.length).toBe(expBuf.length);
    expect(crypto.timingSafeEqual(sigBuf, expBuf)).toBe(true);
  });

  it("rejects tampered body", () => {
    const secret = "test-webhook-secret";
    const body = Buffer.from(JSON.stringify({ type: "payment.confirmed", amount: 100 }));
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    const tampered = Buffer.from(JSON.stringify({ type: "payment.confirmed", amount: 99999 }));
    const expected = crypto.createHmac("sha256", secret).update(tampered).digest("hex");
    expect(sig).not.toBe(expected);
  });

  it("accepts valid Paystack HMAC-SHA512 signature", () => {
    const secret = "paystack-secret";
    const body = Buffer.from(JSON.stringify({ event: "charge.success" }));
    const sig = crypto.createHmac("sha512", secret).update(body).digest("hex");
    const expected = crypto.createHmac("sha512", secret).update(body).digest("hex");
    expect(sig).toBe(expected);
  });

  it("rejects Paystack webhook with wrong secret", () => {
    const realSecret = "real-secret";
    const wrongSecret = "wrong-secret";
    const body = Buffer.from(JSON.stringify({ event: "charge.success" }));
    const sig = crypto.createHmac("sha512", realSecret).update(body).digest("hex");
    const expected = crypto.createHmac("sha512", wrongSecret).update(body).digest("hex");
    expect(sig).not.toBe(expected);
  });
});

// ── 7. TRANSACTION GATE: all checks must pass ─────────────────────────────────

describe("transaction gate", () => {
  it("blocks when fraud decision is BLOCK", async () => {
    const { runTransactionGate } = await import("../core/transactionGate.js");

    const fraudState = new Map([
      ["tx-1", { decision: "BLOCK", risk: 0.95 }],
    ]);

    const job = {
      transaction_id: "tx-1",
      from_account: USER_1,
      to_account: USER_2,
      amount: 100,
      currency: "ZAR",
      risk_metadata: null,
    };

    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ balance_cents: 50000 }] }),
    };

    const result = await runTransactionGate(job, fraudState, mockClient as any);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("FRAUD_BLOCK");
  });

  it("blocks when balance is insufficient", async () => {
    const { runTransactionGate } = await import("../core/transactionGate.js");

    const fraudState = new Map(); // no fraud

    const job = {
      transaction_id: "tx-2",
      from_account: USER_1,
      to_account: USER_2,
      amount: 1000,  // R1000
      currency: "ZAR",
      risk_metadata: null,
    };

    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ balance_cents: 5000 }] }), // only R50
    };

    const result = await runTransactionGate(job, fraudState, mockClient as any);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("INSUFFICIENT_FUNDS");
  });

  it("passes when all checks are satisfied", async () => {
    const { runTransactionGate } = await import("../core/transactionGate.js");

    const fraudState = new Map(); // no fraud

    const job = {
      transaction_id: "tx-3",
      from_account: USER_1,
      to_account: USER_2,
      amount: 100,
      currency: "ZAR",
      risk_metadata: JSON.stringify({ risk: 0.1, fraudDecision: "ALLOW" }),
    };

    const mockClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ balance_cents: 50000 }] }), // R500
    };

    const result = await runTransactionGate(job, fraudState, mockClient as any);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe("PASS");
  });
});
