// Jest setup file for Firebase integration tests

import 'react-native-gesture-handler/jestSetup';

// Mock react-native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
    select: jest.fn((options) => options.web || options.default)
  },
  NativeModules: {},
  NativeEventEmitter: jest.fn(),
}));

// Mock react-native-encrypted-storage
jest.mock('react-native-encrypted-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

// Mock @react-native-google-signin/google-signin
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({
      idToken: 'mock-id-token',
      user: {
        id: 'mock-user-id',
        name: 'Mock User',
        email: 'mock@test.com',
        photo: 'mock-photo-url'
      }
    })),
    signOut: jest.fn(() => Promise.resolve()),
    isSignedIn: jest.fn(() => Promise.resolve(false)),
    getCurrentUser: jest.fn(() => Promise.resolve(null)),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  }
}));

// Mock react-native-touch-id
jest.mock('react-native-touch-id', () => ({
  isSupported: jest.fn(() => Promise.resolve('FaceID')),
  authenticate: jest.fn(() => Promise.resolve(true)),
}));

// Mock Firebase modules
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({
    name: '[DEFAULT]',
    options: {}
  })),
  getApps: jest.fn(() => []),
  getApp: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  })),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  updateProfile: jest.fn(),
  GoogleAuthProvider: jest.fn(() => ({
    addScope: jest.fn(),
  })),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(() => ({
    exists: () => false,
    data: () => ({}),
    id: 'mock-doc-id'
  })),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(() => ({
    docs: []
  })),
}));

// Mock @react-native-firebase modules
jest.mock('@react-native-firebase/app', () => ({
  default: jest.fn(() => ({
    apps: [],
    initializeApp: jest.fn(),
  })),
}));

jest.mock('@react-native-firebase/auth', () => ({
  default: jest.fn(() => ({
    currentUser: null,
    signInWithEmailAndPassword: jest.fn(),
    createUserWithEmailAndPassword: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    signInWithCredential: jest.fn(),
  })),
  GoogleAuthProvider: {
    credential: jest.fn(),
  },
}));

jest.mock('@react-native-firebase/firestore', () => ({
  default: jest.fn(() => ({
    collection: jest.fn(() => ({
      add: jest.fn(),
      doc: jest.fn(() => ({
        set: jest.fn(),
        get: jest.fn(() => ({
          exists: false,
          data: () => ({}),
          id: 'mock-doc-id'
        })),
        update: jest.fn(),
        delete: jest.fn(),
      })),
      where: jest.fn(() => ({
        get: jest.fn(() => ({
          docs: []
        }))
      })),
      get: jest.fn(() => ({
        docs: []
      }))
    })),
  })),
}));

// Mock SQLite - only mock if the module is actually imported
try {
  jest.mock('react-native-sqlite-storage', () => ({
    DEBUG: jest.fn(),
    enablePromise: jest.fn(),
    openDatabase: jest.fn(() => Promise.resolve({
      executeSql: jest.fn(() => Promise.resolve([{ rows: { length: 0, item: () => ({}) } }])),
      close: jest.fn(() => Promise.resolve()),
    })),
  }));
} catch (error) {
  // SQLite module not available, skip mock
}

// Mock constants
jest.mock('@constants/index', () => ({
  SECURITY_CONFIG: {
    AUTHENTICATION: {
      MAX_LOGIN_ATTEMPTS: 5,
      LOCKOUT_DURATION: 300000,
    },
    BIOMETRIC: {
      REASON: 'Please verify your identity',
      FALLBACK_TITLE: 'Use Password',
      CANCEL_TITLE: 'Cancel',
    },
  },
  STORAGE_KEYS: {
    USER_DATA: 'userData',
    USER_TOKEN: 'userToken',
    BIOMETRIC_ENABLED: 'biometricEnabled',
  },
  ERROR_MESSAGES: {
    AUTH_FAILED: 'Authentication failed',
    BIOMETRIC_NOT_AVAILABLE: 'Biometric authentication not available',
  },
  DATABASE_CONFIG: {
    NAME: 'wenting.db',
    LOCATION: 'default',
    TABLE_NAMES: {
      USERS: 'users',
      HOUSEHOLDS: 'households',
      HOUSEHOLD_MEMBERS: 'household_members',
      HEALTH_RECORDS: 'health_records',
      REMINDERS: 'reminders',
      HEALTH_CALENDAR: 'health_calendar',
      AUDIT_LOGS: 'audit_logs',
    },
  },
}));

// Mock types
jest.mock('@types/index', () => ({
  UserRole: {
    ADMIN: 'admin',
    MEMBER: 'member',
  },
}));

// Mock EncryptionManager
jest.mock('@utils/encryption/EncryptionManager', () => ({
  EncryptionManager: {
    encryptHealthData: jest.fn((data) => Promise.resolve({ encrypted: data })),
    decryptHealthData: jest.fn((data) => Promise.resolve(data.encrypted || data)),
  },
}));

// Global test environment setup
global.console = {
  ...console,
  // Suppress console.log in tests unless needed for debugging
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Mock fetch for network requests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
) as jest.Mock;

// Set up fake timers if needed
// jest.useFakeTimers();

export {};