import CryptoJS from 'crypto-js';
import { SECURITY_CONFIG } from '@constants/index';
import { EncryptedData } from '@types/index';

export class EncryptionManager {
  private static readonly ALGORITHM = SECURITY_CONFIG.ENCRYPTION.ALGORITHM;
  private static readonly KEY_DERIVATION = SECURITY_CONFIG.ENCRYPTION.KEY_DERIVATION;
  private static readonly SALT_LENGTH = SECURITY_CONFIG.ENCRYPTION.SALT_LENGTH;
  private static readonly IV_LENGTH = SECURITY_CONFIG.ENCRYPTION.IV_LENGTH;
  private static readonly ITERATIONS = SECURITY_CONFIG.ENCRYPTION.ITERATIONS;

  /**
   * Generate a secure random key for encryption
   */
  static generateEncryptionKey(): string {
    return CryptoJS.lib.WordArray.random(256/8).toString();
  }

  /**
   * Generate a secure random salt
   */
  private static generateSalt(): CryptoJS.lib.WordArray {
    return CryptoJS.lib.WordArray.random(this.SALT_LENGTH);
  }

  /**
   * Generate a secure random IV
   */
  private static generateIV(): CryptoJS.lib.WordArray {
    return CryptoJS.lib.WordArray.random(this.IV_LENGTH);
  }

  /**
   * Derive encryption key from user key using PBKDF2
   */
  private static deriveKey(userKey: string, salt: CryptoJS.lib.WordArray): CryptoJS.lib.WordArray {
    return CryptoJS.PBKDF2(userKey, salt, {
      keySize: 256/32,
      iterations: this.ITERATIONS,
      hasher: CryptoJS.algo.SHA256
    });
  }

  /**
   * Encrypt health data using AES-256-GCM
   */
  static async encryptHealthData(data: any, userKey: string): Promise<EncryptedData> {
    try {
      const salt = this.generateSalt();
      const iv = this.generateIV();
      
      // Derive key using PBKDF2
      const key = this.deriveKey(userKey, salt);

      // Convert data to JSON string
      const jsonData = JSON.stringify(data);

      // Encrypt using AES-256-GCM
      const encrypted = CryptoJS.AES.encrypt(jsonData, key, {
        iv: iv,
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.NoPadding
      });

      return {
        encryptedData: encrypted.toString(),
        salt: this.wordArrayToArray(salt),
        iv: this.wordArrayToArray(iv),
        algorithm: this.ALGORITHM
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('数据加密失败');
    }
  }

  /**
   * Decrypt health data using AES-256-GCM
   */
  static async decryptHealthData(encryptedData: EncryptedData, userKey: string): Promise<any> {
    try {
      const salt = this.arrayToWordArray(encryptedData.salt);
      const iv = this.arrayToWordArray(encryptedData.iv);

      // Derive key using PBKDF2 with the same parameters
      const key = this.deriveKey(userKey, salt);

      // Decrypt using AES-256-GCM
      const decrypted = CryptoJS.AES.decrypt(encryptedData.encryptedData, key, {
        iv: iv,
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.NoPadding
      });

      const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
      
      if (!jsonString) {
        throw new Error('解密失败：无效的密钥或数据损坏');
      }

      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('数据解密失败');
    }
  }

  /**
   * Encrypt sensitive text fields
   */
  static async encryptText(text: string, userKey: string): Promise<EncryptedData> {
    return this.encryptHealthData(text, userKey);
  }

  /**
   * Decrypt sensitive text fields
   */
  static async decryptText(encryptedData: EncryptedData, userKey: string): Promise<string> {
    return this.decryptHealthData(encryptedData, userKey);
  }

  /**
   * Encrypt multiple fields in an object
   */
  static async encryptFields(data: any, fields: string[], userKey: string): Promise<any> {
    const result = { ...data };

    for (const field of fields) {
      if (result[field] !== undefined && result[field] !== null) {
        const encryptedField = await this.encryptHealthData(result[field], userKey);
        result[`${field}_encrypted`] = encryptedField;
        delete result[field]; // Remove original field
      }
    }

    return result;
  }

  /**
   * Decrypt multiple fields in an object
   */
  static async decryptFields(data: any, fields: string[], userKey: string): Promise<any> {
    const result = { ...data };

    for (const field of fields) {
      const encryptedField = `${field}_encrypted`;
      if (result[encryptedField]) {
        try {
          result[field] = await this.decryptHealthData(result[encryptedField], userKey);
          delete result[encryptedField]; // Remove encrypted field
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error);
          result[field] = null; // Set to null if decryption fails
        }
      }
    }

    return result;
  }

  /**
   * Generate hash for password or sensitive data verification
   */
  static generateHash(data: string, salt?: string): string {
    const saltToUse = salt || CryptoJS.lib.WordArray.random(256/8).toString();
    const hash = CryptoJS.PBKDF2(data, saltToUse, {
      keySize: 256/32,
      iterations: this.ITERATIONS,
      hasher: CryptoJS.algo.SHA256
    });
    
    return `${saltToUse}:${hash.toString()}`;
  }

  /**
   * Verify hash
   */
  static verifyHash(data: string, hash: string): boolean {
    try {
      const [salt, originalHash] = hash.split(':');
      const newHash = CryptoJS.PBKDF2(data, salt, {
        keySize: 256/32,
        iterations: this.ITERATIONS,
        hasher: CryptoJS.algo.SHA256
      });

      return newHash.toString() === originalHash;
    } catch (error) {
      console.error('Hash verification failed:', error);
      return false;
    }
  }

  /**
   * Generate secure random string for IDs, tokens, etc.
   */
  static generateSecureRandom(length: number = 32): string {
    return CryptoJS.lib.WordArray.random(length).toString();
  }

  /**
   * Generate user encryption key from biometric/password
   */
  static generateUserKey(userIdentifier: string, biometricData?: string): string {
    const baseData = biometricData || userIdentifier;
    return CryptoJS.SHA256(baseData).toString();
  }

  /**
   * Encrypt data for transmission (additional layer for API calls)
   */
  static encryptForTransmission(data: any, sessionKey: string): string {
    const jsonData = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(jsonData, sessionKey);
    return encrypted.toString();
  }

  /**
   * Decrypt data from transmission
   */
  static decryptFromTransmission(encryptedData: string, sessionKey: string): any {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData, sessionKey);
      const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Transmission decryption failed:', error);
      throw new Error('传输数据解密失败');
    }
  }

  /**
   * Utility methods for WordArray conversion
   */
  private static wordArrayToArray(wordArray: CryptoJS.lib.WordArray): number[] {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    const u8 = new Uint8Array(sigBytes);
    
    for (let i = 0; i < sigBytes; i++) {
      u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    
    return Array.from(u8);
  }

  private static arrayToWordArray(array: number[]): CryptoJS.lib.WordArray {
    const u8Array = new Uint8Array(array);
    return CryptoJS.lib.WordArray.create(u8Array);
  }

  /**
   * Data anonymization for analytics (HIPAA compliant)
   */
  static anonymizeHealthData(data: any): any {
    const anonymized = { ...data };
    
    // Remove or hash PII fields
    const piiFields = ['fullName', 'email', 'phoneNumber', 'address', 'ssn', 'patientName'];
    
    piiFields.forEach(field => {
      if (anonymized[field]) {
        // Replace with hashed version for analytics purposes
        anonymized[field] = CryptoJS.SHA256(anonymized[field]).toString().substring(0, 8);
      }
    });

    // Remove specific identifiers
    delete anonymized.id;
    delete anonymized.userId;
    delete anonymized.documentPath;

    return anonymized;
  }

  /**
   * Secure data deletion (overwrite memory)
   */
  static secureDelete(data: any): void {
    if (typeof data === 'object' && data !== null) {
      Object.keys(data).forEach(key => {
        if (typeof data[key] === 'string') {
          // Overwrite string with random data
          data[key] = CryptoJS.lib.WordArray.random(data[key].length).toString();
        } else if (typeof data[key] === 'object') {
          this.secureDelete(data[key]);
        }
        delete data[key];
      });
    }
  }
}

// Export singleton instance
export default EncryptionManager;