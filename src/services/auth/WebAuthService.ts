import { Platform } from 'react-native';
import { User, LoginForm, RegisterForm, ApiResponse } from '@types/index';
import { SECURITY_CONFIG, STORAGE_KEYS, ERROR_MESSAGES } from '@constants/index';
import FirebaseDatabaseService from '@services/database/FirebaseDatabaseService';
import { firebaseAuthService } from '@config/firebase';

// Web-compatible storage
const storage = {
  getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
  setItem: (key: string, value: string) => Promise.resolve(localStorage.setItem(key, value)),
  removeItem: (key: string) => Promise.resolve(localStorage.removeItem(key)),
};

export class WebAuthService {
  private static instance: WebAuthService;
  private loginAttempts: Map<string, number> = new Map();
  private lockoutTimers: Map<string, NodeJS.Timeout> = new Map();

  private constructor() {
    this.initializeServices();
  }

  static getInstance(): WebAuthService {
    if (!WebAuthService.instance) {
      WebAuthService.instance = new WebAuthService();
    }
    return WebAuthService.instance;
  }

  private async initializeServices(): Promise<void> {
    try {
      // Initialize Firebase auth service
      await firebaseAuthService.initialize();
      await FirebaseDatabaseService.initialize();
    } catch (error) {
      console.error('Service initialization error:', error);
    }
  }

  async signInWithEmail(email: string, password: string): Promise<ApiResponse<User>> {
    try {
      // Check for account lockout
      if (this.isAccountLocked(email)) {
        return {
          success: false,
          error: '账户已被锁定，请稍后再试'
        };
      }

      // Use Firebase auth service
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

  async getCurrentUser(): Promise<User | null> {
    try {
      const userData = await storage.getItem(STORAGE_KEYS.USER_DATA);
      
      if (userData) {
        return JSON.parse(userData);
      }

      // Fallback to Firebase current user
      const firebaseUser = firebaseAuthService.getCurrentUser();
      if (firebaseUser) {
        return await FirebaseDatabaseService.getUserById(firebaseUser.uid);
      }

      return null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const user = await this.getCurrentUser();
      return user !== null;
    } catch (error) {
      console.error('Authentication check error:', error);
      return false;
    }
  }

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

  // Biometric methods - not supported on web
  async enableBiometricAuth(userId: string): Promise<ApiResponse<boolean>> {
    return {
      success: false,
      error: 'Web平台不支持生物识别'
    };
  }

  async authenticateWithBiometrics(): Promise<ApiResponse<boolean>> {
    return {
      success: false,
      error: 'Web平台不支持生物识别'
    };
  }

  async signInWithPhoneNumber(phoneNumber: string): Promise<ApiResponse<any>> {
    return {
      success: false,
      error: 'Web平台暂不支持手机号登录'
    };
  }

  async verifyPhoneCode(confirmationResult: any, code: string): Promise<ApiResponse<User>> {
    return {
      success: false,
      error: 'Web平台暂不支持手机号登录'
    };
  }

  // Private helper methods
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
    await storage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    await storage.setItem(STORAGE_KEYS.USER_TOKEN, firebaseUid);
  }

  private async clearUserSession(): Promise<void> {
    await storage.removeItem(STORAGE_KEYS.USER_DATA);
    await storage.removeItem(STORAGE_KEYS.USER_TOKEN);
    await storage.removeItem(STORAGE_KEYS.BIOMETRIC_ENABLED);
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

export default WebAuthService.getInstance();