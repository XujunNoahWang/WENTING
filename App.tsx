import React from 'react';
import { StatusBar, StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { firebaseWebAuthService } from './src/config/firebase-web';

// Constants
const COLORS = {
  PRIMARY: '#007AFF',
  BACKGROUND: '#F2F2F7',
  SUCCESS: '#34C759',
  ERROR: '#FF3B30',
};

// Simple navigation state
const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = React.useState('login');
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [showRegister, setShowRegister] = React.useState(false);
  const [registerForm, setRegisterForm] = React.useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // 初始化 Firebase 并检查认证状态
  React.useEffect(() => {
    const initFirebase = async () => {
      try {
        setLoading(true);
        
        // 初始化 Firebase
        const initialized = await firebaseWebAuthService.initialize();
        
        if (initialized) {
          // 监听认证状态变化
          const unsubscribe = firebaseWebAuthService.onAuthStateChanged((user) => {
            if (user) {
              setUsername(user.displayName || user.email || 'User');
              setIsLoggedIn(true);
              setCurrentScreen('home');
              
              // 本地存储用户信息
              localStorage.setItem('wenting_user', JSON.stringify({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                emailVerified: user.emailVerified,
                provider: user.photoURL ? 'google' : 'email',
                loginTime: new Date().toISOString()
              }));
            } else {
              setIsLoggedIn(false);
              setCurrentScreen('login');
              localStorage.removeItem('wenting_user');
            }
            setLoading(false);
          });
          
          return unsubscribe;
        } else {
          // Firebase 初始化失败，使用本地存储检查
          console.warn('Firebase 未初始化，使用本地模式');
          checkStoredUser();
        }
      } catch (error) {
        console.error('Firebase 初始化错误:', error);
        checkStoredUser();
      }
    };

    const checkStoredUser = () => {
      try {
        const storedUser = localStorage.getItem('wenting_user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setUsername(userData.displayName || userData.email || 'User');
          setIsLoggedIn(true);
          setCurrentScreen('home');
        }
        setLoading(false);
      } catch (error) {
        console.error('检查存储用户失败:', error);
        setLoading(false);
      }
    };

    initFirebase();
  }, []);

  // 用户登录验证
  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('错误', '请输入用户名和密码');
      return;
    }

    setLoading(true);
    
    try {
      // 使用 Firebase 进行邮箱登录
      const result = await firebaseWebAuthService.signInWithEmail(username, password);
      
      if (result.success && result.user) {
        setUsername(result.user.displayName || result.user.email || 'User');
        setIsLoggedIn(true);
        setCurrentScreen('home');
        Alert.alert('成功', `欢迎回来！`);
      } else {
        // Firebase 登录失败，尝试本地登录（演示模式）
        await handleLocalLogin();
      }
    } catch (error) {
      console.error('Firebase 登录错误:', error);
      // 退回到本地登录
      await handleLocalLogin();
    }
    
    setLoading(false);
  };

  // 本地登录（演示模式）
  const handleLocalLogin = async () => {
    // 检查预设账号或已注册用户
    const users = JSON.parse(localStorage.getItem('wenting_users') || '[]');
    const predefinedUsers = [
      { username: 'admin', password: '123456', fullName: '管理员', email: 'admin@wenting.com' },
      { username: 'demo', password: 'demo123', fullName: '演示用户', email: 'demo@wenting.com' }
    ];
    
    const allUsers = [...predefinedUsers, ...users];
    const user = allUsers.find(u => 
      (u.username?.toLowerCase() === username.toLowerCase() || u.email?.toLowerCase() === username.toLowerCase()) 
      && u.password === password
    );

    if (user) {
      // 存储用户会话
      localStorage.setItem('wenting_user', JSON.stringify({
        username: user.username || user.email,
        fullName: user.fullName,
        email: user.email,
        loginTime: new Date().toISOString(),
        mode: 'local'
      }));
      
      setIsLoggedIn(true);
      setCurrentScreen('home');
      Alert.alert('成功', `欢迎回来，${user.fullName}！\n\n注意：使用本地演示模式`);
    } else {
      Alert.alert('错误', '用户名或密码不正确\n\n可以尝试：\n1. 使用有效邮箱注册 Firebase 账户\n2. 使用演示账号：\n   - 用户名：admin 密码：123456\n   - 用户名：demo 密码：demo123');
    }
  };

  // 用户注册
  const handleRegister = async () => {
    const { fullName, email, password, confirmPassword } = registerForm;
    
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      Alert.alert('错误', '请填写所有字段');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('错误', '密码确认不匹配');
      return;
    }

    if (password.length < 6) {
      Alert.alert('错误', '密码长度至少6位');
      return;
    }

    setLoading(true);

    try {
      // 使用 Firebase 注册
      const result = await firebaseWebAuthService.createUserWithEmail(email, password, fullName);
      
      if (result.success && result.user) {
        // 创建用户文档到 Firestore
        await firebaseWebAuthService.createUserDocument(result.user.uid, {
          email: result.user.email,
          displayName: result.user.displayName,
          emailVerified: result.user.emailVerified
        });
        
        setUsername(result.user.displayName || result.user.email || 'User');
        setIsLoggedIn(true);
        setCurrentScreen('home');
        setShowRegister(false);
        Alert.alert('成功', '注册成功！欢迎使用 WENTING Firebase 版本\n\n用户数据已保存到 Firestore');
      } else {
        // Firebase 注册失败，尝试本地注册
        await handleLocalRegister();
      }
    } catch (error) {
      console.error('Firebase 注册错误:', error);
      await handleLocalRegister();
    }
    
    setLoading(false);
  };

  // 本地注册（演示模式）
  const handleLocalRegister = async () => {
    const { fullName, email } = registerForm;
    
    try {
      // 检查用户是否已存在
      const users = JSON.parse(localStorage.getItem('wenting_users') || '[]');
      const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      
      if (existingUser) {
        Alert.alert('错误', '该邮箱已被本地注册');
        return;
      }

      // 添加新用户
      const newUser = {
        id: Date.now().toString(),
        fullName,
        email,
        username: email.split('@')[0],
        password: registerForm.password,
        createdAt: new Date().toISOString()
      };

      users.push(newUser);
      localStorage.setItem('wenting_users', JSON.stringify(users));

      // 自动登录
      localStorage.setItem('wenting_user', JSON.stringify({
        username: newUser.username,
        fullName: newUser.fullName,
        email: newUser.email,
        loginTime: new Date().toISOString(),
        mode: 'local'
      }));

      setUsername(newUser.username);
      setIsLoggedIn(true);
      setCurrentScreen('home');
      setShowRegister(false);
      Alert.alert('成功', '本地注册成功！欢迎使用 WENTING 演示模式');
    } catch (error) {
      Alert.alert('错误', '注册失败，请重试');
    }
  };

  // Google 登录
  const handleGoogleLogin = async () => {
    setLoading(true);
    
    try {
      // 使用 Firebase Google 登录
      const result = await firebaseWebAuthService.signInWithGoogle();
      
      if (result.success && result.user) {
        setUsername(result.user.displayName || result.user.email || 'Google User');
        setIsLoggedIn(true);
        setCurrentScreen('home');
        Alert.alert('成功', 'Google 登录成功！');
      } else {
        // Firebase Google 登录失败，使用模拟登录
        await handleMockGoogleLogin();
      }
    } catch (error) {
      console.error('Firebase Google 登录错误:', error);
      await handleMockGoogleLogin();
    }
    
    setLoading(false);
  };

  // 模拟 Google 登录（演示模式）
  const handleMockGoogleLogin = async () => {
    const googleUser = {
      username: 'google_user',
      fullName: 'Google 演示用户',
      email: 'demo@gmail.com',
      loginTime: new Date().toISOString(),
      provider: 'google',
      mode: 'local'
    };

    localStorage.setItem('wenting_user', JSON.stringify(googleUser));
    setUsername(googleUser.fullName);
    setIsLoggedIn(true);
    setCurrentScreen('home');
    Alert.alert('成功', 'Google 登录成功！\n\n注意：使用演示模式');
  };

  const handleLogout = async () => {
    setLoading(true);
    
    try {
      // 从 Firebase 退出登录
      await firebaseWebAuthService.signOut();
    } catch (error) {
      console.error('Firebase 退出登录错误:', error);
    }
    
    // 清理本地状态
    localStorage.removeItem('wenting_user');
    setIsLoggedIn(false);
    setCurrentScreen('login');
    setUsername('');
    setPassword('');
    setShowRegister(false);
    setRegisterForm({
      fullName: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
    
    setLoading(false);
    Alert.alert('提示', '已成功退出登录');
  };

  const renderScreen = () => {
    // 如果未登录，显示登录界面
    if (!isLoggedIn && currentScreen === 'login') {
      return (
        <ScrollView style={styles.container} contentContainerStyle={styles.loginContainer}>
          <View style={styles.loginHeader}>
            <Text style={styles.appTitle}>WENTING</Text>
            <Text style={styles.appSubtitle}>家庭健康管理应用</Text>
          </View>

          <View style={styles.loginForm}>
            <Text style={styles.loginTitle}>{showRegister ? '注册账户' : '登录账户'}</Text>
            
            {showRegister && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>姓名</Text>
                <TextInput
                  style={styles.input}
                  value={registerForm.fullName}
                  onChangeText={(text) => setRegisterForm({...registerForm, fullName: text})}
                  placeholder="请输入您的姓名"
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{showRegister ? '邮箱' : '用户名/邮箱'}</Text>
              <TextInput
                style={styles.input}
                value={showRegister ? registerForm.email : username}
                onChangeText={showRegister ? 
                  (text) => setRegisterForm({...registerForm, email: text}) : 
                  setUsername
                }
                placeholder={showRegister ? "请输入邮箱地址" : "请输入用户名或邮箱"}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={showRegister ? "email-address" : "default"}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>密码</Text>
              <TextInput
                style={styles.input}
                value={showRegister ? registerForm.password : password}
                onChangeText={showRegister ? 
                  (text) => setRegisterForm({...registerForm, password: text}) : 
                  setPassword
                }
                placeholder="请输入密码"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {showRegister && (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>确认密码</Text>
                <TextInput
                  style={styles.input}
                  value={registerForm.confirmPassword}
                  onChangeText={(text) => setRegisterForm({...registerForm, confirmPassword: text})}
                  placeholder="请再次输入密码"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={showRegister ? handleRegister : handleLogin}
              disabled={loading}
            >
              <Text style={styles.loginButtonText}>
                {loading ? (showRegister ? '注册中...' : '登录中...') : (showRegister ? '注册' : '登录')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.googleButton, loading && styles.loginButtonDisabled]}
              onPress={handleGoogleLogin}
              disabled={loading}
            >
              <Text style={styles.googleButtonText}>
                {loading ? 'Google 登录中...' : '🔍 使用 Google 登录'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setShowRegister(!showRegister)}
              disabled={loading}
            >
              <Text style={styles.switchButtonText}>
                {showRegister ? '已有账户？点击登录' : '没有账户？点击注册'}
              </Text>
            </TouchableOpacity>

            {!showRegister && (
              <View style={styles.demoInfo}>
                <Text style={styles.demoTitle}>演示账号</Text>
                <Text style={styles.demoText}>管理员 - 用户名：admin 密码：123456</Text>
                <Text style={styles.demoText}>演示用户 - 用户名：demo 密码：demo123</Text>
              </View>
            )}
          </View>
        </ScrollView>
      );
    }
    switch (currentScreen) {
      case 'health':
        return (
          <View style={styles.screenContainer}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => setCurrentScreen('home')}
            >
              <Text style={styles.backButtonText}>← 返回</Text>
            </TouchableOpacity>
            <Text style={styles.screenTitle}>健康记录</Text>
            <Text style={styles.screenContent}>这里将显示健康记录功能</Text>
          </View>
        );
      case 'family':
        return (
          <View style={styles.screenContainer}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => setCurrentScreen('home')}
            >
              <Text style={styles.backButtonText}>← 返回</Text>
            </TouchableOpacity>
            <Text style={styles.screenTitle}>家庭成员</Text>
            <Text style={styles.screenContent}>这里将显示家庭成员管理功能</Text>
          </View>
        );
      case 'calendar':
        return (
          <View style={styles.screenContainer}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => setCurrentScreen('home')}
            >
              <Text style={styles.backButtonText}>← 返回</Text>
            </TouchableOpacity>
            <Text style={styles.screenTitle}>日历提醒</Text>
            <Text style={styles.screenContent}>这里将显示日历和提醒功能</Text>
          </View>
        );
      case 'settings':
        return (
          <View style={styles.screenContainer}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => setCurrentScreen('home')}
            >
              <Text style={styles.backButtonText}>← 返回</Text>
            </TouchableOpacity>
            <Text style={styles.screenTitle}>设置</Text>
            
            <View style={styles.settingsContainer}>
              <View style={styles.userInfo}>
                <Text style={styles.userInfoLabel}>账户信息</Text>
                <Text style={styles.userInfoValue}>用户名：{username}</Text>
                {(() => {
                  try {
                    const userData = JSON.parse(localStorage.getItem('wenting_user') || '{}');
                    return (
                      <>
                        {userData.fullName && <Text style={styles.userInfoValue}>姓名：{userData.fullName}</Text>}
                        {userData.email && <Text style={styles.userInfoValue}>邮箱：{userData.email}</Text>}
                        {userData.provider && <Text style={styles.userInfoValue}>登录方式：{userData.provider === 'google' ? 'Google 账户' : '普通账户'}</Text>}
                        {userData.loginTime && <Text style={styles.userInfoSecondary}>上次登录：{new Date(userData.loginTime).toLocaleString('zh-CN')}</Text>}
                      </>
                    );
                  } catch {
                    return null;
                  }
                })()}
              </View>

              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
              >
                <Text style={styles.logoutButtonText}>退出登录</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      default:
        return (
          <ScrollView style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>WENTING 健康管理</Text>
              <Text style={styles.subtitle}>家庭健康监督助手</Text>
            </View>
            
            <View style={styles.menuContainer}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setCurrentScreen('health')}
              >
                <Text style={styles.menuTitle}>健康记录</Text>
                <Text style={styles.menuSubtitle}>查看和管理健康数据</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setCurrentScreen('family')}
              >
                <Text style={styles.menuTitle}>家庭成员</Text>
                <Text style={styles.menuSubtitle}>管理家庭成员信息</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setCurrentScreen('calendar')}
              >
                <Text style={styles.menuTitle}>日历提醒</Text>
                <Text style={styles.menuSubtitle}>设置健康提醒</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setCurrentScreen('settings')}
              >
                <Text style={styles.menuTitle}>设置</Text>
                <Text style={styles.menuSubtitle}>应用设置和偏好</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={COLORS.BACKGROUND}
        translucent={false}
      />
      {renderScreen()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  menuContainer: {
    paddingHorizontal: 20,
  },
  menuItem: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
    padding: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: 10,
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
    marginBottom: 20,
    textAlign: 'center',
  },
  screenContent: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  // 登录界面样式
  loginContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
    marginBottom: 8,
  },
  appSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  loginForm: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  loginButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  demoInfo: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.PRIMARY,
  },
  demoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.PRIMARY,
    marginBottom: 8,
  },
  demoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  switchButtonText: {
    color: COLORS.PRIMARY,
    fontSize: 16,
    fontWeight: '500',
  },
  // 设置页面样式
  settingsContainer: {
    flex: 1,
    paddingTop: 20,
  },
  userInfo: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  userInfoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  userInfoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  userInfoSecondary: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  logoutButton: {
    backgroundColor: COLORS.ERROR,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;