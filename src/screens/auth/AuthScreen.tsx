import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  StyleSheet 
} from 'react-native';
import { firebaseWebAuthService } from '../../config/firebase-web';
import FirebaseDatabaseService from '../../services/database/FirebaseDatabaseService';
import { performanceMonitor } from '../../utils/performance/PerformanceMonitor';
import { COLORS } from '../../constants/colors';
import { RegisterForm, FirebaseUser } from '../../types/appTypes';

interface AuthScreenProps {
  onLogin: (user: FirebaseUser) => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [showRegister, setShowRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    const startTime = Date.now();
    
    const unsubscribe = firebaseWebAuthService.onAuthStateChanged((user) => {
      if (user) {
        console.log('用户认证状态变化:', user);
        
        FirebaseDatabaseService.getDocument('users', user.uid)
          .then((userDoc) => {
            if (userDoc) {
              console.log('获取到完整用户文档:', userDoc);
              
              const completeUser = {
                ...user,
                ...userDoc,
                loginTime: new Date().toISOString(),
                provider: 'firebase',
                mode: 'existing'
              };
              
              onLogin(completeUser);
            } else {
              console.log('用户文档不存在，使用认证信息');
              
              const basicUser = {
                ...user,
                fullName: user.displayName || '',
                loginTime: new Date().toISOString(),
                provider: 'firebase',
                mode: 'basic'
              };
              
              onLogin(basicUser);
            }
          })
          .catch((error) => {
            console.error('获取用户文档失败:', error);
            
            const fallbackUser = {
              ...user,
              fullName: user.displayName || '',
              loginTime: new Date().toISOString(),
              provider: 'firebase',
              mode: 'fallback'
            };
            
            onLogin(fallbackUser);
          });
      }
    });

    const endTime = Date.now();
    performanceMonitor.recordMetric('auth_initialization', endTime - startTime);

    return unsubscribe;
  }, [onLogin]);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('提示', '请输入用户名和密码');
      return;
    }

    setLoading(true);
    const startTime = Date.now();

    try {
      let result;
      
      if (username.includes('@')) {
        result = await firebaseWebAuthService.signInWithEmail(username.trim(), password);
      } else {
        const possibleEmail = `${username.trim()}@wenting.com`;
        result = await firebaseWebAuthService.signInWithEmail(possibleEmail, password);
      }

      const endTime = Date.now();
      performanceMonitor.recordMetric('login_attempt', endTime - startTime);

      if (result.success && result.user) {
        console.log('登录成功:', result.user);
        performanceMonitor.recordMetric('login_success', 1);
      } else {
        Alert.alert('登录失败', result.error || '未知错误');
        performanceMonitor.recordMetric('login_failure', 1);
      }
    } catch (error) {
      console.error('登录过程中发生错误:', error);
      Alert.alert('登录失败', '网络连接异常，请稍后再试');
      performanceMonitor.recordMetric('login_error', 1);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const startTime = Date.now();

    try {
      const result = await firebaseWebAuthService.signInWithGoogle();
      
      const endTime = Date.now();
      performanceMonitor.recordMetric('google_login_attempt', endTime - startTime);

      if (result.success && result.user) {
        console.log('Google登录成功:', result.user);
        performanceMonitor.recordMetric('google_login_success', 1);
      } else {
        Alert.alert('Google登录失败', result.error || '未知错误');
        performanceMonitor.recordMetric('google_login_failure', 1);
      }
    } catch (error) {
      console.error('Google登录过程中发生错误:', error);
      Alert.alert('Google登录失败', '网络连接异常，请稍后再试');
      performanceMonitor.recordMetric('google_login_error', 1);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!registerForm.fullName.trim() || !registerForm.email.trim() || 
        !registerForm.password.trim() || !registerForm.confirmPassword.trim()) {
      Alert.alert('提示', '请填写所有必填字段');
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      Alert.alert('提示', '两次输入的密码不一致');
      return;
    }

    if (registerForm.password.length < 6) {
      Alert.alert('提示', '密码长度至少为6位');
      return;
    }

    setLoading(true);
    const startTime = Date.now();

    try {
      const result = await firebaseWebAuthService.createUserWithEmail(
        registerForm.email.trim(),
        registerForm.password,
        registerForm.fullName.trim()
      );

      const endTime = Date.now();
      performanceMonitor.recordMetric('register_attempt', endTime - startTime);

      if (result.success && result.user) {
        console.log('注册成功:', result.user);
        
        try {
          await FirebaseDatabaseService.createDocument('users', {
            uid: result.user.uid,
            email: result.user.email,
            fullName: registerForm.fullName.trim(),
            displayName: result.user.displayName || registerForm.fullName.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            preferences: {
              notifications: true,
              language: 'zh-CN',
              theme: 'light'
            }
          }, result.user.uid);
          
          console.log('用户文档创建成功');
        } catch (docError) {
          console.error('创建用户文档失败:', docError);
        }

        Alert.alert('注册成功', '账户创建成功，请登录', [
          { text: '确定', onPress: () => setShowRegister(false) }
        ]);
        
        performanceMonitor.recordMetric('register_success', 1);
      } else {
        Alert.alert('注册失败', result.error || '未知错误');
        performanceMonitor.recordMetric('register_failure', 1);
      }
    } catch (error) {
      console.error('注册过程中发生错误:', error);
      Alert.alert('注册失败', '网络连接异常，请稍后再试');
      performanceMonitor.recordMetric('register_error', 1);
    } finally {
      setLoading(false);
    }
  };

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
              onChangeText={(text) => setRegisterForm({ ...registerForm, fullName: text })}
              placeholder="请输入您的姓名"
              placeholderTextColor="#999"
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
              (text) => setRegisterForm({ ...registerForm, email: text }) :
              setUsername
            }
            placeholder={showRegister ? "请输入邮箱地址" : "请输入用户名或邮箱"}
            placeholderTextColor="#999"
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
              (text) => setRegisterForm({ ...registerForm, password: text }) :
              setPassword
            }
            placeholder="请输入密码"
            placeholderTextColor="#999"
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        {showRegister && (
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>确认密码</Text>
            <TextInput
              style={styles.input}
              value={registerForm.confirmPassword}
              onChangeText={(text) => setRegisterForm({ ...registerForm, confirmPassword: text })}
              placeholder="请再次输入密码"
              placeholderTextColor="#999"
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
        )}

        <TouchableOpacity 
          style={[styles.loginButton, loading && styles.disabledButton]}
          onPress={showRegister ? handleRegister : handleLogin}
          disabled={loading}
        >
          <Text style={styles.loginButtonText}>
            {loading ? '处理中...' : (showRegister ? '注册' : '登录')}
          </Text>
        </TouchableOpacity>

        {!showRegister && (
          <TouchableOpacity 
            style={[styles.googleButton, loading && styles.disabledButton]}
            onPress={handleGoogleLogin}
            disabled={loading}
          >
            <Text style={styles.googleButtonText}>使用 Google 登录</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity 
          style={styles.switchButton}
          onPress={() => setShowRegister(!showRegister)}
        >
          <Text style={styles.switchButtonText}>
            {showRegister ? '已有账户？点击登录' : '没有账户？点击注册'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loginContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 48,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  appSubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  loginForm: {
    width: '100%',
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.light,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  loginButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '600',
  },
  googleButton: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  googleButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  switchButton: {
    alignItems: 'center',
  },
  switchButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.6,
  },
});

export default AuthScreen;