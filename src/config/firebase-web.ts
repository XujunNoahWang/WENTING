// Firebase Web 配置 - 专门用于 Web 平台
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider, updateProfile } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, addDoc, getDoc, getDocs, serverTimestamp } from 'firebase/firestore';

// Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyBQHUptHEKoJiu5XCA9ZGmmGuYkdGi7Ubk",
  authDomain: "wenting-health-app.firebaseapp.com",
  projectId: "wenting-health-app",
  storageBucket: "wenting-health-app.firebasestorage.app",
  messagingSenderId: "879987592871",
  appId: "1:879987592871:web:fd14b280de87c9769ad582",
  measurementId: "G-B3FPN0HZH2"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Google 登录提供商
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Firebase Web 认证服务
export class FirebaseWebAuthService {
  private static instance: FirebaseWebAuthService;
  
  private constructor() {}
  
  static getInstance(): FirebaseWebAuthService {
    if (!FirebaseWebAuthService.instance) {
      FirebaseWebAuthService.instance = new FirebaseWebAuthService();
    }
    return FirebaseWebAuthService.instance;
  }
  
  async initialize() {
    try {
      console.log('Firebase Web 服务初始化成功');
      return true;
    } catch (error) {
      console.error('Firebase Web 服务初始化失败:', error);
      return false;
    }
  }
  
  // 邮箱登录
  async signInWithEmail(email: string, password: string) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified
        },
        message: '登录成功'
      };
    } catch (error: any) {
      console.error('邮箱登录失败:', error);
      return {
        success: false,
        error: this.formatErrorMessage(error)
      };
    }
  }
  
  // 邮箱注册
  async createUserWithEmail(email: string, password: string, displayName?: string) {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const user = result.user;
      
      // 更新用户显示名称
      if (displayName) {
        await updateProfile(user, { displayName });
      }
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified
        },
        message: '注册成功'
      };
    } catch (error: any) {
      console.error('邮箱注册失败:', error);
      return {
        success: false,
        error: this.formatErrorMessage(error)
      };
    }
  }
  
  // Google 登录
  async signInWithGoogle() {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified
        },
        message: 'Google登录成功'
      };
    } catch (error: any) {
      console.error('Google登录失败:', error);
      return {
        success: false,
        error: this.formatErrorMessage(error)
      };
    }
  }
  
  // 退出登录
  async signOut() {
    try {
      await signOut(auth);
      return {
        success: true,
        message: '退出登录成功'
      };
    } catch (error: any) {
      console.error('退出登录失败:', error);
      return {
        success: false,
        error: '退出登录失败'
      };
    }
  }
  
  // 密码重置
  async resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(auth, email);
      return {
        success: true,
        message: '密码重置邮件已发送'
      };
    } catch (error: any) {
      console.error('密码重置失败:', error);
      return {
        success: false,
        error: this.formatErrorMessage(error)
      };
    }
  }
  
  // 获取当前用户
  getCurrentUser() {
    const user = auth.currentUser;
    if (!user) return null;
    
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified
    };
  }
  
  // 监听认证状态变化
  onAuthStateChanged(callback: (user: any) => void) {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        callback({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified
        });
      } else {
        callback(null);
      }
    });
  }
  
  // 创建用户数据到 Firestore
  async createUserDocument(userId: string, userData: any) {
    try {
      await setDoc(doc(db, 'users', userId), {
        ...userData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('用户文档创建成功');
      return { success: true };
    } catch (error) {
      console.error('创建用户文档失败:', error);
      return { success: false, error: error };
    }
  }
  
  // 创建测试健康记录
  async createTestHealthRecord(userId: string) {
    try {
      const healthRecord = {
        userId: userId,
        title: '测试健康记录',
        description: '这是一个测试的健康记录',
        recordType: 'general',
        recordData: {
          bloodPressure: '120/80',
          heartRate: 72,
          temperature: 36.5
        },
        verified: false,
        createdBy: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'health_records'), healthRecord);
      console.log('测试健康记录创建成功，ID:', docRef.id);
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('创建测试健康记录失败:', error);
      return { success: false, error: error };
    }
  }
  
  // 创建测试家庭
  async createTestHousehold(userId: string) {
    try {
      const householdId = `household_${Date.now()}`;
      
      // 创建家庭文档
      await setDoc(doc(db, 'households', householdId), {
        id: householdId,
        name: '我的家庭',
        description: '这是一个测试家庭',
        createdBy: userId,
        createdAt: serverTimestamp()
      });
      
      // 创建家庭成员关系
      const membershipId = `${userId}_${householdId}`;
      await setDoc(doc(db, 'household_members', membershipId), {
        id: membershipId,
        householdId: householdId,
        userId: userId,
        role: 'admin',
        joinedAt: serverTimestamp()
      });
      
      console.log('测试家庭创建成功，ID:', householdId);
      return { success: true, id: householdId };
    } catch (error) {
      console.error('创建测试家庭失败:', error);
      return { success: false, error: error };
    }
  }
  
  // 获取用户数据
  async getUserData(userId: string) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        return { success: true, data: userDoc.data() };
      } else {
        return { success: false, error: '用户文档不存在' };
      }
    } catch (error) {
      console.error('获取用户数据失败:', error);
      return { success: false, error: error };
    }
  }
  
  // 获取所有健康记录
  async getHealthRecords() {
    try {
      const querySnapshot = await getDocs(collection(db, 'health_records'));
      const records: any[] = [];
      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
      });
      return { success: true, data: records };
    } catch (error) {
      console.error('获取健康记录失败:', error);
      return { success: false, error: error };
    }
  }
  
  // 格式化错误信息
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
      'auth/popup-closed-by-user': '用户关闭了登录窗口',
      'auth/cancelled-popup-request': '登录请求被取消'
    };
    
    return errorMessages[errorCode] || '操作失败，请稍后再试';
  }
}

// 导出单例实例
export const firebaseWebAuthService = FirebaseWebAuthService.getInstance();
export default firebaseWebAuthService;