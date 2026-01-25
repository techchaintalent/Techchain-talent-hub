import { z } from "zod";

const envSchema = z.object({
  // Core
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DEV_MODE: z.string().transform((v) => v === "true").default("false"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  // Database
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Auth
  NEXTAUTH_SECRET: z.string(),
  NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("TechChain Talent Hub <noreply@techchain.io>"),

  // Payments
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_CONNECT_CLIENT_ID: z.string().optional(),

  // Storage
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  UPLOADTHING_SECRET: z.string().optional(),
  UPLOADTHING_APP_ID: z.string().optional(),

  // AI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4-turbo-preview"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-3-sonnet-20240229"),
  AI_PROVIDER: z.enum(["openai", "anthropic", "mock"]).default("mock"),

  // GitHub
  GITHUB_TOKEN: z.string().optional(),

  // Platform Config
  DEFAULT_TAKE_RATE: z.string().transform(Number).default("15"),
  PAYMENT_DELAY_DAYS: z.string().transform(Number).default("14"),

  // Feature Flags
  FEATURE_PHONE_VERIFICATION: z.string().transform((v) => v === "true").default("false"),
  FEATURE_CANDIDATE_DISCOVERY: z.string().transform((v) => v === "true").default("true"),
  FEATURE_COMPANY_CANDIDATE_BROWSE: z.string().transform((v) => v === "true").default("false"),

  // Rate Limiting
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.string().transform(Number).default("60"),
});

export type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

export const env = getEnv();

export function isDevMode(): boolean {
  return env.DEV_MODE;
}

export function requireProdService(serviceName: string, envVar: string): void {
  if (!isDevMode() && !process.env[envVar]) {
    throw new Error(`${serviceName} requires ${envVar} in production mode`);
  }
}
