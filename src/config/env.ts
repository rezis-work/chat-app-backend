import { z } from 'zod';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
// In test environment, prefer .env.test if it exists
if (process.env.NODE_ENV === 'test') {
  dotenv.config({ path: resolve(__dirname, '../../.env.test') });
}
dotenv.config(); // Fallback to .env

const envSchema = z.object({
  PORT: z
    .string()
    .default('3001')
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(65535)),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  COOKIE_SECRET: z.string().min(1),
  ACCESS_TOKEN_TTL: z
    .string()
    .default('900000')
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(1)),
  REFRESH_TOKEN_TTL: z
    .string()
    .default('604800000')
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(1)),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1), // Format: "Name <email@domain.com>" or "email@domain.com"
  APP_BASE_URL: z.string().url(),
  EMAIL_VERIFY_PATH: z.string().default('/verify-email'),
  EMAIL_RESET_PATH: z.string().default('/reset-password'),
  OPENAI_API_KEY: z.string().min(1).optional(),
  TRANSLATION_QUEUE_NAME: z.string().default('translation'),
  TRANSLATION_CONCURRENCY: z
    .string()
    .default('5')
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(1)),
  TRANSLATION_MAX_RETRIES: z
    .string()
    .default('5')
    .transform(val => parseInt(val, 10))
    .pipe(z.number().int().min(1)),
});

type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:');
    error.errors.forEach(err => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export { env };
export type { Env };
