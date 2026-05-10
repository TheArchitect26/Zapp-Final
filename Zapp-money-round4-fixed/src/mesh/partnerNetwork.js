const partners = new Map();

export function registerPartner(node) {
  partners.set(node.id, {
    id: node.id,
    region: node.region,
    currencies: node.currencies || [],
    capacity: Number(node.capacity || 0),
    fxSpread: Number(node.fxSpread || 0.002),
    latency: Number(node.latency || 120),
    health: Number(node.health || 0.9),
    failures: 0,
  });
}

export function getBestPartners(amount, currency, region) {
  return Array.from(partners.values())
    .filter((p) => p.region === region && p.currencies.includes(currency) && p.capacity >= amount)
    .sort((a, b) => (a.fxSpread + a.latency / 1000 - a.health) - (b.fxSpread + b.latency / 1000 - b.health));
}

export async function simulateSettlement(partnerId, tx) {
  const p = partners.get(partnerId);
  if (!p) throw new Error("PARTNER_NOT_FOUND");
  await new Promise((r) => setTimeout(r, Math.min(5, p.latency / 50)));
  const success = p.health > 0.2;
  if (!success) p.failures += 1;
  return { success, partnerId, latency: p.latency, txId: tx?.id || null };
}

export function updatePartnerHealth({ partnerId, success = true, latency = 0 }) {
  const p = partners.get(partnerId);
  if (!p) return;
  p.health = Math.max(0.05, Math.min(1, p.health + (success ? 0.01 : -0.05) - Math.max(0, latency - 500) / 10000));
}

export function getPartner(partnerId) { return partners.get(partnerId) || null; }
