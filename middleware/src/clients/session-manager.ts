import { CookieJar } from 'tough-cookie';
import { config } from '../utils/config.js';
import { sessionLogger } from '../utils/logger.js';

export interface SessionData {
  sessionId?: string;
  userId?: string;
  email?: string;
  isAuthenticated: boolean;
  lastActivity: Date;
  expiresAt: Date;
}

export class SessionManager {
  private cookieJar: CookieJar;
  private sessionData: SessionData;
  private sessionTimeout: number;

  constructor() {
    this.cookieJar = new CookieJar();
    this.sessionTimeout = config.getNumber('SESSION_TIMEOUT_MINUTES') * 60 * 1000; // Convert to milliseconds
    
    this.sessionData = {
      isAuthenticated: false,
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + this.sessionTimeout),
    };

    sessionLogger.info('Session manager initialized', {
      sessionTimeout: this.sessionTimeout,
    });
  }

  /**
   * Get the cookie jar for HTTP requests
   */
  getCookieJar(): CookieJar {
    return this.cookieJar;
  }

  /**
   * Get current session data
   */
  getSessionData(): SessionData {
    return { ...this.sessionData };
  }

  /**
   * Check if session is valid and not expired
   */
  isSessionValid(): boolean {
    const now = new Date();
    const isValid = this.sessionData.isAuthenticated && 
                   now < this.sessionData.expiresAt;

    if (!isValid && this.sessionData.isAuthenticated) {
      sessionLogger.warn('Session expired', {
        expiresAt: this.sessionData.expiresAt,
        now,
      });
      this.clearSession();
    }

    return isValid;
  }

  /**
   * Update session activity and extend expiration
   */
  updateActivity(): void {
    const now = new Date();
    this.sessionData.lastActivity = now;
    this.sessionData.expiresAt = new Date(now.getTime() + this.sessionTimeout);

    sessionLogger.debug('Session activity updated', {
      lastActivity: this.sessionData.lastActivity,
      expiresAt: this.sessionData.expiresAt,
    });
  }

  /**
   * Set session as authenticated
   */
  setAuthenticated(sessionId: string, userId?: string, email?: string): void {
    const now = new Date();
    
    this.sessionData = {
      sessionId,
      userId,
      email,
      isAuthenticated: true,
      lastActivity: now,
      expiresAt: new Date(now.getTime() + this.sessionTimeout),
    };

    sessionLogger.info('Session authenticated', {
      sessionId: sessionId.substring(0, 8) + '...',
      userId,
      email: email ? email.replace(/(.{2}).*(@.*)/, '$1***$2') : undefined,
    });
  }

  /**
   * Clear session data
   */
  clearSession(): void {
    const wasAuthenticated = this.sessionData.isAuthenticated;
    
    this.sessionData = {
      isAuthenticated: false,
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + this.sessionTimeout),
    };

    // Clear cookies
    this.cookieJar = new CookieJar();

    if (wasAuthenticated) {
      sessionLogger.info('Session cleared');
    }
  }

  /**
   * Get cookies as string for HTTP headers
   */
  async getCookieString(url: string): Promise<string> {
    try {
      return await this.cookieJar.getCookieString(url);
    } catch (error) {
      sessionLogger.error('Failed to get cookie string', { error, url });
      return '';
    }
  }

  /**
   * Set cookies from HTTP response
   */
  async setCookiesFromResponse(url: string, cookies: string[]): Promise<void> {
    try {
      for (const cookie of cookies) {
        await this.cookieJar.setCookie(cookie, url);
      }
      sessionLogger.debug('Cookies set from response', { 
        url, 
        cookieCount: cookies.length 
      });
    } catch (error) {
      sessionLogger.error('Failed to set cookies from response', { 
        error, 
        url, 
        cookies 
      });
    }
  }

  /**
   * Get session info for logging/debugging
   */
  getSessionInfo(): object {
    const { sessionId, userId, email, ...rest } = this.sessionData;
    return {
      ...rest,
      sessionId: sessionId ? sessionId.substring(0, 8) + '...' : undefined,
      userId,
      email: email ? email.replace(/(.{2}).*(@.*)/, '$1***$2') : undefined,
    };
  }

  /**
   * Check if session needs renewal (close to expiration)
   */
  needsRenewal(): boolean {
    if (!this.sessionData.isAuthenticated) {
      return false;
    }

    const now = new Date();
    const timeUntilExpiry = this.sessionData.expiresAt.getTime() - now.getTime();
    const renewalThreshold = this.sessionTimeout * 0.2; // Renew when 20% time left

    return timeUntilExpiry < renewalThreshold;
  }
} 