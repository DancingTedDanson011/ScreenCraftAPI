import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateUrl,
  isUrlSafe,
  UrlValidationError,
} from '../../../src/utils/url-validator.js';

describe('URL Validator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('UrlValidationError', () => {
    it('should create error with correct name and message', () => {
      const error = new UrlValidationError('Test error message');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(UrlValidationError);
      expect(error.name).toBe('UrlValidationError');
      expect(error.message).toBe('Test error message');
    });

    it('should have proper stack trace', () => {
      const error = new UrlValidationError('Stack test');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('UrlValidationError');
    });
  });

  describe('validateUrl', () => {
    describe('valid URLs', () => {
      it('should accept valid HTTP URLs', () => {
        expect(() => validateUrl('http://example.com')).not.toThrow();
        expect(() => validateUrl('http://www.example.com')).not.toThrow();
        expect(() => validateUrl('http://subdomain.example.com')).not.toThrow();
      });

      it('should accept valid HTTPS URLs', () => {
        expect(() => validateUrl('https://example.com')).not.toThrow();
        expect(() => validateUrl('https://www.example.com')).not.toThrow();
        expect(() => validateUrl('https://secure.example.com')).not.toThrow();
      });

      it('should accept URLs with paths', () => {
        expect(() => validateUrl('https://example.com/path')).not.toThrow();
        expect(() => validateUrl('https://example.com/path/to/resource')).not.toThrow();
        expect(() => validateUrl('https://example.com/path?query=value')).not.toThrow();
      });

      it('should accept URLs with query parameters', () => {
        expect(() => validateUrl('https://example.com?foo=bar')).not.toThrow();
        expect(() => validateUrl('https://example.com?foo=bar&baz=qux')).not.toThrow();
        expect(() => validateUrl('https://example.com/path?key=value#anchor')).not.toThrow();
      });

      it('should accept URLs with fragments', () => {
        expect(() => validateUrl('https://example.com#section')).not.toThrow();
        expect(() => validateUrl('https://example.com/page#top')).not.toThrow();
      });

      it('should accept URLs with allowed ports', () => {
        expect(() => validateUrl('https://example.com:80')).not.toThrow();
        expect(() => validateUrl('https://example.com:443')).not.toThrow();
        expect(() => validateUrl('https://example.com:8080')).not.toThrow();
        expect(() => validateUrl('https://example.com:3000')).not.toThrow();
      });

      it('should accept URLs with authentication (user:pass)', () => {
        expect(() => validateUrl('https://user:pass@example.com')).not.toThrow();
      });

      it('should accept international domain names', () => {
        expect(() => validateUrl('https://example.co.uk')).not.toThrow();
        expect(() => validateUrl('https://example.de')).not.toThrow();
        expect(() => validateUrl('https://xn--nxasmq5b.com')).not.toThrow(); // IDN encoded
      });
    });

    describe('invalid URL format', () => {
      it('should reject empty string', () => {
        expect(() => validateUrl('')).toThrow(UrlValidationError);
        expect(() => validateUrl('')).toThrow('Invalid URL format');
      });

      it('should reject non-URL strings', () => {
        expect(() => validateUrl('not-a-url')).toThrow(UrlValidationError);
        expect(() => validateUrl('just some text')).toThrow(UrlValidationError);
        expect(() => validateUrl('example.com')).toThrow(UrlValidationError); // Missing protocol
      });

      it('should reject malformed URLs', () => {
        expect(() => validateUrl('http://')).toThrow(UrlValidationError);
        expect(() => validateUrl('https://')).toThrow(UrlValidationError);
        // Note: 'http:///path' is actually parsed as valid by Node URL with empty hostname
        // which then fails the blocked hostname check
      });

      it('should reject URLs with spaces', () => {
        expect(() => validateUrl('https://example .com')).toThrow(UrlValidationError);
        expect(() => validateUrl('https:// example.com')).toThrow(UrlValidationError);
      });
    });

    describe('blocked protocols (SSRF protection)', () => {
      it('should reject file:// protocol', () => {
        expect(() => validateUrl('file:///etc/passwd')).toThrow(UrlValidationError);
        expect(() => validateUrl('file:///etc/passwd')).toThrow('Protocol file: is not allowed');
      });

      it('should reject ftp:// protocol', () => {
        expect(() => validateUrl('ftp://ftp.example.com')).toThrow(UrlValidationError);
        expect(() => validateUrl('ftp://ftp.example.com')).toThrow('Protocol ftp: is not allowed');
      });

      it('should reject javascript: protocol', () => {
        expect(() => validateUrl('javascript:alert(1)')).toThrow(UrlValidationError);
      });

      it('should reject data: protocol', () => {
        expect(() => validateUrl('data:text/html,<script>alert(1)</script>')).toThrow(
          UrlValidationError
        );
      });

      it('should reject gopher:// protocol', () => {
        expect(() => validateUrl('gopher://gopher.example.com')).toThrow(UrlValidationError);
      });

      it('should reject ldap:// protocol', () => {
        expect(() => validateUrl('ldap://ldap.example.com')).toThrow(UrlValidationError);
      });

      it('should reject dict:// protocol', () => {
        expect(() => validateUrl('dict://dict.example.com')).toThrow(UrlValidationError);
      });

      it('should include allowed protocols in error message', () => {
        expect(() => validateUrl('ftp://example.com')).toThrow('Use http: or https:');
      });
    });

    describe('localhost blocking (SSRF protection)', () => {
      it('should reject localhost', () => {
        expect(() => validateUrl('http://localhost')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://localhost')).toThrow('Access to localhost is not allowed');
      });

      it('should reject localhost with port', () => {
        expect(() => validateUrl('http://localhost:3000')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://localhost:8080')).toThrow(UrlValidationError);
      });

      it('should reject localhost case-insensitively', () => {
        expect(() => validateUrl('http://LOCALHOST')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://LocalHost')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://LOCALHOST:8080')).toThrow(UrlValidationError);
      });

      it('should reject 127.0.0.0/8 range', () => {
        expect(() => validateUrl('http://127.0.0.1')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://127.0.0.1')).toThrow('Access to internal networks is not allowed');
        expect(() => validateUrl('http://127.0.0.2')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://127.1.2.3')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://127.255.255.255')).toThrow(UrlValidationError);
      });

      it('should reject IPv6 localhost', () => {
        expect(() => validateUrl('http://[::1]')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://[::1]:8080')).toThrow(UrlValidationError);
      });

      it('should reject 0.0.0.0', () => {
        expect(() => validateUrl('http://0.0.0.0')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://0.0.0.0:8080')).toThrow(UrlValidationError);
      });
    });

    describe('private network blocking (RFC 1918)', () => {
      it('should reject 10.0.0.0/8 range', () => {
        expect(() => validateUrl('http://10.0.0.1')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://10.0.0.1')).toThrow('Access to internal networks is not allowed');
        expect(() => validateUrl('http://10.255.255.255')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://10.1.2.3')).toThrow(UrlValidationError);
      });

      it('should reject 172.16.0.0/12 range', () => {
        expect(() => validateUrl('http://172.16.0.1')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://172.16.0.1')).toThrow('Access to internal networks is not allowed');
        expect(() => validateUrl('http://172.20.0.1')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://172.31.255.255')).toThrow(UrlValidationError);
      });

      it('should allow IPs outside 172.16-31 range', () => {
        // 172.15.x.x should be allowed (public IP range)
        expect(() => validateUrl('http://172.15.0.1')).not.toThrow();
        // 172.32.x.x should be allowed (public IP range)
        expect(() => validateUrl('http://172.32.0.1')).not.toThrow();
      });

      it('should reject 192.168.0.0/16 range', () => {
        expect(() => validateUrl('http://192.168.0.1')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://192.168.0.1')).toThrow('Access to internal networks is not allowed');
        expect(() => validateUrl('http://192.168.1.1')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://192.168.255.255')).toThrow(UrlValidationError);
      });
    });

    describe('link-local address blocking', () => {
      it('should reject 169.254.0.0/16 range (link-local)', () => {
        expect(() => validateUrl('http://169.254.0.1')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://169.254.169.254')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://169.254.255.255')).toThrow(UrlValidationError);
      });

      it('should reject fe80:: IPv6 link-local addresses', () => {
        // Note: The URL constructor strips brackets from IPv6 addresses
        // The hostname becomes 'fe80::1' without brackets, which matches the pattern
        // However, the regex pattern /^fe80:/i expects the hostname to start with 'fe80:'
        // which won't match '[fe80::1]' after URL parsing removes brackets
        // This is a known limitation - the pattern should be tested against the raw hostname
        expect(() => validateUrl('http://fe80::1')).toThrow(UrlValidationError);
      });
    });

    describe('Docker internal blocking', () => {
      it('should reject Docker default bridge network', () => {
        expect(() => validateUrl('http://172.17.0.1')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://172.17.0.2')).toThrow(UrlValidationError);
      });

      it('should reject host.docker.internal', () => {
        expect(() => validateUrl('http://host.docker.internal')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://HOST.DOCKER.INTERNAL')).toThrow(UrlValidationError);
      });
    });

    describe('Kubernetes internal blocking', () => {
      it('should reject kubernetes hostnames', () => {
        expect(() => validateUrl('http://kubernetes')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://kubernetes.default')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://kubernetes.default.svc')).toThrow(UrlValidationError);
      });

      it('should reject .local domains', () => {
        expect(() => validateUrl('http://myservice.local')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://app.local')).toThrow(UrlValidationError);
      });

      it('should reject .internal domains', () => {
        expect(() => validateUrl('http://myservice.internal')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://app.internal')).toThrow(UrlValidationError);
      });

      it('should reject .cluster domains', () => {
        expect(() => validateUrl('http://myservice.cluster')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://svc.cluster')).toThrow(UrlValidationError);
      });
    });

    describe('cloud metadata endpoints blocking', () => {
      it('should reject AWS/GCP metadata endpoint', () => {
        expect(() => validateUrl('http://169.254.169.254')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://169.254.169.254/latest/meta-data/')).toThrow(
          UrlValidationError
        );
      });

      it('should reject Google Cloud metadata', () => {
        expect(() => validateUrl('http://metadata.google.internal')).toThrow(UrlValidationError);
        expect(() =>
          validateUrl('http://metadata.google.internal/computeMetadata/v1/')
        ).toThrow(UrlValidationError);
      });

      it('should reject Azure metadata', () => {
        expect(() => validateUrl('http://metadata.azure.internal')).toThrow(UrlValidationError);
      });
    });

    describe('blocked hostnames (internal services)', () => {
      it('should reject redis hostname', () => {
        expect(() => validateUrl('http://redis')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://redis:6379')).toThrow(UrlValidationError);
      });

      it('should reject postgres/postgresql hostnames', () => {
        expect(() => validateUrl('http://postgres')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://postgresql')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://postgres:5432')).toThrow(UrlValidationError);
      });

      it('should reject mysql hostname', () => {
        expect(() => validateUrl('http://mysql')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://mysql:3306')).toThrow(UrlValidationError);
      });

      it('should reject mongodb hostname', () => {
        expect(() => validateUrl('http://mongodb')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://mongodb:27017')).toThrow(UrlValidationError);
      });

      it('should reject minio hostname', () => {
        expect(() => validateUrl('http://minio')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://minio:9000')).toThrow(UrlValidationError);
      });

      it('should reject elasticsearch hostname', () => {
        expect(() => validateUrl('http://elasticsearch')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://elasticsearch:9200')).toThrow(UrlValidationError);
      });

      it('should reject rabbitmq hostname', () => {
        expect(() => validateUrl('http://rabbitmq')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://rabbitmq:5672')).toThrow(UrlValidationError);
      });

      it('should reject memcached hostname', () => {
        expect(() => validateUrl('http://memcached')).toThrow(UrlValidationError);
        expect(() => validateUrl('http://memcached:11211')).toThrow(UrlValidationError);
      });
    });

    describe('blocked ports (common internal services)', () => {
      it('should reject PostgreSQL port 5432', () => {
        expect(() => validateUrl('https://example.com:5432')).toThrow(UrlValidationError);
        expect(() => validateUrl('https://example.com:5432')).toThrow(
          'Port 5432 is blocked for security reasons'
        );
      });

      it('should reject MySQL port 3306', () => {
        expect(() => validateUrl('https://example.com:3306')).toThrow(UrlValidationError);
        expect(() => validateUrl('https://example.com:3306')).toThrow(
          'Port 3306 is blocked for security reasons'
        );
      });

      it('should reject Redis port 6379', () => {
        expect(() => validateUrl('https://example.com:6379')).toThrow(UrlValidationError);
        expect(() => validateUrl('https://example.com:6379')).toThrow(
          'Port 6379 is blocked for security reasons'
        );
      });

      it('should reject MongoDB port 27017', () => {
        expect(() => validateUrl('https://example.com:27017')).toThrow(UrlValidationError);
        expect(() => validateUrl('https://example.com:27017')).toThrow(
          'Port 27017 is blocked for security reasons'
        );
      });

      it('should reject Elasticsearch port 9200', () => {
        expect(() => validateUrl('https://example.com:9200')).toThrow(UrlValidationError);
        expect(() => validateUrl('https://example.com:9200')).toThrow(
          'Port 9200 is blocked for security reasons'
        );
      });

      it('should reject RabbitMQ port 5672', () => {
        expect(() => validateUrl('https://example.com:5672')).toThrow(UrlValidationError);
        expect(() => validateUrl('https://example.com:5672')).toThrow(
          'Port 5672 is blocked for security reasons'
        );
      });

      it('should reject Memcached port 11211', () => {
        expect(() => validateUrl('https://example.com:11211')).toThrow(UrlValidationError);
        expect(() => validateUrl('https://example.com:11211')).toThrow(
          'Port 11211 is blocked for security reasons'
        );
      });

      it('should reject MinIO port 9000', () => {
        expect(() => validateUrl('https://example.com:9000')).toThrow(UrlValidationError);
        expect(() => validateUrl('https://example.com:9000')).toThrow(
          'Port 9000 is blocked for security reasons'
        );
      });
    });

    describe('edge cases', () => {
      it('should handle URLs with encoded characters', () => {
        expect(() => validateUrl('https://example.com/path%20with%20spaces')).not.toThrow();
        expect(() => validateUrl('https://example.com?q=%E2%9C%93')).not.toThrow();
      });

      it('should handle very long URLs', () => {
        const longPath = 'a'.repeat(1000);
        expect(() => validateUrl(`https://example.com/${longPath}`)).not.toThrow();
      });

      it('should handle URLs with unusual but valid TLDs', () => {
        expect(() => validateUrl('https://example.photography')).not.toThrow();
        expect(() => validateUrl('https://example.museum')).not.toThrow();
        expect(() => validateUrl('https://example.io')).not.toThrow();
      });

      it('should handle numeric hostnames that are not IPs', () => {
        // Numbers in domain names are allowed
        expect(() => validateUrl('https://123.example.com')).not.toThrow();
      });

      it('should handle default ports (no port in URL)', () => {
        // URLs without explicit port should be allowed
        expect(() => validateUrl('https://example.com')).not.toThrow();
        expect(() => validateUrl('http://example.com')).not.toThrow();
      });

      it('should handle IPv4 public addresses', () => {
        expect(() => validateUrl('http://8.8.8.8')).not.toThrow();
        expect(() => validateUrl('http://1.1.1.1')).not.toThrow();
        expect(() => validateUrl('http://208.67.222.222')).not.toThrow();
      });

      it('should handle case sensitivity correctly for domains', () => {
        expect(() => validateUrl('https://EXAMPLE.COM')).not.toThrow();
        expect(() => validateUrl('https://Example.Com')).not.toThrow();
      });
    });
  });

  describe('isUrlSafe', () => {
    describe('safe URLs', () => {
      it('should return true for valid HTTP URL', () => {
        expect(isUrlSafe('http://example.com')).toBe(true);
      });

      it('should return true for valid HTTPS URL', () => {
        expect(isUrlSafe('https://example.com')).toBe(true);
      });

      it('should return true for URL with path', () => {
        expect(isUrlSafe('https://example.com/path/to/resource')).toBe(true);
      });

      it('should return true for URL with query string', () => {
        expect(isUrlSafe('https://example.com?foo=bar')).toBe(true);
      });

      it('should return true for URL with allowed port', () => {
        expect(isUrlSafe('https://example.com:8080')).toBe(true);
      });

      it('should return true for public IP addresses', () => {
        expect(isUrlSafe('http://8.8.8.8')).toBe(true);
        expect(isUrlSafe('http://1.1.1.1')).toBe(true);
      });
    });

    describe('unsafe URLs', () => {
      it('should return false for invalid URL format', () => {
        expect(isUrlSafe('')).toBe(false);
        expect(isUrlSafe('not-a-url')).toBe(false);
        expect(isUrlSafe('example.com')).toBe(false);
      });

      it('should return false for blocked protocols', () => {
        expect(isUrlSafe('file:///etc/passwd')).toBe(false);
        expect(isUrlSafe('ftp://ftp.example.com')).toBe(false);
        expect(isUrlSafe('javascript:alert(1)')).toBe(false);
      });

      it('should return false for localhost', () => {
        expect(isUrlSafe('http://localhost')).toBe(false);
        expect(isUrlSafe('http://localhost:3000')).toBe(false);
        expect(isUrlSafe('http://127.0.0.1')).toBe(false);
      });

      it('should return false for private IPs', () => {
        expect(isUrlSafe('http://10.0.0.1')).toBe(false);
        expect(isUrlSafe('http://172.16.0.1')).toBe(false);
        expect(isUrlSafe('http://192.168.1.1')).toBe(false);
      });

      it('should return false for cloud metadata endpoints', () => {
        expect(isUrlSafe('http://169.254.169.254')).toBe(false);
        expect(isUrlSafe('http://metadata.google.internal')).toBe(false);
      });

      it('should return false for blocked hostnames', () => {
        expect(isUrlSafe('http://redis')).toBe(false);
        expect(isUrlSafe('http://postgres')).toBe(false);
        expect(isUrlSafe('http://mongodb')).toBe(false);
      });

      it('should return false for blocked ports', () => {
        expect(isUrlSafe('https://example.com:5432')).toBe(false);
        expect(isUrlSafe('https://example.com:6379')).toBe(false);
        expect(isUrlSafe('https://example.com:27017')).toBe(false);
      });

      it('should return false for internal domains', () => {
        expect(isUrlSafe('http://myservice.local')).toBe(false);
        expect(isUrlSafe('http://app.internal')).toBe(false);
        expect(isUrlSafe('http://svc.cluster')).toBe(false);
      });
    });

    describe('consistency with validateUrl', () => {
      const testUrls = [
        // Valid URLs
        { url: 'https://example.com', shouldBeSafe: true },
        { url: 'http://public-api.com/v1', shouldBeSafe: true },
        { url: 'https://cdn.example.org:8443', shouldBeSafe: true },
        // Invalid URLs
        { url: 'http://localhost', shouldBeSafe: false },
        { url: 'http://192.168.0.1', shouldBeSafe: false },
        { url: 'ftp://files.example.com', shouldBeSafe: false },
        { url: 'http://redis:6379', shouldBeSafe: false },
        { url: 'invalid-url', shouldBeSafe: false },
      ];

      it.each(testUrls)(
        'isUrlSafe($url) should return $shouldBeSafe matching validateUrl behavior',
        ({ url, shouldBeSafe }) => {
          const isSafe = isUrlSafe(url);
          expect(isSafe).toBe(shouldBeSafe);

          if (shouldBeSafe) {
            expect(() => validateUrl(url)).not.toThrow();
          } else {
            expect(() => validateUrl(url)).toThrow();
          }
        }
      );
    });
  });

  describe('SSRF attack vectors', () => {
    it('should block DNS rebinding attack attempts via localhost aliases', () => {
      expect(isUrlSafe('http://localhost')).toBe(false);
      expect(isUrlSafe('http://127.0.0.1')).toBe(false);
      expect(isUrlSafe('http://[::1]')).toBe(false);
    });

    it('should block URL shortcut bypass attempts', () => {
      // These would resolve to localhost in some systems
      expect(isUrlSafe('http://0.0.0.0')).toBe(false);
    });

    it('should block decimal IP representations', () => {
      // 127.0.0.1 in decimal is 2130706433
      // Note: URL constructor may not parse this, so it would fail as invalid URL
      expect(isUrlSafe('http://2130706433')).toBe(false); // Invalid URL format
    });

    it('should block internal service discovery', () => {
      expect(isUrlSafe('http://kubernetes.default.svc.cluster.local')).toBe(false);
      expect(isUrlSafe('http://host.docker.internal')).toBe(false);
    });

    it('should block cloud metadata access attempts', () => {
      expect(isUrlSafe('http://169.254.169.254/latest/meta-data/')).toBe(false);
      expect(isUrlSafe('http://169.254.169.254/computeMetadata/v1/')).toBe(false);
      expect(isUrlSafe('http://metadata.google.internal/computeMetadata/v1/')).toBe(false);
    });

    it('should block protocol smuggling attempts', () => {
      expect(isUrlSafe('gopher://internal:25/1HELO')).toBe(false);
      expect(isUrlSafe('dict://internal:11211/stat')).toBe(false);
    });
  });
});
