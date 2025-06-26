import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authService, type LoginCredentials } from '../services/auth-service.js';
import { logger } from '../utils/logger.js';

export interface LoginRequest {
  Body: LoginCredentials;
}

export interface AuthStatusResponse {
  success: boolean;
  authenticated: boolean;
  user?: {
    email?: string;
    userId?: string;
    loginTime?: string;
  };
  message: string;
}

export interface LoginResponse {
  success: boolean;
  authenticated: boolean;
  user: {
    email: string;
    userId?: string;
    sessionId?: string;
    loginTime: string;
  };
  message: string;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/login - Authenticate user
  fastify.post<LoginRequest>('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            authenticated: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                userId: { type: 'string' },
                sessionId: { type: 'string' },
                loginTime: { type: 'string' },
              },
            },
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
  }, async (request: FastifyRequest<LoginRequest>, reply: FastifyReply) => {
    try {
      logger.info('Login request received', {
        component: 'AUTH_ROUTES',
        email: request.body.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      });

      const authStatus = await authService.login(request.body);

      const response: LoginResponse = {
        success: true,
        authenticated: authStatus.isAuthenticated,
        user: {
          email: authStatus.email!,
          userId: authStatus.userId,
          sessionId: authStatus.sessionId,
          loginTime: authStatus.loginTime!.toISOString(),
        },
        message: 'Login successful',
      };

      reply.code(200).send(response);

    } catch (error) {
      logger.error('Login failed', {
        component: 'AUTH_ROUTES',
        error: error instanceof Error ? error.message : 'Unknown error',
        email: request.body.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      });

      const isCredentialError = error instanceof Error && 
        (error.message.includes('invalid credentials') || 
         error.message.includes('authentication error'));

      reply.code(isCredentialError ? 401 : 400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
        message: isCredentialError ? 'Invalid credentials' : 'Login failed',
      });
    }
  });

  // GET /api/auth/status - Get authentication status
  fastify.get('/status', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            authenticated: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                userId: { type: 'string' },
                loginTime: { type: 'string' },
              },
            },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      logger.info('Auth status request received', {
        component: 'AUTH_ROUTES',
      });

      const authStatus = authService.getAuthStatus();

      // Validate session if authenticated
      if (authStatus.isAuthenticated) {
        const isValid = await authService.validateSession();
        if (!isValid) {
          // Session expired, return unauthenticated status
          const response: AuthStatusResponse = {
            success: true,
            authenticated: false,
            message: 'Session expired',
          };
          return reply.code(200).send(response);
        }
      }

      const response: AuthStatusResponse = {
        success: true,
        authenticated: authStatus.isAuthenticated,
        user: authStatus.isAuthenticated ? {
          email: authStatus.email,
          userId: authStatus.userId,
          loginTime: authStatus.loginTime?.toISOString(),
        } : undefined,
        message: authStatus.isAuthenticated ? 'User is authenticated' : 'User is not authenticated',
      };

      reply.code(200).send(response);

    } catch (error) {
      logger.error('Auth status check failed', {
        component: 'AUTH_ROUTES',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Status check failed',
        message: 'Failed to check authentication status',
      });
    }
  });

  // POST /api/auth/logout - Logout user
  fastify.post('/logout', {
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
      logger.info('Logout request received', {
        component: 'AUTH_ROUTES',
      });

      await authService.logout();

      const response: LogoutResponse = {
        success: true,
        message: 'Logout successful',
      };

      reply.code(200).send(response);

    } catch (error) {
      logger.error('Logout failed', {
        component: 'AUTH_ROUTES',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Even if logout fails, we still return success since the goal is to end the session
      const response: LogoutResponse = {
        success: true,
        message: 'Logout completed (with warnings)',
      };

      reply.code(200).send(response);
    }
  });

  // GET /api/auth/profile - Get user profile
  fastify.get('/profile', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            user: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                name: { type: 'string' },
                userId: { type: 'string' },
                accountType: { type: 'string' },
                deliveryAddress: { type: 'string' },
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
      if (!authService.isAuthenticated()) {
        return reply.code(401).send({
          success: false,
          error: 'Not authenticated',
          message: 'User must be logged in to access profile',
        });
      }

      logger.info('Profile request received', {
        component: 'AUTH_ROUTES',
      });

      const userProfile = await authService.getUserProfile();

      if (!userProfile) {
        return reply.code(404).send({
          success: false,
          error: 'Profile not found',
          message: 'Could not retrieve user profile',
        });
      }

      reply.code(200).send({
        success: true,
        user: userProfile,
        message: 'Profile retrieved successfully',
      });

    } catch (error) {
      logger.error('Profile retrieval failed', {
        component: 'AUTH_ROUTES',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Profile retrieval failed',
        message: 'Failed to get user profile',
      });
    }
  });
} 