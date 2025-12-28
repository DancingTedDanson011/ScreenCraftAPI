/**
 * Field-Level Encryption Service
 * H-09/H-10/M-06: Secure encryption for sensitive data at rest
 *
 * Uses AES-256-GCM for authenticated encryption with:
 * - Unique IV per encryption
 * - Auth tag for integrity verification
 * - Master key derived from environment variable
 */

import crypto from 'node:crypto';
import { config } from '../../config/index.js';

// Encryption constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits for AES-256

// Encrypted data format: base64(iv + authTag + ciphertext)
const ENCRYPTED_PREFIX = 'enc:v1:';

/**
 * Get or derive the encryption master key
 * In production, this should come from a key management service (KMS)
 */
function getMasterKey(): Buffer {
  const masterKeyHex = process.env.ENCRYPTION_MASTER_KEY;

  if (!masterKeyHex) {
    throw new Error('ENCRYPTION_MASTER_KEY environment variable is not set');
  }

  const key = Buffer.from(masterKeyHex, 'hex');

  if (key.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_MASTER_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH * 8} bits)`);
  }

  return key;
}

/**
 * Get the API key pepper for additional hashing security
 * M-06: Add pepper to API key hashing
 */
export function getApiKeyPepper(): string {
  const pepper = process.env.API_KEY_PEPPER;

  if (!pepper) {
    // In development, use a default (not secure for production)
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      return 'dev-pepper-not-for-production';
    }
    throw new Error('API_KEY_PEPPER environment variable is not set');
  }

  return pepper;
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param plaintext - The data to encrypt
 * @returns Encrypted string with prefix for identification
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }

  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine IV + authTag + ciphertext and encode as base64
  const combined = Buffer.concat([iv, authTag, encrypted]);

  return `${ENCRYPTED_PREFIX}${combined.toString('base64')}`;
}

/**
 * Decrypt sensitive data encrypted with AES-256-GCM
 * @param encryptedData - The encrypted string with prefix
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    return encryptedData;
  }

  // Check for encryption prefix
  if (!encryptedData.startsWith(ENCRYPTED_PREFIX)) {
    // Return as-is if not encrypted (for migration compatibility)
    return encryptedData;
  }

  const key = getMasterKey();
  const encodedData = encryptedData.slice(ENCRYPTED_PREFIX.length);
  const combined = Buffer.from(encodedData, 'base64');

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error('Decryption failed: Invalid key or corrupted data');
  }
}

/**
 * Check if a string is encrypted
 */
export function isEncrypted(data: string): boolean {
  return data?.startsWith(ENCRYPTED_PREFIX) ?? false;
}

/**
 * Hash API key with pepper for additional security
 * M-06: Peppered hash prevents rainbow table attacks even if DB is compromised
 */
export function hashApiKeyWithPepper(key: string): string {
  const pepper = getApiKeyPepper();
  return crypto
    .createHash('sha256')
    .update(key + pepper)
    .digest('hex');
}

/**
 * Generate a new encryption master key (for setup)
 * Run: npx tsx -e "import { generateMasterKey } from './src/services/crypto/encryption.service'; console.log(generateMasterKey())"
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Generate a new API key pepper (for setup)
 */
export function generatePepper(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Encrypt webhook secret for storage
 * H-10: Webhook secrets should be encrypted at rest
 */
export function encryptWebhookSecret(secret: string): string {
  return encrypt(secret);
}

/**
 * Decrypt webhook secret for use
 */
export function decryptWebhookSecret(encryptedSecret: string): string {
  return decrypt(encryptedSecret);
}

/**
 * Re-encrypt data with a new key (for key rotation)
 * @param encryptedData - Data encrypted with old key
 * @param oldKey - The old master key
 * @param newKey - The new master key
 */
export function reEncrypt(encryptedData: string, oldKeyHex: string, newKeyHex: string): string {
  if (!encryptedData.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error('Data is not encrypted');
  }

  const oldKey = Buffer.from(oldKeyHex, 'hex');
  const newKey = Buffer.from(newKeyHex, 'hex');

  // Decrypt with old key
  const encodedData = encryptedData.slice(ENCRYPTED_PREFIX.length);
  const combined = Buffer.from(encodedData, 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, oldKey, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');

  // Re-encrypt with new key
  const newIv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, newKey, newIv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const newAuthTag = cipher.getAuthTag();
  const newCombined = Buffer.concat([newIv, newAuthTag, encrypted]);

  return `${ENCRYPTED_PREFIX}${newCombined.toString('base64')}`;
}
