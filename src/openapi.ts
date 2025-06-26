// TODO: openapi3-ts does not export OpenAPIObject, InfoObject, or PathsObject directly. Use 'any' for now for type safety, or define your own types.
// import { OpenAPIObject, InfoObject, PathsObject } from 'openapi3-ts';

const info = {
  title: 'Rohlik OpenAPI Server',
  version: '1.0.0',
  description: 'OpenAPI-compliant REST API inspired by RohlikAPI and RohlikSdk.'
};

const components = {
  schemas: {
    Product: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        categoryId: { type: 'string' },
      },
      required: ['id', 'name'],
    },
    Category: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['id', 'name'],
    },
    Order: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/Product' },
        },
      },
      required: ['id', 'items'],
    },
    AuthResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        token: { type: 'string' },
      },
      required: ['success', 'token'],
    },
    RohlikovacResult: {
      type: 'object',
      properties: {
        result: { type: 'string' },
      },
      required: ['result'],
    },
  },
};

const paths = {
  '/products': {
    get: {
      summary: 'Get all products',
      responses: {
        '200': {
          description: 'List of products',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  products: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Product' },
                  },
                },
                required: ['products'],
              },
            },
          },
        },
      },
    },
  },
  '/categories': {
    get: {
      summary: 'Get all categories',
      responses: {
        '200': {
          description: 'List of categories',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  categories: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Category' },
                  },
                },
                required: ['categories'],
              },
            },
          },
        },
      },
    },
  },
  '/products/{categoryId}': {
    get: {
      summary: 'Get products by category',
      parameters: [
        {
          name: 'categoryId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        '200': {
          description: 'List of products in category',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  categoryId: { type: 'string' },
                  products: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Product' },
                  },
                },
                required: ['categoryId', 'products'],
              },
            },
          },
        },
      },
    },
  },
  '/search': {
    get: {
      summary: 'Search products',
      parameters: [
        {
          name: 'query',
          in: 'query',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        '200': {
          description: 'Search results',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  results: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Product' },
                  },
                },
                required: ['query', 'results'],
              },
            },
          },
        },
      },
    },
  },
  '/auth/login': {
    post: {
      summary: 'Authenticate user',
      responses: {
        '200': {
          description: 'Authentication successful',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AuthResponse' },
            },
          },
        },
      },
    },
  },
  '/orders/history': {
    get: {
      summary: 'Get user order history',
      responses: {
        '200': {
          description: 'Order history',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  orders: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Order' },
                  },
                },
                required: ['orders'],
              },
            },
          },
        },
      },
    },
  },
  '/rohlikovac': {
    post: {
      summary: 'Run Rohlikovac automation',
      responses: {
        '200': {
          description: 'Automation result',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RohlikovacResult' },
            },
          },
        },
      },
    },
  },
};

export const openapi: any = {
  openapi: '3.0.0',
  info,
  components,
  paths,
}; 