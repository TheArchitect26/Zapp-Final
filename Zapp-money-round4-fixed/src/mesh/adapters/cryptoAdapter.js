export class CryptoAdapter {
  async getLiquidity() { return { available: 2_000_000 }; }
  async executeTransfer() { return { success: true }; }
  async getFXRate() { return 1; }
}
