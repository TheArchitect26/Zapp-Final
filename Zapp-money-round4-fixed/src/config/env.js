import dotenv from "dotenv";

dotenv.config();

const required = [
  "DATABASE_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WEBHOOK_SECRET",
];

export function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
      `Copy .env.example to .env and fill in the required values.`
    );
  }
  process.stdout.write("[INIT SUCCESS] Environment variables validated\n");
}
