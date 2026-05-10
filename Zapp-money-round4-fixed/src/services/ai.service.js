import { scoreRoute as scoreRouteAdapter } from "./aiAdapter.js";

export async function scoreRoute({ cost, speed, reliability, liquidity }) {
  const result = await scoreRouteAdapter({ cost, speed, reliability, liquidity });
  return result.score;
}
