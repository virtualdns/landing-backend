export class HashService {
  /**
   * Hashes a string using SHA-256 with a salt
   * @param value - The string value to hash
   * @param salt - The salt to use for hashing
   * @returns The hashed value as a hex string
   */
  public static async hash(value: string, salt: string): Promise<string> {
    const combined = `${value}${salt}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(combined);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
    
    return hashHex;
  }

  /**
   * Generates a random string of specified length
   * @param length - The length of the random string to generate
   * @returns A random alphanumeric string
   */
  public static generateRandomString(length: number): string {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    
    let result = "";
    for (const value of randomValues) {
      result += characters[value % characters.length];
    }
    
    return result;
  }

  /**
   * Validates an authorization token in the format ID:KEY
   * @param token - The authorization token in format "ID:KEY"
   * @param salt - The salt to use for hashing
   * @returns True if the token is valid, false otherwise
   */
  public static async validateAuthToken(token: string, salt: string): Promise<boolean> {
    const parts = token.split(":");
    
    if (parts.length !== 2) {
      return false;
    }
    
    const [id, key] = parts;
    
    if (!id || !key) {
      return false;
    }
    
    const expectedHash = await this.hash(id, salt);
    
    return expectedHash === key;
  }
}
