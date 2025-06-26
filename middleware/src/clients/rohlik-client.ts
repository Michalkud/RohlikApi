import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { config } from '../utils/config.js';
import { httpLogger } from '../utils/logger.js';
import { SessionManager } from './session-manager.js';
import type { RohlikApiResponse } from '../types/rohlik-api.js';

export interface RohlikClientOptions {
  baseURL?: string;
  timeout?: number;
  userAgent?: string;
}

export class RohlikClient {
  private axiosInstance: AxiosInstance;
  private sessionManager: SessionManager;
  private rateLimiter: RateLimiterMemory;
  private baseURL: string;

  constructor(options: RohlikClientOptions = {}) {
    this.baseURL = options.baseURL || config.get('ROHLIK_BASE_URL');
    this.sessionManager = new SessionManager();
    
    // Rate limiter: max 30 requests per minute, 500 per hour
    this.rateLimiter = new RateLimiterMemory({
      points: config.getNumber('RATE_LIMIT_REQUESTS_PER_MINUTE'),
      duration: 60, // per 60 seconds
    });

    // Create axios instance with default configuration
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: options.timeout || 30000,
      headers: {
        'User-Agent': options.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'cs-CZ,cs;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    this.setupInterceptors();
    
    httpLogger.info('Rohlik client initialized', {
      baseURL: this.baseURL,
      timeout: options.timeout || 30000,
    });
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Apply rate limiting
        try {
          await this.rateLimiter.consume('rohlik-client');
        } catch (rateLimitError) {
          httpLogger.warn('Rate limit exceeded, waiting...', { rateLimitError });
          throw new Error('Rate limit exceeded');
        }

        // Add cookies to request
        if (config.url) {
          const fullUrl = new URL(config.url, this.baseURL).toString();
          const cookieString = await this.sessionManager.getCookieString(fullUrl);
          if (cookieString) {
            config.headers = config.headers || {};
            config.headers['Cookie'] = cookieString;
          }
        }

        // Update session activity
        this.sessionManager.updateActivity();

        httpLogger.debug('HTTP request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: this.sanitizeHeaders(config.headers),
        });

        return config;
      },
      (error) => {
        httpLogger.error('Request interceptor error', { error });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      async (response) => {
        // Handle cookies from response
        const setCookieHeaders = response.headers['set-cookie'];
        if (setCookieHeaders && response.config.url) {
          const fullUrl = new URL(response.config.url, this.baseURL).toString();
          await this.sessionManager.setCookiesFromResponse(fullUrl, setCookieHeaders);
        }

        httpLogger.debug('HTTP response', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url,
          headers: this.sanitizeHeaders(response.headers),
        });

        return response;
      },
      (error: AxiosError) => {
        httpLogger.error('HTTP error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          message: error.message,
          data: error.response?.data,
        });

        return Promise.reject(error);
      }
    );
  }

  private sanitizeHeaders(headers: any): any {
    if (!headers) return {};
    
    const sanitized = { ...headers };
    
    // Remove sensitive headers from logs
    if (sanitized['Cookie']) {
      sanitized['Cookie'] = '[REDACTED]';
    }
    if (sanitized['Authorization']) {
      sanitized['Authorization'] = '[REDACTED]';
    }
    
    return sanitized;
  }

  /**
   * Get the session manager instance
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * Make a GET request to Rohlik.cz
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.get(url, config);
  }

  /**
   * Make a POST request to Rohlik.cz
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.post(url, data, config);
  }

  /**
   * Make a PUT request to Rohlik.cz
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.put(url, data, config);
  }

  /**
   * Make a DELETE request to Rohlik.cz
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.delete(url, config);
  }

  /**
   * Get the homepage to establish initial session
   */
  async getHomepage(): Promise<string> {
    try {
      const response = await this.get('/');
      httpLogger.info('Homepage loaded successfully');
      return response.data;
    } catch (error) {
      httpLogger.error('Failed to load homepage', { error });
      throw error;
    }
  }

  /**
   * Get product page by ID
   */
  async getProduct(productId: string): Promise<string> {
    try {
      const response = await this.get(`/${productId}`);
      httpLogger.info('Product page loaded', { productId });
      return response.data;
    } catch (error) {
      httpLogger.error('Failed to load product page', { error, productId });
      throw error;
    }
  }

  /**
   * Get category page
   */
  async getCategory(categoryPath: string): Promise<string> {
    try {
      const response = await this.get(`/${categoryPath}`);
      httpLogger.info('Category page loaded', { categoryPath });
      return response.data;
    } catch (error) {
      httpLogger.error('Failed to load category page', { error, categoryPath });
      throw error;
    }
  }

  /**
   * Get current session info
   */
  getSessionInfo(): object {
    return this.sessionManager.getSessionInfo();
  }

  /**
   * Check if client is authenticated
   */
  isAuthenticated(): boolean {
    return this.sessionManager.isSessionValid();
  }

  /**
   * Clear session and cookies
   */
  clearSession(): void {
    this.sessionManager.clearSession();
    httpLogger.info('Session cleared');
  }

  /**
   * Create a safe API response wrapper
   */
  createApiResponse<T>(success: boolean, data?: T, error?: string): RohlikApiResponse {
    return {
      success,
      data,
      error,
      message: success ? 'Request successful' : error || 'Request failed',
    };
  }
} 