import CryptoJS from "crypto-js";

const getSecret = (): string => {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ENCRYPTION_SECRET must be at least 32 characters long");
  }
  return secret;
};

/**
 * Encrypt a plaintext string using AES-256.
 * Safe to store in the database.
 */
export function encryptApiKey(plaintext: string): string {
  const secret = getSecret();
  return CryptoJS.AES.encrypt(plaintext, secret).toString();
}

/**
 * Decrypt a previously encrypted string.
 */
export function decryptApiKey(ciphertext: string): string {
  const secret = getSecret();
  const bytes = CryptoJS.AES.decrypt(ciphertext, secret);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  if (!decrypted) {
    throw new Error("Failed to decrypt API key — invalid ciphertext or secret");
  }
  return decrypted;
}

/**
 * Mask an API key for display (show first 4 + last 4 chars)
 */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}${"*".repeat(key.length - 8)}${key.slice(-4)}`;
}
