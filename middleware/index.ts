import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './src/utils/config.js';
import { middlewareLogger } from './src/utils/logger.js';
import { RohlikClient } from './src/clients/rohlik-client.js';

// Import route handlers
import { productRoutes } from './src/routes/products.js';
import { authRoutes } from './src/routes/auth.js';
import { cartRoutes } from './src/routes/cart.js';

const fastify = Fastify({
  logger: {
    level: config.get('LOG_LEVEL'),
    transport: config.isDevelopment() ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
});

// Global Rohlik client instance
let rohlikClient: RohlikClient;

async function buildServer() {
  try {
    // Initialize Rohlik client
    rohlikClient = new RohlikClient();
    
    // Add CORS support
    await fastify.register(cors, {
      origin: config.get('CORS_ORIGIN'),
      credentials: true,
    });

    // Add Swagger documentation
    if (config.getBoolean('ENABLE_SWAGGER')) {
      await fastify.register(swagger, {
        swagger: {
          info: {
            title: 'Rohlik.cz Middleware API',
            description: 'Real middleware for ordering food from Rohlik.cz',
            version: '1.0.0',
          },
          host: `${config.get('HOST')}:${config.get('PORT')}`,
          schemes: ['http', 'https'],
          consumes: ['application/json'],
          produces: ['application/json'],
          tags: [
            { name: 'auth', description: 'Authentication endpoints' },
            { name: 'products', description: 'Product catalog endpoints' },
            { name: 'cart', description: 'Shopping cart endpoints' },
            { name: 'orders', description: 'Order management endpoints' },
            { name: 'health', description: 'Health check endpoints' },
          ],
        },
      });

      await fastify.register(swaggerUi, {
        routePrefix: '/docs',
        uiConfig: {
          docExpansion: 'full',
          deepLinking: false,
        },
        staticCSP: true,
        transformStaticCSP: (header) => header,
        transformSpecification: (swaggerObject) => {
          return swaggerObject;
        },
        transformSpecificationClone: true,
      });
    }

    // Health check endpoint
    fastify.get('/health', {
      schema: {
        tags: ['health'],
        summary: 'Health check',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              uptime: { type: 'number' },
              rohlikConnection: { type: 'string' },
              sessionInfo: { type: 'object' },
            },
          },
        },
      },
    }, async (request, reply) => {
      try {
        // Test Rohlik connection
        let rohlikConnection = 'disconnected';
        let sessionInfo = {};
        
        try {
          sessionInfo = rohlikClient.getSessionInfo();
          rohlikConnection = rohlikClient.isAuthenticated() ? 'authenticated' : 'connected';
        } catch (error) {
          middlewareLogger.warn('Rohlik connection check failed', { error });
        }

        return {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          rohlikConnection,
          sessionInfo,
        };
      } catch (error) {
        middlewareLogger.error('Health check failed', { error });
        reply.status(500);
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Test endpoint to verify Rohlik.cz connection
    fastify.get('/test/homepage', {
      schema: {
        tags: ['health'],
        summary: 'Test Rohlik.cz homepage connection',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              sessionInfo: { type: 'object' },
            },
          },
        },
      },
    }, async (request, reply) => {
      try {
        await rohlikClient.getHomepage();
        return {
          success: true,
          message: 'Successfully connected to Rohlik.cz homepage',
          sessionInfo: rohlikClient.getSessionInfo(),
        };
      } catch (error) {
        middlewareLogger.error('Homepage test failed', { error });
        reply.status(500);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error',
          sessionInfo: rohlikClient.getSessionInfo(),
        };
      }
    });

    // Test endpoint to load a known product
    fastify.get('/test/product/:productId', {
      schema: {
        tags: ['health'],
        summary: 'Test loading a specific product from Rohlik.cz',
        params: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
          },
          required: ['productId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              productId: { type: 'string' },
              sessionInfo: { type: 'object' },
            },
          },
        },
      },
    }, async (request, reply) => {
      const { productId } = request.params as { productId: string };
      
      try {
        await rohlikClient.getProduct(productId);
        return {
          success: true,
          message: `Successfully loaded product ${productId}`,
          productId,
          sessionInfo: rohlikClient.getSessionInfo(),
        };
      } catch (error) {
        middlewareLogger.error('Product test failed', { error, productId });
        reply.status(500);
        return {
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error',
          productId,
          sessionInfo: rohlikClient.getSessionInfo(),
        };
      }
    });

    // Register route handlers
    await fastify.register(productRoutes, { prefix: '/api/products' });
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.register(cartRoutes, { prefix: '/api/cart' });

    middlewareLogger.info('Middleware server built successfully');
    return fastify;
  } catch (error) {
    middlewareLogger.error('Failed to build server', { error });
    throw error;
  }
}

async function start() {
  try {
    const server = await buildServer();
    
    const address = await server.listen({
      port: config.getNumber('PORT'),
      host: config.get('HOST'),
    });

    middlewareLogger.info(`🚀 Rohlik.cz Middleware Server running at ${address}`);
    
    if (config.getBoolean('ENABLE_SWAGGER')) {
      middlewareLogger.info(`📚 API Documentation available at ${address}/docs`);
    }

    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        middlewareLogger.info(`Received ${signal}, shutting down gracefully...`);
        
        try {
          await server.close();
          middlewareLogger.info('Server closed successfully');
          process.exit(0);
        } catch (error) {
          middlewareLogger.error('Error during shutdown', { error });
          process.exit(1);
        }
      });
    });

  } catch (error) {
    middlewareLogger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Export for testing
export { buildServer, rohlikClient };

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
} 