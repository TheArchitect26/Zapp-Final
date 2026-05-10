const nodes = new Map();

export function registerNode(node) {
  nodes.set(node.id, {
    id: node.id,
    type: node.type,
    region: node.region,
    currencies: node.currencies || [],
    liquidity: node.liquidity || {},
    reliability: Number(node.reliability || 0.9),
    latency: Number(node.latency || 100),
  });
}

export function getNodesByCurrency(currency) {
  return Array.from(nodes.values()).filter((n) => n.currencies.includes(currency));
}

export function getNode(id) {
  return nodes.get(id) || null;
}

export function listNodes() {
  return Array.from(nodes.values());
}
