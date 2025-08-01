import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '@types/index';
import FirebaseDatabaseService from '@services/database/FirebaseDatabaseService';
import { firebaseAuthService } from '@config/firebase';

interface TestAuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const TestAuthContext = createContext<TestAuthContextType | undefined>(undefined);

export const useTestAuth = () => {
  const context = useContext(TestAuthContext);
  if (context === undefined) {
    throw new Error('useTestAuth must be used within a TestAuthProvider');
  }
  return context;
};

interface TestAuthProviderProps {
  children: React.ReactNode;
}

export const TestAuthProvider: React.FC<TestAuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      
      // Initialize Firebase services
      await firebaseAuthService.initialize();
      await FirebaseDatabaseService.initialize();
      
      // Check if user is already authenticated
      const currentUser = firebaseAuthService.getCurrentUser();
      if (currentUser) {
        // Get user data from database
        const userData = await FirebaseDatabaseService.getUserById(currentUser.uid);
        if (userData) {
          setUser(userData);
        } else {
          // Create user in database if doesn't exist
          const newUser: Omit<User, 'createdAt' | 'updatedAt'> = {
            id: currentUser.uid,
            email: currentUser.email || undefined,
            fullName: currentUser.displayName || 'Test User',
            avatarUrl: currentUser.photoURL || undefined,
            biometricEnabled: false,
          };
          
          await FirebaseDatabaseService.createUser(newUser);
          
          // Get the created user
          const createdUser = await FirebaseDatabaseService.getUserById(currentUser.uid);
          setUser(createdUser);
        }
      } else {
        // Auto-login for testing with a mock user
        await autoLoginForTesting();
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      // Create a mock user for testing
      await createMockUser();
    } finally {
      setIsLoading(false);
    }
  };

  const autoLoginForTesting = async () => {
    try {
      // Try to sign in with Google for testing
      const result = await firebaseAuthService.signInWithGoogle();
      if (result.success && result.user) {
        const userData = await FirebaseDatabaseService.getUserById(result.user.uid);
        if (userData) {
          setUser(userData);
        } else {
          // Create user in database
          const newUser: Omit<User, 'createdAt' | 'updatedAt'> = {
            id: result.user.uid,
            email: result.user.email || undefined,
            fullName: result.user.displayName || 'Test User',
            avatarUrl: result.user.photoURL || undefined,
            biometricEnabled: false,
          };
          
          await FirebaseDatabaseService.createUser(newUser);
          const createdUser = await FirebaseDatabaseService.getUserById(result.user.uid);
          setUser(createdUser);
        }
      }
    } catch (error) {
      console.log('Auto-login failed, creating mock user');
      await createMockUser();
    }
  };

  const createMockUser = async () => {
    // Create a mock user for testing
    const mockUser: User = {
      id: 'test-user-' + Date.now(),
      email: 'test@example.com',
      fullName: 'Test User',
      biometricEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    setUser(mockUser);
  };

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      
      const result = await firebaseAuthService.signInWithGoogle();
      if (result.success && result.user) {
        let userData = await FirebaseDatabaseService.getUserById(result.user.uid);
        
        if (!userData) {
          // Create user in database
          const newUser: Omit<User, 'createdAt' | 'updatedAt'> = {
            id: result.user.uid,
            email: result.user.email || undefined,
            fullName: result.user.displayName || 'User',
            avatarUrl: result.user.photoURL || undefined,
            biometricEnabled: false,
          };
          
          await FirebaseDatabaseService.createUser(newUser);
          userData = await FirebaseDatabaseService.getUserById(result.user.uid);
        }
        
        setUser(userData);
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      await firebaseAuthService.signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const value: TestAuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    signInWithGoogle,
    signOut,
  };

  return (
    <TestAuthContext.Provider value={value}>
      {children}
    </TestAuthContext.Provider>
  );
};

export default TestAuthProvider;