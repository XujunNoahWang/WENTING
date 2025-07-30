// Firebase 配置文件
// 使用 CDN 方式加载 Firebase，避免 npm 安装问题

// Firebase 配置 - WENTING Health App
const firebaseConfig = {
  apiKey: "AIzaSyBQHUptHEKoJiu5XCA9ZGmmGuYkdGi7Ubk",
  authDomain: "wenting-health-app.firebaseapp.com",
  projectId: "wenting-health-app",
  storageBucket: "wenting-health-app.firebasestorage.app",
  messagingSenderId: "879987592871",
  appId: "1:879987592871:web:fd14b280de87c9769ad582",
  measurementId: "G-B3FPN0HZH2"
};

// 全局 Firebase 实例
let auth = null;
let googleProvider = null;

// 初始化 Firebase（从 CDN 加载）
const initializeFirebase = () => {
  // 检查 Firebase 是否已加载
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK 未加载，请确保在 HTML 中包含 Firebase CDN');
    return false;
  }

  try {
    // 初始化 Firebase
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    
    // 初始化认证服务
    auth = firebase.auth();
    
    // 配置 Google 登录提供商
    googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
    
    console.log('Firebase 初始化成功');
    return true;
  } catch (error) {
    console.error('Firebase 初始化失败:', error);
    return false;
  }
};

// Firebase 认证 API
const FirebaseAuth = {
  // 初始化
  init: initializeFirebase,
  
  // Google 登录
  signInWithGoogle: async () => {
    try {
      if (!auth || !googleProvider) {
        throw new Error('Firebase 未初始化');
      }
      
      const result = await auth.signInWithPopup(googleProvider);
      const user = result.user;
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified
        }
      };
    } catch (error) {
      console.error('Google 登录失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  // 邮箱注册
  createUserWithEmail: async (email, password, displayName) => {
    try {
      if (!auth) {
        throw new Error('Firebase 未初始化');
      }
      
      const result = await auth.createUserWithEmailAndPassword(email, password);
      const user = result.user;
      
      // 更新用户显示名称
      if (displayName) {
        await user.updateProfile({
          displayName: displayName
        });
      }
      
      // 发送邮箱验证
      await user.sendEmailVerification();
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified
        }
      };
    } catch (error) {
      console.error('邮箱注册失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  // 邮箱登录
  signInWithEmail: async (email, password) => {
    try {
      if (!auth) {
        throw new Error('Firebase 未初始化');
      }
      
      const result = await auth.signInWithEmailAndPassword(email, password);
      const user = result.user;
      
      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified
        }
      };
    } catch (error) {
      console.error('邮箱登录失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  // 退出登录
  signOut: async () => {
    try {
      if (!auth) {
        throw new Error('Firebase 未初始化');
      }
      
      await auth.signOut();
      return { success: true };
    } catch (error) {
      console.error('退出登录失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  // 获取当前用户
  getCurrentUser: () => {
    if (!auth) return null;
    
    const user = auth.currentUser;
    if (!user) return null;
    
    return {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      emailVerified: user.emailVerified
    };
  },
  
  // 监听认证状态变化
  onAuthStateChanged: (callback) => {
    if (!auth) return () => {};
    
    return auth.onAuthStateChanged((user) => {
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
  },
  
  // 发送密码重置邮件
  resetPassword: async (email) => {
    try {
      if (!auth) {
        throw new Error('Firebase 未初始化');
      }
      
      await auth.sendPasswordResetEmail(email);
      return { success: true };
    } catch (error) {
      console.error('发送密码重置邮件失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

// 导出 Firebase 认证 API
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FirebaseAuth;
} else {
  window.FirebaseAuth = FirebaseAuth;
}