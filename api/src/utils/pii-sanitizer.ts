/**
 * PII Sanitizer Utility
 * M-14 / L-03: Functions for anonymizing personally identifiable information
 *
 * GDPR Compliance:
 * - IP addresses are anonymized by truncating to subnet
 * - Emails are masked for display in logs
 * - Full PII deletion is handled by GDPR service
 */

import crypto from 'crypto';

/**
 * Anonymize an IPv4 address by zeroing the last octet
 * Example: 192.168.1.100 → 192.168.1.0
 *
 * This preserves approximate geographic information while
 * removing the ability to identify specific users.
 */
export function anonymizeIPv4(ip: string): string {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return ip; // Not a valid IPv4, return as-is
  }

  // Zero out the last octet
  parts[3] = '0';
  return parts.join('.');
}

/**
 * Anonymize an IPv6 address by zeroing the last 80 bits (interface identifier + part of subnet)
 * Example: 2001:db8:85a3::8a2e:370:7334 → 2001:db8:85a3::0:0:0
 */
export function anonymizeIPv6(ip: string): string {
  // Expand the IPv6 address to full form
  const parts = ip.split(':');

  // Handle :: expansion
  const emptyIndex = parts.indexOf('');
  if (emptyIndex !== -1) {
    const missing = 8 - parts.filter(p => p !== '').length;
    const expansion = Array(missing).fill('0000');
    parts.splice(emptyIndex, 1, ...expansion);
  }

  // Ensure we have 8 parts
  while (parts.length < 8) {
    parts.push('0000');
  }

  // Zero out the last 5 groups (80 bits)
  for (let i = 3; i < 8; i++) {
    parts[i] = '0000';
  }

  // Simplify back (remove leading zeros, collapse consecutive zeros)
  return parts.map(p => p.replace(/^0+/, '') || '0').join(':');
}

/**
 * Anonymize any IP address (auto-detects IPv4 vs IPv6)
 * M-14: IP addresses should be anonymized before storage for GDPR compliance
 */
export function anonymizeIp(ip: string | undefined | null): string | null {
  if (!ip) {
    return null;
  }

  // Check if IPv6
  if (ip.includes(':')) {
    return anonymizeIPv6(ip);
  }

  // IPv4
  return anonymizeIPv4(ip);
}

/**
 * Hash an IP address for correlation without storing the actual IP
 * Useful when you need to detect patterns (same user) but don't need the IP itself
 */
export function hashIp(ip: string, salt?: string): string {
  const toHash = salt ? `${ip}:${salt}` : ip;
  return crypto.createHash('sha256').update(toHash).digest('hex').substring(0, 16);
}

/**
 * Mask an email address for display in logs
 * Example: john.doe@example.com → j***e@example.com
 * L-03: PII should be masked in audit logs
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) {
    return '[no email]';
  }

  const [localPart, domain] = email.split('@');

  if (!domain) {
    return '***';
  }

  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }

  return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
}

/**
 * Mask a name for display in logs
 * Example: John Doe → J*** D**
 */
export function maskName(name: string | null | undefined): string {
  if (!name) {
    return '[no name]';
  }

  const parts = name.split(' ');
  return parts.map(part => {
    if (part.length <= 1) {
      return part;
    }
    return `${part[0]}${'*'.repeat(Math.min(part.length - 1, 3))}`;
  }).join(' ');
}

/**
 * Completely redact a value (for highly sensitive data)
 */
export function redact(value: unknown): string {
  return '[REDACTED]';
}

/**
 * Mask credit card number (show last 4 digits only)
 */
export function maskCreditCard(cardNumber: string | null | undefined): string {
  if (!cardNumber) {
    return '[no card]';
  }

  // Remove spaces and dashes
  const cleaned = cardNumber.replace(/[\s-]/g, '');

  if (cleaned.length < 4) {
    return '****';
  }

  return `****${cleaned.slice(-4)}`;
}

/**
 * Sanitize an object by masking/anonymizing PII fields
 * Useful for logging entire objects while protecting PII
 */
export function sanitizeForLogging<T extends Record<string, unknown>>(
  obj: T,
  options: {
    emailFields?: string[];
    ipFields?: string[];
    nameFields?: string[];
    redactFields?: string[];
  } = {}
): T {
  const {
    emailFields = ['email', 'userEmail', 'accountEmail'],
    ipFields = ['ip', 'ipAddress', 'clientIp', 'remoteAddress'],
    nameFields = ['name', 'userName', 'fullName'],
    redactFields = ['password', 'passwordHash', 'token', 'secret', 'apiKey'],
  } = options;

  const result = { ...obj };

  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string') {
      if (emailFields.includes(key)) {
        (result as Record<string, unknown>)[key] = maskEmail(value);
      } else if (ipFields.includes(key)) {
        (result as Record<string, unknown>)[key] = anonymizeIp(value);
      } else if (nameFields.includes(key)) {
        (result as Record<string, unknown>)[key] = maskName(value);
      } else if (redactFields.includes(key)) {
        (result as Record<string, unknown>)[key] = redact(value);
      }
    }
  }

  return result;
}
