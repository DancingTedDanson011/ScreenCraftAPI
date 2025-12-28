/**
 * HTML Sanitizer for PDF Templates
 * H-08: Prevent XSS attacks by sanitizing user-provided HTML content
 *
 * This sanitizer removes dangerous elements while preserving safe HTML
 * for PDF header/footer templates and HTML content.
 */

/**
 * Regex patterns for dangerous content
 */
const SCRIPT_TAG_PATTERN = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const STYLE_WITH_EXPRESSION_PATTERN = /expression\s*\(/gi;
const ON_EVENT_PATTERN = /\s+on\w+\s*=/gi;
const JAVASCRIPT_URL_PATTERN = /javascript\s*:/gi;
const DATA_URL_PATTERN = /data\s*:\s*text\/html/gi;
const VBSCRIPT_URL_PATTERN = /vbscript\s*:/gi;
const META_REFRESH_PATTERN = /<meta[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi;
const BASE_TAG_PATTERN = /<base[^>]*>/gi;
const OBJECT_TAG_PATTERN = /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi;
const EMBED_TAG_PATTERN = /<embed[^>]*>/gi;
const APPLET_TAG_PATTERN = /<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi;
const IFRAME_TAG_PATTERN = /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi;
const FRAME_TAG_PATTERN = /<frame[^>]*>/gi;
const FRAMESET_TAG_PATTERN = /<frameset\b[^<]*(?:(?!<\/frameset>)<[^<]*)*<\/frameset>/gi;
const FORM_TAG_PATTERN = /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi;
const INPUT_TAG_PATTERN = /<input[^>]*>/gi;
const LINK_IMPORT_PATTERN = /<link[^>]*rel\s*=\s*["']?import["']?[^>]*>/gi;

/**
 * Pattern to match and clean src/href attributes with dangerous protocols
 */
const DANGEROUS_ATTR_PATTERN =
  /(src|href|xlink:href|action|formaction|poster|data)\s*=\s*["']?\s*(javascript|vbscript|data:text\/html)[^"'\s>]*/gi;

/**
 * Sanitize HTML content for safe rendering in PDFs
 *
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeHtml(html: string | undefined): string {
  if (!html) return '';

  let sanitized = html;

  // Remove script tags and their content
  sanitized = sanitized.replace(SCRIPT_TAG_PATTERN, '');

  // Remove object/embed/applet tags (potential for plugin exploits)
  sanitized = sanitized.replace(OBJECT_TAG_PATTERN, '');
  sanitized = sanitized.replace(EMBED_TAG_PATTERN, '');
  sanitized = sanitized.replace(APPLET_TAG_PATTERN, '');

  // Remove iframe/frame/frameset tags
  sanitized = sanitized.replace(IFRAME_TAG_PATTERN, '');
  sanitized = sanitized.replace(FRAME_TAG_PATTERN, '');
  sanitized = sanitized.replace(FRAMESET_TAG_PATTERN, '');

  // Remove form elements (prevent unintended data submission)
  sanitized = sanitized.replace(FORM_TAG_PATTERN, '');
  sanitized = sanitized.replace(INPUT_TAG_PATTERN, '');

  // Remove meta refresh and base tags
  sanitized = sanitized.replace(META_REFRESH_PATTERN, '');
  sanitized = sanitized.replace(BASE_TAG_PATTERN, '');

  // Remove link imports
  sanitized = sanitized.replace(LINK_IMPORT_PATTERN, '');

  // Remove all event handlers (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(ON_EVENT_PATTERN, ' ');

  // Remove javascript: URLs
  sanitized = sanitized.replace(JAVASCRIPT_URL_PATTERN, 'blocked:');

  // Remove vbscript: URLs
  sanitized = sanitized.replace(VBSCRIPT_URL_PATTERN, 'blocked:');

  // Remove data:text/html URLs (can contain executable content)
  sanitized = sanitized.replace(DATA_URL_PATTERN, 'blocked:');

  // Remove dangerous attribute values
  sanitized = sanitized.replace(DANGEROUS_ATTR_PATTERN, '$1="blocked"');

  // Remove CSS expressions (IE-specific but still worth blocking)
  sanitized = sanitized.replace(STYLE_WITH_EXPRESSION_PATTERN, 'blocked(');

  return sanitized;
}

/**
 * Sanitize PDF header/footer templates
 * More restrictive than general HTML sanitization since templates
 * should only contain text, basic formatting, and page number placeholders
 *
 * Playwright-specific placeholders that are safe:
 * - <span class="date"></span>
 * - <span class="title"></span>
 * - <span class="url"></span>
 * - <span class="pageNumber"></span>
 * - <span class="totalPages"></span>
 *
 * @param template - The template string to sanitize
 * @returns Sanitized template string
 */
export function sanitizePdfTemplate(template: string | undefined): string {
  if (!template) return '';

  // First apply general sanitization
  let sanitized = sanitizeHtml(template);

  // Additional restrictions for templates
  // Remove any remaining potentially dangerous tags not caught above
  sanitized = sanitized.replace(/<(style)[^>]*>[\s\S]*?<\/\1>/gi, (match) => {
    // Allow style tags but sanitize their content
    return match.replace(/expression\s*\(/gi, 'blocked(')
      .replace(/@import/gi, 'blocked')
      .replace(/behavior\s*:/gi, 'blocked:')
      .replace(/binding\s*:/gi, 'blocked:');
  });

  return sanitized;
}

/**
 * Check if HTML content contains potentially dangerous patterns
 * Use this for logging/auditing purposes
 *
 * @param html - The HTML string to check
 * @returns Object with boolean flag and list of detected issues
 */
export function checkHtmlSafety(html: string | undefined): {
  safe: boolean;
  issues: string[];
} {
  if (!html) return { safe: true, issues: [] };

  const issues: string[] = [];

  if (SCRIPT_TAG_PATTERN.test(html)) {
    issues.push('Contains <script> tags');
  }

  if (ON_EVENT_PATTERN.test(html)) {
    issues.push('Contains event handlers (on* attributes)');
  }

  if (JAVASCRIPT_URL_PATTERN.test(html)) {
    issues.push('Contains javascript: URLs');
  }

  if (IFRAME_TAG_PATTERN.test(html)) {
    issues.push('Contains <iframe> tags');
  }

  if (OBJECT_TAG_PATTERN.test(html) || EMBED_TAG_PATTERN.test(html)) {
    issues.push('Contains <object> or <embed> tags');
  }

  if (DATA_URL_PATTERN.test(html)) {
    issues.push('Contains data:text/html URLs');
  }

  // Reset lastIndex for reused regex patterns
  SCRIPT_TAG_PATTERN.lastIndex = 0;
  ON_EVENT_PATTERN.lastIndex = 0;
  JAVASCRIPT_URL_PATTERN.lastIndex = 0;
  IFRAME_TAG_PATTERN.lastIndex = 0;
  OBJECT_TAG_PATTERN.lastIndex = 0;
  EMBED_TAG_PATTERN.lastIndex = 0;
  DATA_URL_PATTERN.lastIndex = 0;

  return {
    safe: issues.length === 0,
    issues,
  };
}
