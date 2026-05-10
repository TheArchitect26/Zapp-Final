export class MobileMoneyAdapter {
  async getLiquidity() { return { available: 500_000 }; }
  async executeTransfer() { return { success: true }; }
  async getFXRate() { return 1; }
}
