#!/usr/bin/env tsx

import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

const fastify = Fastify({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-pretty'
    }
  }
});

// CORS configuration
fastify.register(cors, {
  origin: true,
  credentials: true
});

// Load OpenAPI spec
const specPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');
let openApiSpec: any = {};

if (fs.existsSync(specPath)) {
  const specContent = fs.readFileSync(specPath, 'utf8');
  openApiSpec = yaml.parse(specContent);
} else {
  console.warn('OpenAPI spec not found, using minimal configuration');
  openApiSpec = {
    openapi: '3.1.0',
    info: {
      title: 'Rohlik.cz API Mock',
      version: '1.0.0',
      description: 'Mock server for Rohlik.cz API'
    },
    paths: {}
  };
}

// Register Swagger
fastify.register(swagger, {
  openapi: openApiSpec,
  hideUntagged: true
});

// Register Swagger UI
fastify.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: false
  },
  uiHooks: {
    onRequest: function (request, reply, next) {
      next();
    },
    preHandler: function (request, reply, next) {
      next();
    }
  },
  staticCSP: true,
  transformStaticCSP: (header) => header
});

// Mock data generators
class MockDataGenerator {
  static generateProductList() {
    return {
      products: [
        {
          id: 1471819,
          name: "Deli Q Daily Plant Plátky s příchutí kozího sýru",
          price: 44.90,
          originalPrice: 49.90,
          currency: "CZK",
          unit: "100 g",
          pricePerKg: 449,
          category: "Sýry",
          inStock: true,
          discount: true,
          imageUrl: "/images/products/1471819.jpg",
          brand: "Deli Q"
        },
        {
          id: 1413424,
          name: "Miil Eidam 30% plátky",
          price: 21.90,
          currency: "CZK",
          unit: "100 g", 
          pricePerKg: 219,
          category: "Sýry",
          inStock: true,
          discount: false,
          imageUrl: "/images/products/1413424.jpg",
          brand: "Miil"
        }
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        hasMore: false
      }
    };
  }

  static generateProduct(id: string) {
    return {
      id: parseInt(id),
      name: "Miil Eidam 30% plátky",
      description: "Kvalitní eidam s 30% tuku, ideální na sendviče a topinky",
      price: 21.90,
      currency: "CZK",
      unit: "100 g",
      pricePerKg: 219,
      category: "Sýry",
      subcategory: "Tvrdé sýry",
      inStock: true,
      stockQuantity: 150,
      brand: "Miil",
      origin: "Česká republika",
      nutritionalInfo: {
        energy: "1580 kJ / 380 kcal",
        fat: "30 g",
        saturatedFat: "20 g",
        carbohydrates: "0 g",
        sugars: "0 g",
        protein: "25 g",
        salt: "1.8 g"
      },
      allergens: ["Mléko"],
      images: [
        "/images/products/1413424-1.jpg",
        "/images/products/1413424-2.jpg"
      ],
      reviews: {
        averageRating: 4.5,
        totalReviews: 23
      }
    };
  }

  static generateCategories() {
    return {
      categories: [
        {
          id: "300105000",
          name: "Mléčné a chlazené",
          slug: "mlecne-a-chlazene",
          parentId: null,
          subcategories: [
            {
              id: "300105026",
              name: "Sýry",
              slug: "syry",
              productCount: 245
            },
            {
              id: "300105008", 
              name: "Jogurty a mléčné dezerty",
              slug: "jogurty-a-mlecne-dezerty",
              productCount: 180
            }
          ]
        },
        {
          id: "300102000",
          name: "Ovoce a zelenina", 
          slug: "ovoce-a-zelenina",
          parentId: null,
          subcategories: []
        }
      ]
    };
  }

  static generateCart() {
    return {
      id: "cart-123",
      items: [
        {
          productId: 1413424,
          name: "Miil Eidam 30% plátky",
          quantity: 2,
          unitPrice: 21.90,
          totalPrice: 43.80,
          currency: "CZK"
        }
      ],
      summary: {
        itemsCount: 2,
        subtotal: 43.80,
        delivery: 99.00,
        total: 142.80,
        currency: "CZK"
      },
      deliveryInfo: {
        minOrderValue: 749,
        freeDeliveryThreshold: 1500
      }
    };
  }

  static generateAuthResponse() {
    return {
      user: {
        id: "user-123",
        email: "test@example.com",
        firstName: "Jan",
        lastName: "Novák",
        phone: "+420123456789"
      },
      token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      refreshToken: "refresh_token_example",
      expiresIn: 3600
    };
  }
}

// Mock API routes
fastify.get('/api/categories', async (request, reply) => {
  return MockDataGenerator.generateCategories();
});

fastify.get('/api/products', async (request, reply) => {
  return MockDataGenerator.generateProductList();
});

fastify.get('/api/products/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  return MockDataGenerator.generateProduct(id);
});

fastify.get('/api/cart', async (request, reply) => {
  return MockDataGenerator.generateCart();
});

fastify.post('/api/cart/items', async (request, reply) => {
  const body = request.body as { productId: number; quantity: number };
  return {
    success: true,
    message: "Product added to cart",
    cart: MockDataGenerator.generateCart()
  };
});

fastify.post('/api/auth/login', async (request, reply) => {
  const body = request.body as { email: string; password: string };
  
  // Mock authentication
  if (body.email && body.password) {
    return MockDataGenerator.generateAuthResponse();
  } else {
    reply.code(400);
    return { error: "Invalid credentials" };
  }
});

// Category-specific routes (matching Rohlik URL patterns)
fastify.get('/c:categoryId-:slug', async (request, reply) => {
  const { categoryId, slug } = request.params as { categoryId: string; slug: string };
  return {
    category: {
      id: categoryId,
      name: slug.replace(/-/g, ' '),
      products: MockDataGenerator.generateProductList().products
    }
  };
});

// Health check
fastify.get('/health', async (request, reply) => {
  return { 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  };
});

// Root endpoint
fastify.get('/', async (request, reply) => {
  return {
    message: 'Rohlik.cz API Mock Server',
    version: '1.0.0',
    docs: '/docs',
    health: '/health',
    endpoints: {
      categories: '/api/categories',
      products: '/api/products',
      cart: '/api/cart',
      auth: '/api/auth/login'
    }
  };
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    
    console.log(`🚀 Rohlik.cz API Mock Server started!`);
    console.log(`📖 API Documentation: http://localhost:${port}/docs`);
    console.log(`💚 Health Check: http://localhost:${port}/health`);
    console.log(`🔗 Base URL: http://localhost:${port}`);
    
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  try {
    await fastify.close();
    console.log('✅ Server closed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  start();
} 