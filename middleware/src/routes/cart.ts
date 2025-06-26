import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { cartService, type AddToCartRequest, type UpdateCartItemRequest, type CartSummary } from '../services/cart-service.js';
import { authService } from '../services/auth-service.js';
import { logger } from '../utils/logger.js';

export interface AddToCartRequestBody {
  Body: AddToCartRequest;
}

export interface UpdateCartRequestBody {
  Body: UpdateCartItemRequest;
}

export interface CartItemParams {
  Params: {
    productId: string;
  };
}

export interface CartResponse {
  success: boolean;
  cart: CartSummary;
  message: string;
}

export interface CartErrorResponse {
  success: boolean;
  error: string;
  message: string;
}

// Authentication middleware
async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!authService.isAuthenticated()) {
    return reply.code(401).send({
      success: false,
      error: 'Not authenticated',
      message: 'User must be logged in to access cart',
    });
  }

  // Validate session
  const isValid = await authService.validateSession();
  if (!isValid) {
    return reply.code(401).send({
      success: false,
      error: 'Session expired',
      message: 'Session has expired, please log in again',
    });
  }
}

export async function cartRoutes(fastify: FastifyInstance) {
  // Add authentication hook for all cart routes
  fastify.addHook('preHandler', requireAuth);

  // GET /api/cart - Get current cart contents
  fastify.get('/', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            cart: {
              type: 'object',
              properties: {
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      productId: { type: 'string' },
                      name: { type: 'string' },
                      price: { type: 'number' },
                      quantity: { type: 'number' },
                      totalPrice: { type: 'number' },
                      imageUrl: { type: 'string' },
                      unit: { type: 'string' },
                      availability: { type: 'string' },
                    },
                  },
                },
                totalItems: { type: 'number' },
                totalPrice: { type: 'number' },
                deliveryFee: { type: 'number' },
                finalTotal: { type: 'number' },
                currency: { type: 'string' },
                lastUpdated: { type: 'string' },
              },
            },
            message: { type: 'string' },
          },
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Cart request received', {
        component: 'CART_ROUTES',
      });

      const cart = await cartService.getCart();

      const response: CartResponse = {
        success: true,
        cart,
        message: 'Cart retrieved successfully',
      };

      reply.code(200).send(response);

    } catch (error) {
      logger.error('Failed to get cart', {
        component: 'CART_ROUTES',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cart',
        message: 'Could not retrieve cart contents',
      });
    }
  });

  // POST /api/cart/items - Add item to cart
  fastify.post<AddToCartRequestBody>('/items', {
    schema: {
      body: {
        type: 'object',
        required: ['productId', 'quantity'],
        properties: {
          productId: { type: 'string', minLength: 1 },
          quantity: { type: 'number', minimum: 1, maximum: 100 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            cart: { type: 'object' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<AddToCartRequestBody>, reply: FastifyReply) => {
    try {
      logger.info('Add to cart request received', {
        component: 'CART_ROUTES',
        productId: request.body.productId,
        quantity: request.body.quantity,
      });

      const cart = await cartService.addToCart(request.body);

      const response: CartResponse = {
        success: true,
        cart,
        message: 'Product added to cart successfully',
      };

      reply.code(200).send(response);

    } catch (error) {
      logger.error('Failed to add product to cart', {
        component: 'CART_ROUTES',
        productId: request.body.productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      const errorMessage = error instanceof Error ? error.message : 'Failed to add product to cart';
      const isNotFound = errorMessage.includes('not found');

      reply.code(isNotFound ? 404 : 400).send({
        success: false,
        error: errorMessage,
        message: isNotFound ? 'Product not found' : 'Could not add product to cart',
      });
    }
  });

  // PUT /api/cart/items/:productId - Update item quantity
  fastify.put<UpdateCartRequestBody & CartItemParams>('/items/:productId', {
    schema: {
      params: {
        type: 'object',
        required: ['productId'],
        properties: {
          productId: { type: 'string', minLength: 1 },
        },
      },
      body: {
        type: 'object',
        required: ['quantity'],
        properties: {
          quantity: { type: 'number', minimum: 0, maximum: 100 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            cart: { type: 'object' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<UpdateCartRequestBody & CartItemParams>, reply: FastifyReply) => {
    try {
      const updateRequest: UpdateCartItemRequest = {
        productId: request.params.productId,
        quantity: request.body.quantity,
      };

      logger.info('Update cart item request received', {
        component: 'CART_ROUTES',
        productId: updateRequest.productId,
        quantity: updateRequest.quantity,
      });

      const cart = await cartService.updateCartItem(updateRequest);

      const response: CartResponse = {
        success: true,
        cart,
        message: updateRequest.quantity === 0 ? 'Product removed from cart' : 'Cart item updated successfully',
      };

      reply.code(200).send(response);

    } catch (error) {
      logger.error('Failed to update cart item', {
        component: 'CART_ROUTES',
        productId: request.params.productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update cart item',
        message: 'Could not update cart item',
      });
    }
  });

  // DELETE /api/cart/items/:productId - Remove item from cart
  fastify.delete<CartItemParams>('/items/:productId', {
    schema: {
      params: {
        type: 'object',
        required: ['productId'],
        properties: {
          productId: { type: 'string', minLength: 1 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            cart: { type: 'object' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<CartItemParams>, reply: FastifyReply) => {
    try {
      logger.info('Remove from cart request received', {
        component: 'CART_ROUTES',
        productId: request.params.productId,
      });

      const cart = await cartService.removeFromCart(request.params.productId);

      const response: CartResponse = {
        success: true,
        cart,
        message: 'Product removed from cart successfully',
      };

      reply.code(200).send(response);

    } catch (error) {
      logger.error('Failed to remove product from cart', {
        component: 'CART_ROUTES',
        productId: request.params.productId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove product from cart',
        message: 'Could not remove product from cart',
      });
    }
  });

  // DELETE /api/cart - Clear entire cart
  fastify.delete('/', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            cart: { type: 'object' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Clear cart request received', {
        component: 'CART_ROUTES',
      });

      const cart = await cartService.clearCart();

      const response: CartResponse = {
        success: true,
        cart,
        message: 'Cart cleared successfully',
      };

      reply.code(200).send(response);

    } catch (error) {
      logger.error('Failed to clear cart', {
        component: 'CART_ROUTES',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear cart',
        message: 'Could not clear cart',
      });
    }
  });

  // GET /api/cart/summary - Get cart summary (lightweight version)
  fastify.get('/summary', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            summary: {
              type: 'object',
              properties: {
                totalItems: { type: 'number' },
                totalPrice: { type: 'number' },
                finalTotal: { type: 'number' },
                currency: { type: 'string' },
                itemCount: { type: 'number' },
              },
            },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Cart summary request received', {
        component: 'CART_ROUTES',
      });

      // Try to get cached cart first for performance
      let cart = cartService.getCachedCart();
      if (!cart) {
        cart = await cartService.getCart();
      }

      const summary = {
        totalItems: cart.totalItems,
        totalPrice: cart.totalPrice,
        finalTotal: cart.finalTotal,
        currency: cart.currency,
        itemCount: cart.items.length,
      };

      reply.code(200).send({
        success: true,
        summary,
        message: 'Cart summary retrieved successfully',
      });

    } catch (error) {
      logger.error('Failed to get cart summary', {
        component: 'CART_ROUTES',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cart summary',
        message: 'Could not retrieve cart summary',
      });
    }
  });

  // POST /api/cart/cache/clear - Clear cart cache (utility endpoint)
  fastify.post('/cache/clear', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Clear cart cache request received', {
        component: 'CART_ROUTES',
      });

      cartService.clearCartCache();

      reply.code(200).send({
        success: true,
        message: 'Cart cache cleared successfully',
      });

    } catch (error) {
      logger.error('Failed to clear cart cache', {
        component: 'CART_ROUTES',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear cart cache',
        message: 'Could not clear cart cache',
      });
    }
  });
} 