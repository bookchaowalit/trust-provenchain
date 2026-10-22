import { createHash } from 'node:crypto';

const HASH_PATTERN = /^0x[0-9a-f]{64}$/;

/**
 * SHA-256 of the document bytes as a 0x-prefixed lowercase hex digest.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function hashDocument(bytes) {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
    throw new TypeError('document bytes must be a Buffer or Uint8Array');
  }

  return `0x${createHash('sha256').update(bytes).digest('hex')}`;
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isDocumentHash(value) {
  return typeof value === 'string' && HASH_PATTERN.test(value);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeDocumentHash(value) {
  if (typeof value !== 'string') {
    throw new TypeError('document hash must be a string');
  }

  const normalized = value.toLowerCase();
  if (!isDocumentHash(normalized)) {
    throw new Error('document hash must be a 0x-prefixed 32-byte SHA-256 digest');
  }

  return normalized;
}

/**
 * @param {Uint8Array} bytes
 * @param {unknown} expectedHash
 * @returns {boolean}
 */
export function verifyDocumentHash(bytes, expectedHash) {
  return hashDocument(bytes) === normalizeDocumentHash(expectedHash);
}

