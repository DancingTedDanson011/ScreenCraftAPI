/**
 * Security Audit Logger Service
 * H-16: Centralized security event logging for monitoring and alerting
 *
 * Logs security-relevant events such as:
 * - Authentication success/failure
 * - Password changes
 * - API key creation/revocation
 * - SSRF blocking events
 * - Rate limit triggers
 * - Suspicious activity patterns
 */

import { FastifyBaseLogger } from 'fastify';
import { prisma } from '../../lib/db.js';
import { anonymizeIp, maskEmail } from '../../utils/pii-sanitizer.js';

/**
 * Security event types for classification
 */
export enum SecurityEventType {
  // Authentication Events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  ADMIN_LOGIN_SUCCESS = 'ADMIN_LOGIN_SUCCESS',
  ADMIN_LOGIN_FAILED = 'ADMIN_LOGIN_FAILED',

  // Password Events
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',

  // API Key Events
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  API_KEY_INVALID = 'API_KEY_INVALID',

  // Security Blocks
  SSRF_BLOCKED = 'SSRF_BLOCKED',
  RATE_LIMITED = 'RATE_LIMITED',
  CSRF_BLOCKED = 'CSRF_BLOCKED',
  XSS_ATTEMPT = 'XSS_ATTEMPT',

  // Account Events
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  ACCOUNT_BANNED = 'ACCOUNT_BANNED',
  TIER_CHANGED = 'TIER_CHANGED',

  // Webhook Events
  WEBHOOK_CREATED = 'WEBHOOK_CREATED',
  WEBHOOK_DELETED = 'WEBHOOK_DELETED',

  // OAuth Events
  OAUTH_STATE_INVALID = 'OAUTH_STATE_INVALID',
  OAUTH_LINKED = 'OAUTH_LINKED',
}

/**
 * Severity levels for security events
 */
export enum SecuritySeverity {
  INFO = 'INFO',       // Normal events (login success, password change)
  WARNING = 'WARNING', // Suspicious but not necessarily malicious
  HIGH = 'HIGH',       // Likely attack or significant security event
  CRITICAL = 'CRITICAL', // Immediate attention required
}

/**
 * Security event context
 */
export interface SecurityEventContext {
  ipAddress?: string;
  userAgent?: string;
  userId?: string;
  accountId?: string;
  email?: string;
  apiKeyId?: string;
  requestId?: string;
  url?: string;
  additionalInfo?: Record<string, unknown>;
}

/**
 * Security Logger Service
 */
class SecurityLoggerService {
  private logger?: FastifyBaseLogger;

  /**
   * Initialize with Fastify logger (optional)
   */
  setLogger(logger: FastifyBaseLogger): void {
    this.logger = logger;
  }

  /**
   * Log a security event
   */
  async log(
    eventType: SecurityEventType,
    severity: SecuritySeverity,
    message: string,
    context: SecurityEventContext = {}
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const eventData = {
      timestamp,
      eventType,
      severity,
      message,
      ...context,
    };

    // Log to structured logger (Pino/Fastify)
    if (this.logger) {
      switch (severity) {
        case SecuritySeverity.CRITICAL:
          this.logger.fatal({ security: eventData }, `[SECURITY] ${message}`);
          break;
        case SecuritySeverity.HIGH:
          this.logger.error({ security: eventData }, `[SECURITY] ${message}`);
          break;
        case SecuritySeverity.WARNING:
          this.logger.warn({ security: eventData }, `[SECURITY] ${message}`);
          break;
        default:
          this.logger.info({ security: eventData }, `[SECURITY] ${message}`);
      }
    } else {
      // Fallback to console
      const logMessage = `[SECURITY][${severity}][${eventType}] ${message}`;
      if (severity === SecuritySeverity.CRITICAL || severity === SecuritySeverity.HIGH) {
        console.error(logMessage, context);
      } else if (severity === SecuritySeverity.WARNING) {
        console.warn(logMessage, context);
      } else {
        console.log(logMessage, context);
      }
    }

    // Also persist to audit log table for historical analysis
    // M-14/L-03: Anonymize IPs and mask PII before storing in audit logs
    try {
      const anonymizedIp = anonymizeIp(context.ipAddress);
      const maskedContextEmail = context.email ? maskEmail(context.email) : undefined;

      await prisma.auditLog.create({
        data: {
          action: eventType,
          accountId: context.accountId || null,
          targetType: 'security',
          targetId: context.userId || context.apiKeyId || null,
          details: {
            severity,
            message,
            ipAddress: anonymizedIp,
            userAgent: context.userAgent,
            email: maskedContextEmail,
            url: context.url,
            requestId: context.requestId,
            ...context.additionalInfo,
          },
          ipAddress: anonymizedIp,
        },
      });
    } catch (error) {
      // Don't let audit log failures break the application
      console.error('[SECURITY] Failed to persist audit log:', error);
    }
  }

  // ============================================
  // Convenience Methods for Common Events
  // ============================================

  async loginSuccess(context: SecurityEventContext): Promise<void> {
    await this.log(
      SecurityEventType.LOGIN_SUCCESS,
      SecuritySeverity.INFO,
      `Successful login for ${context.email || 'unknown'}`,
      context
    );
  }

  async loginFailed(context: SecurityEventContext): Promise<void> {
    await this.log(
      SecurityEventType.LOGIN_FAILED,
      SecuritySeverity.WARNING,
      `Failed login attempt for ${context.email || 'unknown'}`,
      context
    );
  }

  async adminLoginSuccess(context: SecurityEventContext): Promise<void> {
    await this.log(
      SecurityEventType.ADMIN_LOGIN_SUCCESS,
      SecuritySeverity.INFO,
      `Admin login successful for ${context.email}`,
      context
    );
  }

  async adminLoginFailed(context: SecurityEventContext): Promise<void> {
    await this.log(
      SecurityEventType.ADMIN_LOGIN_FAILED,
      SecuritySeverity.HIGH,
      `Admin login failed for ${context.email || 'unknown'}`,
      context
    );
  }

  async passwordChanged(context: SecurityEventContext): Promise<void> {
    await this.log(
      SecurityEventType.PASSWORD_CHANGED,
      SecuritySeverity.INFO,
      `Password changed for user ${context.userId || context.email}`,
      context
    );
  }

  async apiKeyCreated(context: SecurityEventContext): Promise<void> {
    await this.log(
      SecurityEventType.API_KEY_CREATED,
      SecuritySeverity.INFO,
      `API key created for account ${context.accountId}`,
      context
    );
  }

  async apiKeyRevoked(context: SecurityEventContext): Promise<void> {
    await this.log(
      SecurityEventType.API_KEY_REVOKED,
      SecuritySeverity.INFO,
      `API key ${context.apiKeyId} revoked for account ${context.accountId}`,
      context
    );
  }

  async ssrfBlocked(url: string, context: SecurityEventContext): Promise<void> {
    await this.log(
      SecurityEventType.SSRF_BLOCKED,
      SecuritySeverity.HIGH,
      `SSRF attempt blocked: ${url}`,
      { ...context, url }
    );
  }

  async rateLimited(context: SecurityEventContext): Promise<void> {
    await this.log(
      SecurityEventType.RATE_LIMITED,
      SecuritySeverity.WARNING,
      `Rate limit triggered for ${context.ipAddress || 'unknown IP'}`,
      context
    );
  }

  async csrfBlocked(context: SecurityEventContext): Promise<void> {
    await this.log(
      SecurityEventType.CSRF_BLOCKED,
      SecuritySeverity.HIGH,
      `CSRF validation failed for request ${context.requestId}`,
      context
    );
  }

  async oauthStateInvalid(context: SecurityEventContext): Promise<void> {
    await this.log(
      SecurityEventType.OAUTH_STATE_INVALID,
      SecuritySeverity.WARNING,
      `Invalid OAuth state parameter from ${context.ipAddress}`,
      context
    );
  }

  async accountBanned(context: SecurityEventContext): Promise<void> {
    await this.log(
      SecurityEventType.ACCOUNT_BANNED,
      SecuritySeverity.WARNING,
      `Account ${context.accountId} banned`,
      context
    );
  }
}

// Export singleton instance
export const securityLogger = new SecurityLoggerService();
