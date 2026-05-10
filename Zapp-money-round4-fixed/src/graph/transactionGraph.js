const graphState = {
  nodes: new Map(),
  adjacency: new Map(),
};

function getOrCreateNode(nodeId, nodeType) {
  if (!nodeId) return null;
  if (!graphState.nodes.has(nodeId)) {
    graphState.nodes.set(nodeId, {
      id: nodeId,
      type: nodeType,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
    });
  } else {
    graphState.nodes.get(nodeId).lastSeenAt = Date.now();
  }

  return graphState.nodes.get(nodeId);
}

function edgeKey(fromId, toId, edgeType) {
  return `${fromId}->${toId}:${edgeType}`;
}

function addOrUpdateEdge(fromId, toId, edgeType, amount = 0) {
  if (!fromId || !toId) return null;
  if (!graphState.adjacency.has(fromId)) graphState.adjacency.set(fromId, new Map());

  const fromEdges = graphState.adjacency.get(fromId);
  const key = edgeKey(fromId, toId, edgeType);
  const existing = fromEdges.get(key) || {
    from: fromId,
    to: toId,
    type: edgeType,
    amountTotal: 0,
    frequency: 0,
    timestamps: [],
  };

  existing.amountTotal += Number(amount || 0);
  existing.frequency += 1;
  existing.timestamps.push(Date.now());
  existing.timestamps = existing.timestamps.slice(-100);
  fromEdges.set(key, existing);

  return existing;
}

export function addTransactionToGraph(packet) {
  const payload = packet.payload || {};
  const from = payload.from || payload.from_account || null;
  const to = payload.to || payload.to_account || null;
  const amount = Number(payload.amount || 0);
  const deviceId = payload.deviceId || payload.device || null;

  if (!from || !to) return null;

  getOrCreateNode(from, "account");
  getOrCreateNode(to, "account");
  if (payload.userId) getOrCreateNode(payload.userId, "user");
  if (deviceId) getOrCreateNode(deviceId, "device");

  const transferEdge = addOrUpdateEdge(from, to, "transfer", amount);

  if (payload.userId) {
    addOrUpdateEdge(payload.userId, from, "interaction", 0);
    addOrUpdateEdge(payload.userId, to, "interaction", 0);
  }

  if (deviceId) {
    addOrUpdateEdge(deviceId, from, "interaction", 0);
    addOrUpdateEdge(deviceId, to, "interaction", 0);
  }

  return transferEdge;
}

export function getNeighbors(nodeId) {
  const edges = graphState.adjacency.get(nodeId);
  if (!edges) return [];
  return Array.from(edges.values());
}

export function getGraphSnapshot() {
  return {
    nodeCount: graphState.nodes.size,
    edgeCount: Array.from(graphState.adjacency.values()).reduce((sum, m) => sum + m.size, 0),
  };
}
