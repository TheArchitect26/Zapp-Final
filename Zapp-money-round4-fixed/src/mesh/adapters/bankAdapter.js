export class BankAdapter {
  async getLiquidity() { return { available: 1_000_000 }; }
  async executeTransfer() { return { success: true }; }
  async getFXRate() { return 1; }
}
