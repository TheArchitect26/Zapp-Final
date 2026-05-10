import { MoneyEngine } from "../core/moneyEngine.js";
import { systemGovernor } from "../governance/systemGovernor.js";

export async function executeSettlement(position) {
  const allowed = await systemGovernor.canExecute({ amount: position.amount, risk: 0, type: "net_settlement" });
  if (!allowed.ok) return { executed: false, reason: allowed.reason };

  const tx = await MoneyEngine.createTransaction({ type: "net_settlement", amount: position.amount, currency: position.currency, from: `net:${position.from}`, to: `net:${position.to}`, risk: 0 });
  await systemGovernor.registerExecution({ amount: position.amount, type: "net_settlement" });
  return { executed: true, tx };
}
