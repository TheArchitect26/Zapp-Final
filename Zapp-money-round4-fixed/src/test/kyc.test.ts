/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabaseAdmin.js", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

import { initiateKYC } from "../controllers/kyc.controller.js";

function mockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => vi.clearAllMocks());

describe("KYC controller", () => {
  it("rejects missing fields", async () => {
    const res = mockRes();
    await initiateKYC({ body: {}, user: { id: "u1" } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects invalid SA ID number", async () => {
    const res = mockRes();
    await initiateKYC(
      { body: { id_number: "123", first_name: "John", last_name: "Doe" }, user: { id: "u1" } },
      res, vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "Invalid SA ID number" }));
  });

  it("rejects already-verified user", async () => {
    const { supabaseAdmin } = await import("../lib/supabaseAdmin.js");
    (supabaseAdmin.from as any).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { kyc_status: "verified" } }),
    });
    const res = mockRes();
    await initiateKYC(
      { body: { id_number: "9001015009087", first_name: "John", last_name: "Doe" }, user: { id: "u1" } },
      res, vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(409);
  });
});
