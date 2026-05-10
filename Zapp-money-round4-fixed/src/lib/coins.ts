export interface CoinRate {
  zc_per_unit: number;
  symbol: string;
  display_decimals: number;
  currency_code: string;
}

/** Convert ZC integer to display string. e.g. 500 ZC @ ZAR(100) → "R5.00" */
export function zcToDisplay(zc: number, rate: CoinRate): string {
  const amount = zc / rate.zc_per_unit;
  return rate.symbol + amount.toFixed(rate.display_decimals);
}

/** Convert ZC integer to fiat number. */
export function zcToNumber(zc: number, rate: CoinRate): number {
  return zc / rate.zc_per_unit;
}
