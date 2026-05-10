const edgesByFrom = new Map();

export function registerEdge(edge) {
  const arr = edgesByFrom.get(edge.from) || [];
  arr.push({ ...edge, fee: Number(edge.fee || 0), latency: Number(edge.latency || 0), capacity: Number(edge.capacity || 0), fxRate: Number(edge.fxRate || 1) });
  edgesByFrom.set(edge.from, arr);
}

export function getEdges(fromNode) {
  return edgesByFrom.get(fromNode) || [];
}
