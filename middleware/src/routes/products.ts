import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ProductService, type ProductSearchOptions } from '../services/product-service.js';
import { middlewareLogger } from '../utils/logger.js';

interface ProductParams {
  id: string;
}

interface ProductSearchQuery {
  q?: string;
  category?: string;
  limit?: string;
  offset?: string;
}

export async function productRoutes(fastify: FastifyInstance) {
  const productService = ProductService.getInstance();

  // Get single product by ID
  fastify.get<{ Params: ProductParams }>('/api/products/:id', async (request: FastifyRequest<{ Params: ProductParams }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
      middlewareLogger.info('Product request received', { productId: id });

      const product = await productService.getProduct(id);
      
      if (!product) {
        return reply.status(404).send({
          success: false,
          error: 'Product not found',
          message: `Product with ID ${id} was not found`
        });
      }

      return reply.send({
        success: true,
        data: product,
        message: 'Product retrieved successfully'
      });
    } catch (error) {
      middlewareLogger.error('Failed to get product', { 
        productId: request.params.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve product'
      });
    }
  });

  // Search products
  fastify.get<{ Querystring: ProductSearchQuery }>('/api/products', async (request: FastifyRequest<{ Querystring: ProductSearchQuery }>, reply: FastifyReply) => {
    try {
      const { q, category, limit, offset } = request.query;
      
      const searchOptions: ProductSearchOptions = {
        query: q,
        category,
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0
      };

      middlewareLogger.info('Product search request received', searchOptions);

      const products = await productService.searchProducts(searchOptions);

      return reply.send({
        success: true,
        data: products,
        meta: {
          total: products.length,
          limit: searchOptions.limit || 20,
          offset: searchOptions.offset || 0,
          query: q,
          category
        },
        message: 'Products retrieved successfully'
      });
    } catch (error) {
      middlewareLogger.error('Failed to search products', { 
        query: request.query,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to search products'
      });
    }
  });

  // Get known test products
  fastify.get('/api/products/known', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      middlewareLogger.info('Known products request received');

      const products = await productService.getKnownProducts();

      return reply.send({
        success: true,
        data: products,
        message: `Retrieved ${products.length} known products`
      });
    } catch (error) {
      middlewareLogger.error('Failed to get known products', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve known products'
      });
    }
  });

  // Get product cache statistics
  fastify.get('/api/products/cache/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = productService.getCacheStats();

      return reply.send({
        success: true,
        data: stats,
        message: 'Cache statistics retrieved successfully'
      });
    } catch (error) {
      middlewareLogger.error('Failed to get cache stats', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to retrieve cache statistics'
      });
    }
  });

  // Clear product cache
  fastify.delete('/api/products/cache', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      productService.clearCache();

      return reply.send({
        success: true,
        message: 'Product cache cleared successfully'
      });
    } catch (error) {
      middlewareLogger.error('Failed to clear cache', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: 'Failed to clear cache'
      });
    }
  });
} 