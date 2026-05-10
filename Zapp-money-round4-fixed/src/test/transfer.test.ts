/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const USER_1 = "11111111-1111-1111-1111-111111111111";
const USER_2 = "22222222-2222-2222-2222-222222222222";

vi.mock("../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));
vi.mock("../services/fraudAI.service.js", () => ({
  learnFraud: vi.fn(),
}));
vi.mock("../fraud/fraudPipeline.js", () => ({
  runFraudPipeline: vi.fn().mockResolvedValue({
    finalScore: 0.1,
    decision: { level: "LOW" },
    enforcement: "ALLOW",
  }),
}));
vi.mock("../lib/auditLog.js", () => ({
  auditLog: { transactionCreated: vi.fn(), transactionFailed: vi.fn() },
}));
vi.mock("../services/withdrawal.service.js", () => ({
  processWithdrawal: vi.fn().mockResolvedValue({ ok: true }),
  WITHDRAWAL_STATUS: { PENDING: "pending" },
}));
vi.mock("../db/index.js", () => ({
  db: { query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }) },
}));

import { sendMoney } from "../controllers/transfer.controller.js";
import { supabaseAdmin } from "../lib/supabaseAdmin.js";

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(body: any, userId = USER_1) {
  return { body, user: { id: userId }, headers: {} };
}

beforeEach(() => vi.clearAllMocks());

describe("transfer controller", () => {
  it("rejects missing fields", async () => {
    const res = mockRes();
    await sendMoney(mockReq({}), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects sender mismatch", async () => {
    const res = mockRes();
    // USER_2 is a valid UUID but doesn't match the authenticated USER_1
    await sendMoney(mockReq({ senderId: USER_2, recipientUsername: "bob", amount: 100 }, USER_1), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("rejects unknown recipient", async () => {
    const res = mockRes();
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
    (supabaseAdmin.from as any).mockImplementation((table: string) =>
      table === "wallets" ? walletChain : profileChain
    );
    await sendMoney(mockReq({ senderId: USER_1, recipientUsername: "nobody", amount: 100 }, USER_1), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
