const positions = new Map();

function key(a, b, c = "USD") { return `${a}:${b}:${c}`; }

export function addPosition(from, to, currency, amount) {
  const k = key(from, to, currency);
  positions.set(k, Number(positions.get(k) || 0) + Number(amount || 0));
}

export function getAllPositions() {
  return Array.from(positions.entries()).map(([k, amount]) => {
    const [from, to, currency] = k.split(":");
    return { from, to, currency, amount };
  });
}

export function clearPositions() { positions.clear(); }
