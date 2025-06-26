import { logger } from '../utils/logger.js';
import { RohlikClient } from '../clients/rohlik-client.js';
import { SessionManager } from '../clients/session-manager.js';
import * as cheerio from 'cheerio';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  email?: string;
  userId?: string;
  sessionId?: string;
  loginTime?: Date;
}

export interface UserProfile {
  email: string;
  name?: string;
  userId: string;
  accountType?: string;
  deliveryAddress?: string;
}

class AuthService {
  private authStatus: AuthStatus = { isAuthenticated: false };
  private readonly LOGIN_URL = '/prihlaseni';
  private readonly LOGOUT_URL = '/odhlaseni';
  private readonly PROFILE_URL = '/muj-ucet';
  private rohlikClient: RohlikClient;
  private sessionManager: SessionManager;

  constructor() {
    this.rohlikClient = new RohlikClient();
    this.sessionManager = this.rohlikClient.getSessionManager();
  }

  /**
   * Authenticate user with Rohlik.cz
   */
  async login(credentials: LoginCredentials): Promise<AuthStatus> {
    try {
      logger.info('Starting authentication process', {
        component: 'AUTH_SERVICE',
        email: credentials.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email for security
      });

      // First, get the login page to extract CSRF token and form data
      const loginPageResponse = await this.rohlikClient.get(this.LOGIN_URL);
      const $ = cheerio.load(loginPageResponse.data);

      // Extract CSRF token and other form data
      const csrfToken = $('input[name="_token"]').val() as string;
      const formAction = $('form[action*="prihlaseni"]').attr('action') || this.LOGIN_URL;

      if (!csrfToken) {
        throw new Error('Could not extract CSRF token from login page');
      }

      logger.info('Login form data extracted', {
        component: 'AUTH_SERVICE',
        hasToken: !!csrfToken,
        formAction,
      });

      // Prepare login data
      const loginData = new URLSearchParams({
        email: credentials.email,
        password: credentials.password,
        _token: csrfToken,
        remember: '1', // Remember login
      });

      // Submit login form
      const loginResponse = await this.rohlikClient.post(formAction, loginData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': `https://www.rohlik.cz${this.LOGIN_URL}`,
        },
        maxRedirects: 0, // Handle redirects manually to check for success
        validateStatus: (status) => status < 400, // Accept redirects as success
      });

      // Check if login was successful by looking at response
      const isLoginSuccessful = this.checkLoginSuccess(loginResponse);

      if (isLoginSuccessful) {
        // Extract user information from the response or make additional request
        const userProfile = await this.extractUserProfile();
        
        this.authStatus = {
          isAuthenticated: true,
          email: credentials.email,
          userId: userProfile?.userId,
          sessionId: this.sessionManager.getSessionData().sessionId,
          loginTime: new Date(),
        };

        logger.info('Authentication successful', {
          component: 'AUTH_SERVICE',
          email: credentials.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
          userId: userProfile?.userId,
        });

        return this.authStatus;
      } else {
        throw new Error('Login failed - invalid credentials or authentication error');
      }

    } catch (error) {
      logger.error('Authentication failed', {
        component: 'AUTH_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
        email: credentials.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      });

      this.authStatus = { isAuthenticated: false };
      throw error;
    }
  }

  /**
   * Logout user and clear session
   */
  async logout(): Promise<void> {
    try {
      logger.info('Starting logout process', {
        component: 'AUTH_SERVICE',
        wasAuthenticated: this.authStatus.isAuthenticated,
      });

      if (this.authStatus.isAuthenticated) {
        // Make logout request to Rohlik.cz
        await this.rohlikClient.get(this.LOGOUT_URL);
      }

      // Clear local auth state
      this.authStatus = { isAuthenticated: false };
      
      // Clear session cookies
      this.sessionManager.clearSession();

      logger.info('Logout completed successfully', {
        component: 'AUTH_SERVICE',
      });

    } catch (error) {
      logger.error('Logout failed', {
        component: 'AUTH_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Clear local state even if remote logout failed
      this.authStatus = { isAuthenticated: false };
      this.sessionManager.clearSession();
    }
  }

  /**
   * Get current authentication status
   */
  getAuthStatus(): AuthStatus {
    return { ...this.authStatus };
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean {
    return this.authStatus.isAuthenticated;
  }

  /**
   * Get user profile information
   */
  async getUserProfile(): Promise<UserProfile | null> {
    if (!this.isAuthenticated()) {
      return null;
    }

    try {
      return await this.extractUserProfile();
    } catch (error) {
      logger.error('Failed to get user profile', {
        component: 'AUTH_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Validate current session by making a test request
   */
  async validateSession(): Promise<boolean> {
    try {
      if (!this.authStatus.isAuthenticated) {
        return false;
      }

      // Try to access a protected page to validate session
      const response = await this.rohlikClient.get(this.PROFILE_URL);
      const $ = cheerio.load(response.data);

      // Check if we're still logged in (look for login form vs user content)
      const hasLoginForm = $('form[action*="prihlaseni"]').length > 0;
      const hasUserContent = $('.user-info, .account-info, [data-user]').length > 0;

      const isValid = !hasLoginForm && (hasUserContent || response.status === 200);

      if (!isValid) {
        logger.info('Session validation failed - user appears to be logged out', {
          component: 'AUTH_SERVICE',
        });
        this.authStatus = { isAuthenticated: false };
      }

      return isValid;

    } catch (error) {
      logger.error('Session validation error', {
        component: 'AUTH_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      this.authStatus = { isAuthenticated: false };
      return false;
    }
  }

  /**
   * Check if login response indicates success
   */
  private checkLoginSuccess(response: any): boolean {
    // Login success is typically indicated by:
    // 1. Redirect to home page or account page (status 302/301)
    // 2. Response doesn't contain login form errors
    // 3. Set-Cookie headers with session cookies

    const isRedirect = response.status >= 300 && response.status < 400;
    const hasSessionCookies = response.headers['set-cookie']?.some((cookie: string) => 
      cookie.includes('session') || cookie.includes('auth') || cookie.includes('remember')
    );

    // Check if redirected away from login page
    const location = response.headers.location;
    const redirectedFromLogin = location && !location.includes('prihlaseni');

    return isRedirect && (hasSessionCookies || redirectedFromLogin);
  }

  /**
   * Extract user profile information from authenticated pages
   */
  private async extractUserProfile(): Promise<UserProfile | null> {
    try {
      const response = await this.rohlikClient.get(this.PROFILE_URL);
      const $ = cheerio.load(response.data);

      // Extract user information from the profile page
      const email = $('[data-email], .user-email, input[name="email"]').val() as string || 
                   $('input[type="email"]').val() as string ||
                   this.authStatus.email;

      const name = $('[data-name], .user-name, .account-name').text().trim() ||
                  $('input[name="name"], input[name="first_name"]').val() as string;

      const userId = $('[data-user-id], [data-customer-id]').attr('data-user-id') ||
                    $('[data-user-id], [data-customer-id]').attr('data-customer-id') ||
                    Math.random().toString(36).substr(2, 9); // Fallback ID

      const accountType = $('.account-type, [data-account-type]').text().trim() || 'standard';

      const deliveryAddress = $('.delivery-address, .current-address').text().trim();

      return {
        email: email || this.authStatus.email || '',
        name: name || undefined,
        userId,
        accountType: accountType || undefined,
        deliveryAddress: deliveryAddress || undefined,
      };

    } catch (error) {
      logger.error('Failed to extract user profile', {
        component: 'AUTH_SERVICE',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }
}

// Export singleton instance
export const authService = new AuthService(); 