import axios from "axios";

const client = axios.create({ timeout: 3000 });

async function withRetry(requestFn, retries = 2) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      if (i === retries) throw lastError;
    }
  }
  throw lastError;
}

export async function scoreRoute(payload) {
  const res = await withRetry(() => client.post("http://localhost:4000/score-route", payload));
  return { score: Number(res.data?.score || 0) };
}

export async function predictFx(payload) {
  const res = await withRetry(() => client.post("http://localhost:4000/fx", payload));
  return { rate: Number(res.data?.rate || 0) };
}

export async function detectFraud(payload) {
  const res = await withRetry(() => client.post("http://localhost:4000/fraud", payload));
  return {
    risk: Number(res.data?.risk ?? res.data?.score ?? 0),
    raw: res.data,
  };
}
