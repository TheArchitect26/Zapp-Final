import { db } from "./db/index.js";
import { settlementWorkerPool } from "./settlement/runtime.js";
import { circuitBreaker } from "./brain/circuitBreaker.js";
import { controlPlane } from "./controlPlane.js";

class SelfHealingSystem {
  constructor() { this.timer = null; this.running = false; }
  async cycle() {
    const [pending, dlq] = await Promise.all([
      db.query("SELECT COUNT(*)::int AS c FROM settlement_queue WHERE status='PENDING'"),
      db.query("SELECT COUNT(*)::int AS c FROM settlement_dlq"),
    ]);
    const p = pending.rows[0]?.c || 0;
    const d = dlq.rows[0]?.c || 0;
    const healthScore = Math.max(0, 1 - (p / 5000) - (d / 1000));
    const critical = healthScore < 0.2;
    controlPlane.globalStateStore.set({ healthScore, critical });

    // Persist so monitoring dashboards survive restarts
    try {
      const { stateSet } = await import("./governance/stateStore.js");
      await stateSet("healthScore:latest", {
        healthScore,
        critical,
        pendingSettlements: p,
        dlqSize: d,
        recordedAt: new Date().toISOString(),
      });
    } catch { /* non-fatal — health score write must never crash the cycle */ }

    if (d > 100) circuitBreaker.forceShadow("dlq_spike");
    circuitBreaker.evaluateRecovery();
  }
  start(intervalMs = 15000) { if (this.running) return; this.running = true; this.timer = setInterval(() => { this.cycle().catch(() => {}); }, intervalMs); }
  stop() { if (this.timer) clearInterval(this.timer); this.running = false; }
}

export const selfHealingSystem = new SelfHealingSystem();
