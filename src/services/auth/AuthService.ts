import { Platform } from 'react-native';
import TouchID from 'react-native-touch-id';
import EncryptedStorage from 'react-native-encrypted-storage';
import { User, LoginForm, RegisterForm, ApiResponse } from '../../types/index';
import { SECURITY_CONFIG, STORAGE_KEYS, ERROR_MESSAGES } from '../../constants/index';
import FirebaseDatabaseService from '../database/FirebaseDatabaseService';
import { EncryptionManager } from '../../utils/encryption/EncryptionManager';
import { firebaseAuthService } from '../../config/firebase';

export class AuthService {
  private static instance: AuthService;
  private loginAttempts: Map<string, number> = new Map();
  private lockoutTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.initializeServices();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Initialize Firebase and Google Sign-In
   */
  private async initializeServices(): Promise<void> {
    try {
      // Check if firebaseAuthService is available
      if (!firebaseAuthService || typeof firebaseAuthService.initialize !== 'function') {
        console.warn('Firebase auth service not available, some features may not work');
        return;
      }
      
      // Initialize Firebase auth service
      const initialized = await firebaseAuthService.initialize();
      if (!initialized) {
        console.warn('Firebase initialization failed, some features may not work');
      }
      
      // Initialize Google Sign-In for React Native
      if (Platform.OS !== 'web') {
        try {
          const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
          GoogleSignin.configure({
            webClientId: process.env.GOOGLE_WEB_CLIENT_ID,
            iosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
            offlineAccess: true,
            hostedDomain: '',
            forceCodeForRefreshToken: true,
          });
        } catch (googleError) {
          console.warn('Google Sign-In configuration failed:', googleError);
        }
      }
    } catch (error) {
      console.error('Service initialization error:', error);
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<ApiResponse<User>> {
    try {
      // Check for account lockout
      if (this.isAccountLocked(email)) {
        return {
          success: false,
          error: '账户已被锁定，请稍后再试'
        };
      }

      // Use Firebase auth service (with safety check)
      if (!firebaseAuthService || typeof firebaseAuthService.signInWithEmail !== 'function') {
        return {
          success: false,
          error: 'Firebase服务不可用'
        };
      }
      
      const firebaseResult = await firebaseAuthService.signInWithEmail(email, password);
      
      if (!firebaseResult.success || !firebaseResult.user) {
        this.recordFailedAttempt(email);
        return {
          success: false,
          error: firebaseResult.error || ERROR_MESSAGES.AUTH_FAILED
        };
      }

      // Get user from database
      let user = await FirebaseDatabaseService.getUserByEmail(email);

      if (!user) {
        // Create user in database if doesn't exist
        user = await this.createUserInDatabase(firebaseResult.user);
      }

      // Clear failed login attempts on successful login
      this.clearFailedAttempts(email);

      // Store user session
      await this.storeUserSession(user, firebaseResult.user.uid);

      return {
        success: true,
        data: user,
        message: '登录成功'
      };

    } catch (error: any) {
      console.error('Email sign-in error:', error);
      this.recordFailedAttempt(email);

      return {
        success: false,
        error: ERROR_MESSAGES.AUTH_FAILED
      };
    }
  }

  /**
   * Sign in with phone number
   */
  async signInWithPhoneNumber(phoneNumber: string): Promise<ApiResponse<any>> {
    try {
      // Phone number authentication is not supported in Web environment
      if (Platform.OS === 'web') {
        return {
          success: false,
          error: 'Web环境不支持手机号登录，请使用邮箱或Google登录'
        };
      }

      // For React Native, use Firebase phone auth
      const { default: auth } = await import('@react-native-firebase/auth');
      const confirmation = await auth().signInWithPhoneNumber(phoneNumber);
      
      return {
        success: true,
        data: {
          confirmationResult: confirmation,
          phoneNumber
        },
        message: '验证码已发送'
      };

    } catch (error: any) {
      console.error('Phone sign-in error:', error);
      
      let errorMessage = ERROR_MESSAGES.AUTH_FAILED;
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = '手机号格式无效';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = '请求过于频繁，请稍后再试';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Verify phone number with SMS code
   */
  async verifyPhoneCode(confirmationResult: any, code: string): Promise<ApiResponse<User>> {
    try {
      const userCredential = await confirmationResult.confirm(code);
      const firebaseUser = userCredential.user;

      if (!firebaseUser) {
        return {
          success: false,
          error: ERROR_MESSAGES.AUTH_FAILED
        };
      }

      // Get or create user in database
      let user = await FirebaseDatabaseService.getUserById(firebaseUser.uid);

      if (!user) {
        user = await this.createUserInDatabase(firebaseUser);
      }

      // Store user session
      await this.storeUserSession(user, firebaseUser.uid);

      return {
        success: true,
        data: user,
        message: '手机号验证成功'
      };

    } catch (error: any) {
      console.error('Phone verification error:', error);
      
      let errorMessage = '验证码错误';
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = '验证码无效';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = '验证码已过期';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<ApiResponse<User>> {
    try {
      // Use Firebase auth service for Google sign-in
      const firebaseResult = await firebaseAuthService.signInWithGoogle();
      
      if (!firebaseResult.success || !firebaseResult.user) {
        return {
          success: false,
          error: firebaseResult.error || 'Google登录失败'
        };
      }

      // Get or create user in database
      let user = await FirebaseDatabaseService.getUserById(firebaseResult.user.uid);

      if (!user) {
        user = await this.createUserInDatabase(firebaseResult.user);
      }

      // Store user session
      await this.storeUserSession(user, firebaseResult.user.uid);

      return {
        success: true,
        data: user,
        message: 'Google登录成功'
      };

    } catch (error: any) {
      console.error('Google sign-in error:', error);
      
      return {
        success: false,
        error: 'Google登录失败'
      };
    }
  }

  /**
   * Register with email and password
   */
  async registerWithEmail(registerForm: RegisterForm): Promise<ApiResponse<User>> {
    try {
      const { email, password, fullName } = registerForm;

      // Check if user already exists
      const existingUser = await FirebaseDatabaseService.getUserByEmail(email!);
      if (existingUser) {
        return {
          success: false,
          error: '该邮箱已被注册'
        };
      }

      // Use Firebase auth service for registration
      const firebaseResult = await firebaseAuthService.createUserWithEmail(email!, password!, fullName);
      
      if (!firebaseResult.success || !firebaseResult.user) {
        return {
          success: false,
          error: firebaseResult.error || '注册失败'
        };
      }

      // Create user in database
      const user = await this.createUserInDatabase(firebaseResult.user, null, fullName);

      // Store user session
      await this.storeUserSession(user, firebaseResult.user.uid);

      return {
        success: true,
        data: user,
        message: '注册成功'
      };

    } catch (error: any) {
      console.error('Registration error:', error);
      
      return {
        success: false,
        error: '注册失败'
      };
    }
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<ApiResponse<void>> {
    try {
      // Use Firebase auth service for sign out
      const firebaseResult = await firebaseAuthService.signOut();
      
      if (!firebaseResult.success) {
        return {
          success: false,
          error: firebaseResult.error || '退出登录失败'
        };
      }

      // Clear stored session
      await this.clearUserSession();

      return {
        success: true,
        message: '退出登录成功'
      };

    } catch (error: any) {
      console.error('Sign out error:', error);
      return {
        success: false,
        error: '退出登录失败'
      };
    }
  }

  /**
   * Enable biometric authentication
   */
  async enableBiometricAuth(userId: string): Promise<ApiResponse<boolean>> {
    try {
      const biometryType = await TouchID.isSupported();
      
      if (!biometryType) {
        return {
          success: false,
          error: ERROR_MESSAGES.BIOMETRIC_NOT_AVAILABLE
        };
      }

      // Test biometric authentication
      await TouchID.authenticate(SECURITY_CONFIG.BIOMETRIC.REASON, {
        title: 'WENTING',
        fallbackTitle: SECURITY_CONFIG.BIOMETRIC.FALLBACK_TITLE,
        cancelTitle: SECURITY_CONFIG.BIOMETRIC.CANCEL_TITLE,
        imageColor: '#007AFF',
        sensorDescription: '请使用生物识别验证',
        sensorErrorDescription: '验证失败',
        unifiedErrors: false,
      });

      // Update user biometric setting in database
      await FirebaseDatabaseService.updateUser(userId, { biometricEnabled: true });

      // Store biometric preference
      await EncryptedStorage.setItem(STORAGE_KEYS.BIOMETRIC_ENABLED, 'true');

      return {
        success: true,
        data: true,
        message: '生物识别已启用'
      };

    } catch (error: any) {
      console.error('Biometric setup error:', error);
      
      let errorMessage = '生物识别设置失败';
      if (error.name === 'UserCancel') {
        errorMessage = '用户取消生物识别设置';
      } else if (error.name === 'UserFallback') {
        errorMessage = '用户选择使用密码';
      } else if (error.name === 'SystemCancel') {
        errorMessage = '系统取消生物识别';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Authenticate with biometrics
   */
  async authenticateWithBiometrics(): Promise<ApiResponse<boolean>> {
    try {
      const biometricEnabled = await EncryptedStorage.getItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
      
      if (biometricEnabled !== 'true') {
        return {
          success: false,
          error: '生物识别未启用'
        };
      }

      await TouchID.authenticate(SECURITY_CONFIG.BIOMETRIC.REASON, {
        title: 'WENTING',
        fallbackTitle: SECURITY_CONFIG.BIOMETRIC.FALLBACK_TITLE,
        cancelTitle: SECURITY_CONFIG.BIOMETRIC.CANCEL_TITLE,
        imageColor: '#007AFF',
        sensorDescription: '请使用生物识别验证身份',
        sensorErrorDescription: '验证失败，请重试',
        unifiedErrors: false,
      });

      return {
        success: true,
        data: true,
        message: '生物识别验证成功'
      };

    } catch (error: any) {
      console.error('Biometric authentication error:', error);
      
      let errorMessage = '生物识别验证失败';
      if (error.name === 'UserCancel') {
        errorMessage = '用户取消验证';
      } else if (error.name === 'UserFallback') {
        return {
          success: false,
          error: 'fallback_to_password'
        };
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const userData = await EncryptedStorage.getItem(STORAGE_KEYS.USER_DATA);
      
      if (userData) {
        return JSON.parse(userData);
      }

      // Fallback to Firebase current user (with safety check)
      if (firebaseAuthService && typeof firebaseAuthService.getCurrentUser === 'function') {
        const firebaseUser = firebaseAuthService.getCurrentUser();
        if (firebaseUser) {
          return await FirebaseDatabaseService.getUserById(firebaseUser.uid);
        }
      }

      return null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      return user !== null;
    } catch (error) {
      console.error('Authentication check error:', error);
      return false;
    }
  }

  /**
   * Reset password
   */
  async resetPassword(email: string): Promise<ApiResponse<void>> {
    try {
      // Use Firebase auth service for password reset
      const firebaseResult = await firebaseAuthService.resetPassword(email);
      
      return firebaseResult;
    } catch (error: any) {
      console.error('Password reset error:', error);
      
      return {
        success: false,
        error: '密码重置失败'
      };
    }
  }

  /**
   * Private helper methods
   */
  private async createUserInDatabase(
    firebaseUser: any, 
    googleUser?: any,
    fullName?: string
  ): Promise<User> {
    const user: Omit<User, 'createdAt' | 'updatedAt'> = {
      id: firebaseUser.uid,
      email: firebaseUser.email || undefined,
      phoneNumber: firebaseUser.phoneNumber || undefined,
      googleId: googleUser?.id || undefined,
      fullName: fullName || firebaseUser.displayName || googleUser?.name || 'Unknown',
      avatarUrl: firebaseUser.photoURL || googleUser?.photo || undefined,
      biometricEnabled: false,
    };

    await FirebaseDatabaseService.createUser(user);
    
    return {
      ...user,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private async storeUserSession(user: User, firebaseUid: string): Promise<void> {
    await EncryptedStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    await EncryptedStorage.setItem(STORAGE_KEYS.USER_TOKEN, firebaseUid);
  }

  private async clearUserSession(): Promise<void> {
    await EncryptedStorage.removeItem(STORAGE_KEYS.USER_DATA);
    await EncryptedStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
    await EncryptedStorage.removeItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
  }

  private recordFailedAttempt(identifier: string): void {
    const attempts = this.loginAttempts.get(identifier) || 0;
    this.loginAttempts.set(identifier, attempts + 1);

    if (attempts + 1 >= SECURITY_CONFIG.AUTHENTICATION.MAX_LOGIN_ATTEMPTS) {
      this.lockAccount(identifier);
    }
  }

  private clearFailedAttempts(identifier: string): void {
    this.loginAttempts.delete(identifier);
    
    const timer = this.lockoutTimers.get(identifier);
    if (timer) {
      clearTimeout(timer);
      this.lockoutTimers.delete(identifier);
    }
  }

  private lockAccount(identifier: string): void {
    const timer = setTimeout(() => {
      this.loginAttempts.delete(identifier);
      this.lockoutTimers.delete(identifier);
    }, SECURITY_CONFIG.AUTHENTICATION.LOCKOUT_DURATION);

    this.lockoutTimers.set(identifier, timer);
  }

  private isAccountLocked(identifier: string): boolean {
    const attempts = this.loginAttempts.get(identifier) || 0;
    return attempts >= SECURITY_CONFIG.AUTHENTICATION.MAX_LOGIN_ATTEMPTS;
  }
}

export default AuthService.getInstance();