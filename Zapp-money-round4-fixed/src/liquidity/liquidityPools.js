const pools = new Map();

function key(region, currency) {
  return `${region}:${currency}`;
}

export const liquidityPools = {
  upsertPool({ region, currency, balance = 0, reserve = 0 }) {
    const id = key(region, currency);
    pools.set(id, { region, currency, balance: Number(balance), reserve: Number(reserve), updatedAt: Date.now() });
    return pools.get(id);
  },

  adjustPool(region, currency, delta) {
    const id = key(region, currency);
    const pool = pools.get(id) || { region, currency, balance: 0, reserve: 0, updatedAt: Date.now() };
    pool.balance = Number(pool.balance) + Number(delta || 0);
    pool.updatedAt = Date.now();
    pools.set(id, pool);
    return pool;
  },

  getPool(region, currency) {
    return pools.get(key(region, currency)) || null;
  },

  listPools() {
    return Array.from(pools.values());
  },
};
