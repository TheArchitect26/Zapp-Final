import fs from "fs/promises";
import path from "path";

const MODEL_JSON_PATH = path.resolve(process.cwd(), "models/fraud_model.json");

class ModelService {
  constructor() {
    this.model = null;
    this.loading = null;
  }

  async loadModel() {
    if (this.loading) return this.loading;

    this.loading = fs.readFile(MODEL_JSON_PATH, "utf8")
      .then((raw) => {
        this.model = JSON.parse(raw);
        return this.model;
      })
      .catch(() => {
        this.model = null;
        return null;
      })
      .finally(() => {
        this.loading = null;
      });

    return this.loading;
  }

  heuristicScore(features) {
    let score = 0.1;
    score += Math.min((features.velocityPerMinute || 0) / 20, 0.3);
    score += Math.min((features.frequencyPerHour || 0) / 100, 0.2);
    score += Math.min((features.amountDeviation || 0) / 5, 0.2);
    score += Math.min(Number(features.countryRisk || 0), 0.2);
    score += Math.min((features.relationshipSpread || 0) / 40, 0.1);
    return Math.max(0, Math.min(score, 1));
  }

  vectorize(features) {
    return [
      Number(features.velocityPerMinute || 0),
      Number(features.frequencyPerHour || 0),
      Number(features.amountDeviation || 0),
      Number(features.countryRisk || 0),
      Number(features.relationshipSpread || 0),
    ];
  }

  async predict(features) {
    if (!this.model) await this.loadModel();

    if (!this.model?.weights?.length) {
      return { score: this.heuristicScore(features), source: "heuristic" };
    }

    const vector = this.vectorize(features);
    const z = vector.reduce((sum, value, i) => sum + value * Number(this.model.weights[i] || 0), Number(this.model.bias || 0));
    const score = 1 / (1 + Math.exp(-z));
    return { score: Math.max(0, Math.min(score, 1)), source: `ml:${this.model.version || "unknown"}` };
  }

  async train(dataset = []) {
    return {
      accepted: dataset.length,
      queued: true,
      note: "Training is executed by mlRetrainWorker Python job",
    };
  }
}

export const modelService = new ModelService();
