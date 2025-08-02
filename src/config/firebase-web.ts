// Firebase Web 配置 - 专门用于 Web 平台
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider, updateProfile } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, addDoc, getDoc, getDocs, serverTimestamp, deleteDoc, query, where } from 'firebase/firestore';

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

// 请求批处理器
class RequestBatcher {
  private batches = new Map<string, Promise<any>>();

  async batchRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.batches.has(key)) {
      console.log(`Reusing existing request for key: ${key}`);
      return this.batches.get(key);
    }

    const promise = requestFn();
    this.batches.set(key, promise);
    
    // 清理已完成的请求
    promise.finally(() => {
      setTimeout(() => this.batches.delete(key), 100);
    });

    return promise;
  }
}

// Firebase Web 认证服务
export class FirebaseWebAuthService {
  private static instance: FirebaseWebAuthService;
  private requestBatcher = new RequestBatcher();
  
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

  // 清空所有Firebase数据 (仅用于测试)
  async clearAllData() {
    try {
      console.log('开始清空Firebase数据...');
      
      // 删除所有健康记录
      const healthRecordsSnapshot = await getDocs(collection(db, 'health_records'));
      const deleteHealthPromises = healthRecordsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteHealthPromises);
      console.log(`已删除 ${healthRecordsSnapshot.docs.length} 条健康记录`);
      
      // 删除所有家庭成员关系
      const householdMembersSnapshot = await getDocs(collection(db, 'household_members'));
      const deleteMemberPromises = householdMembersSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteMemberPromises);
      console.log(`已删除 ${householdMembersSnapshot.docs.length} 条家庭成员关系`);
      
      // 删除所有家庭
      const householdsSnapshot = await getDocs(collection(db, 'households'));
      const deleteHouseholdPromises = householdsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteHouseholdPromises);
      console.log(`已删除 ${householdsSnapshot.docs.length} 个家庭`);
      
      // 删除所有用户文档 (保留认证用户)
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const deleteUserPromises = usersSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteUserPromises);
      console.log(`已删除 ${usersSnapshot.docs.length} 个用户文档`);
      
      console.log('Firebase数据清空完成!');
      return { success: true, message: 'Firebase数据已全部清空' };
    } catch (error) {
      console.error('清空Firebase数据失败:', error);
      return { success: false, error: error };
    }
  }
  
  // 创建文档 - 兼容FirebaseDatabaseService的接口
  async createDocument(collectionName: string, data: any, docId?: string) {
    try {
      if (docId) {
        await setDoc(doc(db, collectionName, docId), data);
      } else {
        const docRef = await addDoc(collection(db, collectionName), data);
        return docRef.id;
      }
      return docId;
    } catch (error) {
      console.error(`创建文档失败 (${collectionName}):`, error);
      throw error;
    }
  }

  // 查询文档 - 兼容FirebaseDatabaseService的接口
  async queryDocuments(collectionName: string, conditions: Array<{field: string, operator: string, value: any}>) {
    // 创建查询的唯一键用于批处理
    const queryKey = `${collectionName}:${JSON.stringify(conditions)}`;
    
    return this.requestBatcher.batchRequest(queryKey, async () => {
      try {
        let q = collection(db, collectionName);
        
        for (const condition of conditions) {
          q = query(q, where(condition.field, condition.operator as any, condition.value));
        }
        
        console.log(`Executing query for ${collectionName} with conditions:`, conditions);
        const querySnapshot = await getDocs(q);
        const results: any[] = [];
        
        querySnapshot.forEach((doc) => {
          results.push({ id: doc.id, ...doc.data() });
        });
        
        console.log(`Query completed for ${collectionName}, found ${results.length} documents`);
        return results;
      } catch (error) {
        console.error(`查询文档失败 (${collectionName}):`, error);
        throw error;
      }
    });
  }

  // 获取单个文档 - 兼容FirebaseDatabaseService的接口
  async getDocument(collectionName: string, docId: string) {
    try {
      const docSnap = await getDoc(doc(db, collectionName, docId));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      }
      return null;
    } catch (error) {
      console.error(`获取文档失败 (${collectionName}/${docId}):`, error);
      throw error;
    }
  }

  // 更新文档 - 兼容FirebaseDatabaseService的接口  
  async updateDocument(collectionName: string, docId: string, updates: any) {
    try {
      await setDoc(doc(db, collectionName, docId), updates, { merge: true });
    } catch (error) {
      console.error(`更新文档失败 (${collectionName}/${docId}):`, error);
      throw error;
    }
  }

  // 删除文档 - 兼容FirebaseDatabaseService的接口
  async deleteDocument(collectionName: string, docId: string) {
    try {
      await deleteDoc(doc(db, collectionName, docId));
    } catch (error) {
      console.error(`删除文档失败 (${collectionName}/${docId}):`, error);
      throw error;
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