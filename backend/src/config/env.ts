import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('3000').transform((val) => parseInt(val, 10)),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().default('super-secret-jwt-key-coldchain-pulse-2026-medswift'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  DATABASE_URL: z.string().optional().default('postgresql://postgres:password@localhost:5432/coldchain_pulse?schema=public'),
  SIMULATOR_INTERVAL_MS: z.string().default('30000').transform((val) => parseInt(val, 10)),
  SIMULATOR_API_URL: z.string().default('http://localhost:3000/api/v1/telemetry/ingest'),
  DEFAULT_MIN_TEMP: z.string().default('2.0').transform((val) => parseFloat(val)),
  DEFAULT_MAX_TEMP: z.string().default('8.0').transform((val) => parseFloat(val)),
  WARNING_TEMP_BUFFER: z.string().default('0.5').transform((val) => parseFloat(val)),
  CRITICAL_BREACH_DURATION_MINUTES: z.string().default('10').transform((val) => parseFloat(val)),
});

export const env = envSchema.parse(process.env);
