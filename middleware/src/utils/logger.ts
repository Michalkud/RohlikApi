import winston from 'winston';
import { config } from './config.js';

const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = ' ' + JSON.stringify(meta, null, 2);
    }
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
    level: config.get('LOG_LEVEL'),
  }),
];

// File transport (only in production or if log file path is specified)
if (config.isProduction() || config.get('LOG_FILE_PATH')) {
  transports.push(
    new winston.transports.File({
      filename: config.get('LOG_FILE_PATH'),
      format: logFormat,
      level: config.get('LOG_LEVEL'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
    })
  );
}

export const logger = winston.createLogger({
  level: config.get('LOG_LEVEL'),
  format: logFormat,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Create specialized loggers for different components
export const createComponentLogger = (component: string) => {
  return {
    error: (message: string, meta?: any) => 
      logger.error(message, { component, ...meta }),
    warn: (message: string, meta?: any) => 
      logger.warn(message, { component, ...meta }),
    info: (message: string, meta?: any) => 
      logger.info(message, { component, ...meta }),
    debug: (message: string, meta?: any) => 
      logger.debug(message, { component, ...meta }),
  };
};

// Export component-specific loggers
export const httpLogger = createComponentLogger('HTTP_CLIENT');
export const sessionLogger = createComponentLogger('SESSION_MANAGER');
export const authLogger = createComponentLogger('AUTH_SERVICE');
export const cartLogger = createComponentLogger('CART_SERVICE');
export const productLogger = createComponentLogger('PRODUCT_SERVICE');
export const middlewareLogger = createComponentLogger('MIDDLEWARE'); 