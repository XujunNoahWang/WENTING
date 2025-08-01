// Mock EncryptedStorage for web platform using localStorage
const EncryptedStorage = {
  setItem: async (key: string, value: string): Promise<void> => {
    localStorage.setItem(key, value);
  },
  
  getItem: async (key: string): Promise<string | null> => {
    return localStorage.getItem(key);
  },
  
  removeItem: async (key: string): Promise<void> => {
    localStorage.removeItem(key);
  },
  
  clear: async (): Promise<void> => {
    localStorage.clear();
  },
};

export default EncryptedStorage;