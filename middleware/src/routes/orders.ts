import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger.js';
import { orderService, CheckoutRequest } from '../services/order-service.js';

interface CheckoutValidationRequest {
  // No body needed for validation
}

interface CheckoutSubmissionRequest {
  Body: CheckoutRequest;
}

interface GetOrderRequest {
  Params: {
    orderId: string;
  };
}

interface CancelOrderRequest {
  Params: {
    orderId: string;
  };
}

interface TrackOrderRequest {
  Params: {
    orderId: string;
  };
}

export async function orderRoutes(fastify: FastifyInstance) {
  // Validate checkout requirements
  fastify.get('/api/orders/checkout/validate', {
    schema: {
      tags: ['Orders'],
      summary: 'Validate checkout requirements',
      description: 'Check if all requirements are met for checkout (cart, address, etc.)',
      response: {
        200: {
          type: 'object',
          properties: {
            isValid: { type: 'boolean' },
            errors: { type: 'array', items: { type: 'string' } },
            warnings: { type: 'array', items: { type: 'string' } },
            estimatedTotal: { type: 'number' },
            deliveryFee: { type: 'number' },
            availablePaymentMethods: { type: 'array', items: { type: 'string' } },
            requiredDeliverySlot: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Checkout validation request received', {
        component: 'ORDER_ROUTES',
      });

      const validation = await orderService.validateCheckout();

      reply.status(200).send(validation);

    } catch (error) {
      logger.error('Failed to validate checkout', {
        component: 'ORDER_ROUTES',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reply.status(500).send({
        isValid: false,
        errors: ['Internal server error'],
        warnings: [],
        estimatedTotal: 0,
        deliveryFee: 0,
        availablePaymentMethods: [],
        requiredDeliverySlot: true,
      });
    }
  });

  // Complete checkout
  fastify.post<CheckoutSubmissionRequest>('/api/orders/checkout', {
    schema: {
      tags: ['Orders'],
      summary: 'Complete checkout',
      description: 'Submit order and complete checkout process',
      body: {
        type: 'object',
        required: ['paymentMethod'],
        properties: {
          deliverySlotId: { 
            type: 'string', 
            description: 'ID of the selected delivery slot (optional)' 
          },
          paymentMethod: { 
            type: 'string', 
            description: 'Payment method (card, cash, bank_transfer)' 
          },
          specialInstructions: { 
            type: 'string', 
            description: 'Special delivery instructions (optional)' 
          },
          confirmInventory: { 
            type: 'boolean', 
            description: 'Confirm inventory availability before order (optional)' 
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            order: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string' },
                orderNumber: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                total: { type: 'number' },
                deliveryFee: { type: 'number' },
                subtotal: { type: 'number' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      productId: { type: 'string' },
                      productName: { type: 'string' },
                      quantity: { type: 'number' },
                      unitPrice: { type: 'number' },
                      totalPrice: { type: 'number' },
                    },
                  },
                },
              },
            },
            errors: { type: 'array', items: { type: 'string' } },
            confirmationUrl: { type: 'string' },
            paymentUrl: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<CheckoutSubmissionRequest>, reply: FastifyReply) => {
    try {
      logger.info('Checkout request received', {
        component: 'ORDER_ROUTES',
        paymentMethod: request.body.paymentMethod,
        deliverySlotId: request.body.deliverySlotId,
      });

      const result = await orderService.checkout(request.body);

      const statusCode = result.success ? 200 : 400;
      reply.status(statusCode).send(result);

    } catch (error) {
      logger.error('Checkout failed', {
        component: 'ORDER_ROUTES',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reply.status(500).send({
        success: false,
        order: null,
        errors: ['Internal server error'],
      });
    }
  });

  // Get order history
  fastify.get('/api/orders', {
    schema: {
      tags: ['Orders'],
      summary: 'Get order history',
      description: 'Get list of user\'s orders',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            orders: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  orderNumber: { type: 'string' },
                  status: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                  total: { type: 'number' },
                  deliveryFee: { type: 'number' },
                  subtotal: { type: 'number' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        productId: { type: 'string' },
                        productName: { type: 'string' },
                        quantity: { type: 'number' },
                        unitPrice: { type: 'number' },
                        totalPrice: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Order history request received', {
        component: 'ORDER_ROUTES',
      });

      const orders = await orderService.getOrderHistory();

      reply.status(200).send({
        success: true,
        orders,
      });

    } catch (error) {
      logger.error('Failed to get order history', {
        component: 'ORDER_ROUTES',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reply.status(500).send({
        success: false,
        orders: [],
      });
    }
  });

  // Get specific order
  fastify.get<GetOrderRequest>('/api/orders/:orderId', {
    schema: {
      tags: ['Orders'],
      summary: 'Get order details',
      description: 'Get detailed information about a specific order',
      params: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string', description: 'Order ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            order: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string' },
                orderNumber: { type: 'string' },
                status: { type: 'string' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
                total: { type: 'number' },
                deliveryFee: { type: 'number' },
                subtotal: { type: 'number' },
                deliveryAddress: {
                  type: 'object',
                  properties: {
                    street: { type: 'string' },
                    houseNumber: { type: 'string' },
                    city: { type: 'string' },
                    postalCode: { type: 'string' },
                    country: { type: 'string' },
                  },
                },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      productId: { type: 'string' },
                      productName: { type: 'string' },
                      quantity: { type: 'number' },
                      unitPrice: { type: 'number' },
                      totalPrice: { type: 'number' },
                      imageUrl: { type: 'string' },
                    },
                  },
                },
                paymentMethod: { type: 'string' },
                specialInstructions: { type: 'string' },
                trackingUrl: { type: 'string' },
                estimatedDelivery: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest<GetOrderRequest>, reply: FastifyReply) => {
    try {
      logger.info('Get order request received', {
        component: 'ORDER_ROUTES',
        orderId: request.params.orderId,
      });

      const order = await orderService.getOrder(request.params.orderId);

      if (!order) {
        reply.status(404).send({
          success: false,
          order: null,
          error: 'Order not found',
        });
        return;
      }

      reply.status(200).send({
        success: true,
        order,
      });

    } catch (error) {
      logger.error('Failed to get order', {
        component: 'ORDER_ROUTES',
        orderId: request.params.orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reply.status(500).send({
        success: false,
        order: null,
      });
    }
  });

  // Cancel order
  fastify.post<CancelOrderRequest>('/api/orders/:orderId/cancel', {
    schema: {
      tags: ['Orders'],
      summary: 'Cancel order',
      description: 'Cancel a specific order if possible',
      params: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string', description: 'Order ID to cancel' },
        },
      },
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
  }, async (request: FastifyRequest<CancelOrderRequest>, reply: FastifyReply) => {
    try {
      logger.info('Cancel order request received', {
        component: 'ORDER_ROUTES',
        orderId: request.params.orderId,
      });

      const success = await orderService.cancelOrder(request.params.orderId);

      reply.status(200).send({
        success,
        message: success ? 'Order cancelled successfully' : 'Failed to cancel order',
      });

    } catch (error) {
      logger.error('Failed to cancel order', {
        component: 'ORDER_ROUTES',
        orderId: request.params.orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reply.status(500).send({
        success: false,
        message: 'Internal server error',
      });
    }
  });

  // Track order
  fastify.get<TrackOrderRequest>('/api/orders/:orderId/track', {
    schema: {
      tags: ['Orders'],
      summary: 'Track order',
      description: 'Get current tracking status and details for an order',
      params: {
        type: 'object',
        required: ['orderId'],
        properties: {
          orderId: { type: 'string', description: 'Order ID to track' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            order: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string' },
                orderNumber: { type: 'string' },
                status: { type: 'string' },
                updatedAt: { type: 'string', format: 'date-time' },
                estimatedDelivery: { type: 'string', format: 'date-time' },
                trackingUrl: { type: 'string' },
                deliveryAddress: {
                  type: 'object',
                  properties: {
                    street: { type: 'string' },
                    city: { type: 'string' },
                    postalCode: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest<TrackOrderRequest>, reply: FastifyReply) => {
    try {
      logger.info('Track order request received', {
        component: 'ORDER_ROUTES',
        orderId: request.params.orderId,
      });

      const order = await orderService.trackOrder(request.params.orderId);

      if (!order) {
        reply.status(404).send({
          success: false,
          order: null,
          error: 'Order not found',
        });
        return;
      }

      reply.status(200).send({
        success: true,
        order,
      });

    } catch (error) {
      logger.error('Failed to track order', {
        component: 'ORDER_ROUTES',
        orderId: request.params.orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reply.status(500).send({
        success: false,
        order: null,
      });
    }
  });

  // Calculate order total (for cart preview)
  fastify.get('/api/orders/calculate-total', {
    schema: {
      tags: ['Orders'],
      summary: 'Calculate order total',
      description: 'Calculate total cost including delivery fee for current cart',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            subtotal: { type: 'number' },
            deliveryFee: { type: 'number' },
            total: { type: 'number' },
            currency: { type: 'string' },
            minOrderValue: { type: 'number' },
            canCheckout: { type: 'boolean' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Calculate order total request received', {
        component: 'ORDER_ROUTES',
      });

      const validation = await orderService.validateCheckout();

      reply.status(200).send({
        success: true,
        subtotal: validation.estimatedTotal - validation.deliveryFee,
        deliveryFee: validation.deliveryFee,
        total: validation.estimatedTotal,
        currency: 'CZK',
        minOrderValue: 500, // Czech minimum
        canCheckout: validation.isValid,
      });

    } catch (error) {
      logger.error('Failed to calculate order total', {
        component: 'ORDER_ROUTES',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reply.status(500).send({
        success: false,
        subtotal: 0,
        deliveryFee: 0,
        total: 0,
        currency: 'CZK',
        minOrderValue: 500,
        canCheckout: false,
      });
    }
  });
} 