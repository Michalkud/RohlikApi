import { z } from 'zod';

const ConfigSchema = z.object({
  // Server Configuration
  PORT: z.string().default('3001'),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Rohlik.cz Configuration
  ROHLIK_BASE_URL: z.string().default('https://www.rohlik.cz'),
  ROHLIK_API_BASE_URL: z.string().default('https://www.rohlik.cz/api'),
  
  // Authentication (optional - for testing with real account)
  ROHLIK_EMAIL: z.string().optional(),
  ROHLIK_PASSWORD: z.string().optional(),
  
  // Rate Limiting
  RATE_LIMIT_REQUESTS_PER_MINUTE: z.string().default('30'),
  RATE_LIMIT_REQUESTS_PER_HOUR: z.string().default('500'),
  
  // Session Management
  SESSION_TIMEOUT_MINUTES: z.string().default('30'),
  COOKIE_MAX_AGE_HOURS: z.string().default('24'),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FILE_PATH: z.string().default('./logs/middleware.log'),
  
  // Security
  CORS_ORIGIN: z.string().default('*'),
  ENABLE_SWAGGER: z.string().default('true'),
});

type Config = z.infer<typeof ConfigSchema>;

class ConfigManager {
  private config: Config;

  constructor() {
    const result = ConfigSchema.safeParse(process.env);
    
    if (!result.success) {
      console.error('Configuration validation failed:', result.error);
      throw new Error('Invalid configuration');
    }
    
    this.config = result.data;
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  getNumber(key: keyof Config): number {
    const value = this.config[key];
    if (typeof value !== 'string') {
      throw new Error(`Config value ${key} is not a string`);
    }
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error(`Config value ${key} is not a valid number`);
    }
    return num;
  }

  getBoolean(key: keyof Config): boolean {
    const value = this.config[key];
    if (typeof value !== 'string') {
      throw new Error(`Config value ${key} is not a string`);
    }
    return value.toLowerCase() === 'true';
  }

  isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  hasRohlikCredentials(): boolean {
    return !!(this.config.ROHLIK_EMAIL && this.config.ROHLIK_PASSWORD);
  }

  getRohlikCredentials(): { email: string; password: string } | null {
    if (!this.hasRohlikCredentials()) {
      return null;
    }
    return {
      email: this.config.ROHLIK_EMAIL!,
      password: this.config.ROHLIK_PASSWORD!,
    };
  }
}

export const config = new ConfigManager();
export type { Config }; 