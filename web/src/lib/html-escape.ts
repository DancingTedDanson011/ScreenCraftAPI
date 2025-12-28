/**
 * HTML Escape Utility
 * H-01: Prevent XSS attacks by escaping user-controlled data before DOM insertion
 */

/**
 * Escape HTML special characters to prevent XSS
 * Use this when inserting dynamic content into HTML templates
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (unsafe == null) return '';

  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Escape string for use in HTML attribute values
 * Handles quotes and other special characters
 */
export function escapeAttr(unsafe: string | null | undefined): string {
  if (unsafe == null) return '';

  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape string for use in JavaScript string literals
 * Use when embedding data in inline scripts
 */
export function escapeJs(unsafe: string | null | undefined): string {
  if (unsafe == null) return '';

  return String(unsafe)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
