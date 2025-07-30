// Firebase configuration for cross-platform support
import { Platform } from 'react-native';

// Firebase configuration - WENTING Health App
const firebaseConfig = {
  apiKey: "AIzaSyBQHUptHEKoJiu5XCA9ZGmmGuYkdGi7Ubk",
  authDomain: "wenting-health-app.firebaseapp.com",
  projectId: "wenting-health-app",
  storageBucket: "wenting-health-app.firebasestorage.app",
  messagingSenderId: "879987592871",
  appId: "1:879987592871:web:fd14b280de87c9769ad582",
  measurementId: "G-B3FPN0HZH2"
};

// Firebase instance and services
let app: any = null;
let auth: any = null;
let firestore: any = null;

// Platform-specific Firebase initialization
const initializeFirebase = async () => {
  try {
    if (Platform.OS === 'web') {
      // Web platform - use Firebase SDK
      const { initializeApp } = await import('firebase/app');
      const { getAuth, GoogleAuthProvider } = await import('firebase/auth');
      const { getFirestore } = await import('firebase/firestore');
      
      if (!app) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        firestore = getFirestore(app);
      }
      
      return { app, auth, firestore, GoogleAuthProvider };
    } else {
      // React Native platform - use React Native Firebase
      const firebaseApp = await import('@react-native-firebase/app');
      const firebaseAuth = await import('@react-native-firebase/auth');
      const firebaseFirestore = await import('@react-native-firebase/firestore');
      
      if (!app) {
        // Check if Firebase app is already initialized
        if (firebaseApp.default().apps.length === 0) {
          app = firebaseApp.default().initializeApp(firebaseConfig);
        } else {
          app = firebaseApp.default();
        }
        
        auth = firebaseAuth.default();
        firestore = firebaseFirestore.default();
      }
      
      return { app, auth, firestore };
    }
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
};

// Unified Firebase Auth API
export class FirebaseAuthService {
  private static instance: FirebaseAuthService;
  private authInstance: any = null;
  private firestoreInstance: any = null;
  
  private constructor() {}
  
  static getInstance(): FirebaseAuthService {
    if (!FirebaseAuthService.instance) {
      FirebaseAuthService.instance = new FirebaseAuthService();
    }
    return FirebaseAuthService.instance;
  }
  
  async initialize() {
    try {
      const firebase = await initializeFirebase();
      this.authInstance = firebase.auth;
      this.firestoreInstance = firebase.firestore;
      return true;
    } catch (error) {
      console.error('Firebase service initialization error:', error);
      return false;
    }
  }
  
  // Email/Password Authentication
  async signInWithEmail(email: string, password: string) {
    try {
      if (!this.authInstance) {
        throw new Error('Firebase not initialized');
      }
      
      let result;
      if (Platform.OS === 'web') {
        const { signInWithEmailAndPassword } = await import('firebase/auth');
        result = await signInWithEmailAndPassword(this.authInstance, email, password);
      } else {
        result = await this.authInstance.signInWithEmailAndPassword(email, password);
      }
      
      return {
        success: true,
        user: this.formatUser(result.user),
        message: '登录成功'
      };
    } catch (error: any) {
      console.error('Email sign-in error:', error);
      return {
        success: false,
        error: this.formatErrorMessage(error)
      };
    }
  }
  
  async createUserWithEmail(email: string, password: string, displayName?: string) {
    try {
      if (!this.authInstance) {
        throw new Error('Firebase not initialized');
      }
      
      let result;
      if (Platform.OS === 'web') {
        const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
        result = await createUserWithEmailAndPassword(this.authInstance, email, password);
        
        if (displayName && result.user) {
          await updateProfile(result.user, { displayName });
        }
      } else {
        result = await this.authInstance.createUserWithEmailAndPassword(email, password);
        
        if (displayName && result.user) {
          await result.user.updateProfile({ displayName });
        }
      }
      
      return {
        success: true,
        user: this.formatUser(result.user),
        message: '注册成功'
      };
    } catch (error: any) {
      console.error('Email registration error:', error);
      return {
        success: false,
        error: this.formatErrorMessage(error)
      };
    }
  }
  
  // Google Sign-In
  async signInWithGoogle() {
    try {
      if (!this.authInstance) {
        throw new Error('Firebase not initialized');
      }
      
      let result;
      if (Platform.OS === 'web') {
        const { signInWithPopup, GoogleAuthProvider } = await import('firebase/auth');
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        
        result = await signInWithPopup(this.authInstance, provider);
      } else {
        // React Native Google Sign-In
        const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
        const firebaseAuth = await import('@react-native-firebase/auth');
        
        await GoogleSignin.hasPlayServices();
        const userInfo = await GoogleSignin.signIn();
        
        if (!userInfo.idToken) {
          throw new Error('No ID token received from Google');
        }
        
        const googleCredential = firebaseAuth.default.GoogleAuthProvider.credential(userInfo.idToken);
        result = await this.authInstance.signInWithCredential(googleCredential);
      }
      
      return {
        success: true,
        user: this.formatUser(result.user),
        message: 'Google登录成功'
      };
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      return {
        success: false,
        error: this.formatErrorMessage(error)
      };
    }
  }
  
  // Sign Out
  async signOut() {
    try {
      if (!this.authInstance) {
        throw new Error('Firebase not initialized');
      }
      
      if (Platform.OS === 'web') {
        const { signOut } = await import('firebase/auth');
        await signOut(this.authInstance);
      } else {
        await this.authInstance.signOut();
        
        // Also sign out from Google if available
        try {
          const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
          await GoogleSignin.signOut();
        } catch (googleError) {
          console.log('Google sign out skipped:', googleError);
        }
      }
      
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
  
  // Password Reset
  async resetPassword(email: string) {
    try {
      if (!this.authInstance) {
        throw new Error('Firebase not initialized');
      }
      
      if (Platform.OS === 'web') {
        const { sendPasswordResetEmail } = await import('firebase/auth');
        await sendPasswordResetEmail(this.authInstance, email);
      } else {
        await this.authInstance.sendPasswordResetEmail(email);
      }
      
      return {
        success: true,
        message: '密码重置邮件已发送'
      };
    } catch (error: any) {
      console.error('Password reset error:', error);
      return {
        success: false,
        error: this.formatErrorMessage(error)
      };
    }
  }
  
  // Get Current User
  getCurrentUser() {
    if (!this.authInstance) {
      return null;
    }
    
    const user = this.authInstance.currentUser;
    return user ? this.formatUser(user) : null;
  }
  
  // Auth State Listener
  onAuthStateChanged(callback: (user: any) => void) {
    if (!this.authInstance) {
      return () => {};
    }
    
    if (Platform.OS === 'web') {
      return this.authInstance.onAuthStateChanged((user: any) => {
        callback(user ? this.formatUser(user) : null);
      });
    } else {
      return this.authInstance.onAuthStateChanged((user: any) => {
        callback(user ? this.formatUser(user) : null);
      });
    }
  }
  
  // Firestore Operations
  async createDocument(collection: string, doc: any, docId?: string) {
    try {
      if (!this.firestoreInstance) {
        throw new Error('Firestore not initialized');
      }
      
      if (Platform.OS === 'web') {
        const { collection: firestoreCollection, addDoc, doc: firestoreDoc, setDoc } = await import('firebase/firestore');
        
        if (docId) {
          const docRef = firestoreDoc(this.firestoreInstance, collection, docId);
          await setDoc(docRef, { ...doc, createdAt: new Date(), updatedAt: new Date() });
          return { id: docId, ...doc };
        } else {
          const collectionRef = firestoreCollection(this.firestoreInstance, collection);
          const docRef = await addDoc(collectionRef, { ...doc, createdAt: new Date(), updatedAt: new Date() });
          return { id: docRef.id, ...doc };
        }
      } else {
        if (docId) {
          await this.firestoreInstance.collection(collection).doc(docId).set({ 
            ...doc, 
            createdAt: new Date(), 
            updatedAt: new Date() 
          });
          return { id: docId, ...doc };
        } else {
          const docRef = await this.firestoreInstance.collection(collection).add({ 
            ...doc, 
            createdAt: new Date(), 
            updatedAt: new Date() 
          });
          return { id: docRef.id, ...doc };
        }
      }
    } catch (error: any) {
      console.error('Create document error:', error);
      throw error;
    }
  }
  
  async getDocument(collection: string, docId: string) {
    try {
      if (!this.firestoreInstance) {
        throw new Error('Firestore not initialized');
      }
      
      let docSnapshot;
      if (Platform.OS === 'web') {
        const { doc, getDoc } = await import('firebase/firestore');
        const docRef = doc(this.firestoreInstance, collection, docId);
        docSnapshot = await getDoc(docRef);
      } else {
        docSnapshot = await this.firestoreInstance.collection(collection).doc(docId).get();
      }
      
      if (docSnapshot.exists()) {
        return { id: docSnapshot.id, ...docSnapshot.data() };
      } else {
        return null;
      }
    } catch (error: any) {
      console.error('Get document error:', error);
      throw error;
    }
  }
  
  async updateDocument(collection: string, docId: string, updates: any) {
    try {
      if (!this.firestoreInstance) {
        throw new Error('Firestore not initialized');
      }
      
      const updateData = { ...updates, updatedAt: new Date() };
      
      if (Platform.OS === 'web') {
        const { doc, updateDoc } = await import('firebase/firestore');
        const docRef = doc(this.firestoreInstance, collection, docId);
        await updateDoc(docRef, updateData);
      } else {
        await this.firestoreInstance.collection(collection).doc(docId).update(updateData);
      }
      
      return true;
    } catch (error: any) {
      console.error('Update document error:', error);
      throw error;
    }
  }
  
  async deleteDocument(collection: string, docId: string) {
    try {
      if (!this.firestoreInstance) {
        throw new Error('Firestore not initialized');
      }
      
      if (Platform.OS === 'web') {
        const { doc, deleteDoc } = await import('firebase/firestore');
        const docRef = doc(this.firestoreInstance, collection, docId);
        await deleteDoc(docRef);
      } else {
        await this.firestoreInstance.collection(collection).doc(docId).delete();
      }
      
      return true;
    } catch (error: any) {
      console.error('Delete document error:', error);
      throw error;
    }
  }
  
  async queryDocuments(collection: string, conditions: Array<{field: string, operator: string, value: any}> = []) {
    try {
      if (!this.firestoreInstance) {
        throw new Error('Firestore not initialized');
      }
      
      let query;
      if (Platform.OS === 'web') {
        const { collection: firestoreCollection, query: firestoreQuery, where, getDocs } = await import('firebase/firestore');
        let q = firestoreCollection(this.firestoreInstance, collection);
        
        for (const condition of conditions) {
          q = firestoreQuery(q, where(condition.field, condition.operator as any, condition.value));
        }
        
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        query = this.firestoreInstance.collection(collection);
        
        for (const condition of conditions) {
          query = query.where(condition.field, condition.operator, condition.value);
        }
        
        const querySnapshot = await query.get();
        return querySnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      }
    } catch (error: any) {
      console.error('Query documents error:', error);
      throw error;
    }
  }
  
  // Helper methods
  private formatUser(user: any) {
    if (!user) return null;
    
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified,
      phoneNumber: user.phoneNumber
    };
  }
  
  private formatErrorMessage(error: any): string {
    const errorCode = error.code || error.message;
    
    const errorMessages: { [key: string]: string } = {
      'auth/user-not-found': '用户不存在',
      'auth/wrong-password': '密码错误',
      'auth/invalid-email': '邮箱格式无效',
      'auth/user-disabled': '账户已被禁用',
      'auth/email-already-in-use': '该邮箱已被注册',
      'auth/weak-password': '密码强度不够',
      'auth/too-many-requests': '请求过于频繁，请稍后再试',
      'auth/invalid-phone-number': '手机号格式无效',
      'auth/invalid-verification-code': '验证码无效',
      'auth/code-expired': '验证码已过期'
    };
    
    return errorMessages[errorCode] || '操作失败，请稍后再试';
  }
}

// Export singleton instance
export const firebaseAuthService = FirebaseAuthService.getInstance();
export default firebaseAuthService;