import { getAllPositions } from "./positionStore.js";

export function calculateNetPositions() {
  const positions = getAllPositions();
  const net = new Map();

  for (const p of positions) {
    const forward = `${p.from}:${p.to}:${p.currency}`;
    const reverse = `${p.to}:${p.from}:${p.currency}`;
    const rev = Number(net.get(reverse) || 0);
    const next = Number(p.amount || 0) - rev;
    net.delete(reverse);
    if (next > 0) net.set(forward, next);
    else if (next < 0) net.set(reverse, Math.abs(next));
  }

  return Array.from(net.entries()).map(([k, amount]) => {
    const [from, to, currency] = k.split(":");
    return { from, to, currency, amount };
  });
}
