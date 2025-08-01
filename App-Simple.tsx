import React from 'react';
import { StatusBar, StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { firebaseWebAuthService } from './src/config/firebase-web';

// 类型定义
interface User {
  uid?: string;
  email?: string;
  displayName?: string;
  username?: string;
  fullName?: string;
  loginTime?: string;
  provider?: string;
  mode?: string;
}

interface HouseholdMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  relationship: string;
  role: 'admin' | 'member';
  joinedAt: string;
  updatedAt?: string;
}

interface Household {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  members: HouseholdMember[];
}

interface RegisterForm {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface HouseholdForm {
  name: string;
  description: string;
}

interface MemberForm {
  name: string;
  email: string;
  phone: string;
  relationship: string;
  role: 'admin' | 'member';
}

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
  const [registerForm, setRegisterForm] = React.useState<RegisterForm>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  // 家庭管理相关状态
  const [households, setHouseholds] = React.useState<Household[]>([]);
  const [currentHousehold, setCurrentHousehold] = React.useState<Household | null>(null);
  const [householdMembers, setHouseholdMembers] = React.useState<HouseholdMember[]>([]);
  const [showCreateHousehold, setShowCreateHousehold] = React.useState(false);
  const [showAddMember, setShowAddMember] = React.useState(false);
  const [editingMember, setEditingMember] = React.useState<HouseholdMember | null>(null);
  const [householdForm, setHouseholdForm] = React.useState<HouseholdForm>({
    name: '',
    description: ''
  });
  const [memberForm, setMemberForm] = React.useState<MemberForm>({
    name: '',
    email: '',
    phone: '',
    relationship: '家人',
    role: 'member'
  });
  const [fieldErrors, setFieldErrors] = React.useState({
    householdName: false,
    memberName: false,
    memberEmail: false
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [memberToDelete, setMemberToDelete] = React.useState<HouseholdMember | null>(null);

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
              
              // 存储用户信息
              localStorage.setItem('wenting_user', JSON.stringify({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                fullName: user.displayName,
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
          // Firebase 初始化失败
          console.error('Firebase 未初始化，无法使用应用功能');
          setLoading(false);
        }
      } catch (error) {
        console.error('Firebase 初始化错误:', error);
        setLoading(false);
      }
    };


    initFirebase();
  }, []);

  // 加载家庭数据
  React.useEffect(() => {
    if (isLoggedIn) {
      loadHouseholds();
    }
  }, [isLoggedIn]);

  // 加载用户的家庭列表
  const loadHouseholds = async () => {
    try {
      // 从Firebase加载家庭数据
      const currentUser = JSON.parse(localStorage.getItem('wenting_user') || '{}');
      
      if (!currentUser.uid) {
        console.warn('用户未登录或没有用户ID');
        return;
      }

      // 这里应该调用Firebase API获取用户的家庭列表
      // 暂时使用本地存储作为缓存，但数据应该来自Firebase
      const storedHouseholds = localStorage.getItem(`wenting_households_${currentUser.uid}`);
      
      if (storedHouseholds) {
        const userHouseholds = JSON.parse(storedHouseholds);
        setHouseholds(userHouseholds);
        
        // 如果有家庭，设置第一个为当前家庭
        if (userHouseholds.length > 0) {
          setCurrentHousehold(userHouseholds[0]);
          loadHouseholdMembers(userHouseholds[0].id);
        }
      }
    } catch (error) {
      console.error('加载家庭数据失败:', error);
    }
  };

  // 加载家庭成员
  const loadHouseholdMembers = async (householdId: string) => {
    try {
      console.log('加载家庭成员，householdId:', householdId);
      const currentUser = JSON.parse(localStorage.getItem('wenting_user') || '{}');
      
      if (!currentUser.uid) {
        console.warn('用户未登录');
        return;
      }

      const storedHouseholds = localStorage.getItem(`wenting_households_${currentUser.uid}`);
      if (storedHouseholds) {
        const allHouseholds = JSON.parse(storedHouseholds);
        console.log('用户家庭数据:', allHouseholds);
        const household = allHouseholds.find((h: any) => h.id === householdId);
        console.log('找到的家庭:', household);
        if (household && household.members) {
          console.log('设置家庭成员:', household.members);
          setHouseholdMembers(household.members);
        } else {
          console.log('未找到家庭或成员数据');
          setHouseholdMembers([]);
        }
      }
    } catch (error) {
      console.error('加载家庭成员失败:', error);
    }
  };

  // 创建家庭
  const handleCreateHousehold = async () => {
    if (!householdForm.name.trim()) {
      setFieldErrors({...fieldErrors, householdName: true});
      Alert.alert('请完善信息', '• 请输入家庭名称\n\n家庭名称是必填项，用于标识您的家庭。');
      return;
    } else {
      setFieldErrors({...fieldErrors, householdName: false});
    }

    // 检查用户是否已经创建过家庭
    const currentUser = JSON.parse(localStorage.getItem('wenting_user') || '{}');
    
    if (!currentUser.uid) {
      alert('错误：用户未登录');
      return;
    }

    const storedHouseholds = localStorage.getItem(`wenting_households_${currentUser.uid}`);
    if (storedHouseholds) {
      const userHouseholds = JSON.parse(storedHouseholds);
      
      if (userHouseholds.length > 0) {
        alert('提示：您已经创建过家庭了。每个用户只能创建一个家庭。');
        setShowCreateHousehold(false);
        return;
      }
    }

    setLoading(true);
    try {
      const householdId = `household_${Date.now()}`;
      
      const newHousehold = {
        id: householdId,
        name: householdForm.name.trim(),
        description: householdForm.description.trim(),
        createdBy: currentUser.uid,
        createdAt: new Date().toISOString(),
        members: [{
          id: `member_${Date.now()}`,
          name: currentUser.displayName || currentUser.fullName || currentUser.email,
          email: currentUser.email || '',
          phone: '',
          relationship: '户主',
          role: 'admin' as const,
          joinedAt: new Date().toISOString()
        }]
      };

      // 保存到用户特定的本地存储
      const userHouseholds = [newHousehold];
      localStorage.setItem(`wenting_households_${currentUser.uid}`, JSON.stringify(userHouseholds));

      // 更新状态
      setHouseholds([...households, newHousehold]);
      setCurrentHousehold(newHousehold);
      setHouseholdMembers(newHousehold.members);
      
      // 重置表单
      setHouseholdForm({ name: '', description: '' });
      setShowCreateHousehold(false);
      
      alert('成功：家庭创建成功！');
      
      // 同步到Firebase
      try {
        await firebaseWebAuthService.createTestHousehold(currentUser.uid);
        console.log('家庭数据已同步到Firebase');
      } catch (error) {
        console.warn('Firebase同步失败，数据仅保存在本地:', error);
      }
      
    } catch (error) {
      console.error('创建家庭失败:', error);
      Alert.alert('错误', '创建家庭失败，请重试');
    }
    setLoading(false);
  };

  // 添加家庭成员
  const handleAddMember = async () => {
    
    // 详细的表单验证
    const errors = [];
    const newFieldErrors = { ...fieldErrors };
    
    if (!memberForm.name.trim()) {
      errors.push('• 请填写成员姓名');
      newFieldErrors.memberName = true;
    } else {
      newFieldErrors.memberName = false;
    }
    
    if (!memberForm.email.trim()) {
      errors.push('• 请填写成员邮箱');
      newFieldErrors.memberEmail = true;
    } else if (!/\S+@\S+\.\S+/.test(memberForm.email.trim())) {
      errors.push('• 请填写有效的邮箱地址');
      newFieldErrors.memberEmail = true;
    } else {
      newFieldErrors.memberEmail = false;
    }
    
    setFieldErrors(newFieldErrors);
    
    if (errors.length > 0) {
      Alert.alert('请完善以下信息', errors.join('\n'));
      return;
    }

    // 检查是否有当前家庭
    if (!currentHousehold) {
      Alert.alert('错误', '请先选择或创建一个家庭');
      return;
    }

    // 检查成员是否已存在（排除编辑状态下的当前成员）
    const existingMember = householdMembers.find(m => 
      m.email.toLowerCase() === memberForm.email.toLowerCase() && 
      (!editingMember || m.id !== editingMember.id)
    );
    if (existingMember) {
      Alert.alert('错误', '该成员已在家庭中');
      return;
    }

    setLoading(true);
    try {
      const newMember = {
        id: `member_${Date.now()}`,
        name: memberForm.name.trim(),
        email: memberForm.email.trim(),
        phone: memberForm.phone.trim(),
        relationship: memberForm.relationship,
        role: memberForm.role,
        joinedAt: new Date().toISOString()
      };

      // 更新本地存储
      const currentUser = JSON.parse(localStorage.getItem('wenting_user') || '{}');
      const storedHouseholds = localStorage.getItem(`wenting_households_${currentUser.uid}`);
      const allHouseholds = JSON.parse(storedHouseholds || '[]');
      const householdIndex = allHouseholds.findIndex((h: any) => h.id === currentHousehold.id);
      
      if (householdIndex !== -1) {
        // 更新本地存储
        allHouseholds[householdIndex].members.push(newMember);
        localStorage.setItem(`wenting_households_${currentUser.uid}`, JSON.stringify(allHouseholds));
        
        // 更新状态
        const updatedMembers = [...householdMembers, newMember];
        setHouseholdMembers(updatedMembers);
        
        // 重置表单并关闭弹窗
        setMemberForm({
          name: '',
          email: '',
          phone: '',
          relationship: '家人',
          role: 'member'
        });
        setShowAddMember(false);
        
        
        alert('成功：家庭成员添加成功！');
      } else {
        alert('错误：找不到当前家庭，请刷新页面重试');
      }
    } catch (error) {
      console.error('添加成员失败:', error);
      alert('错误：添加成员失败，请重试');
    }
    setLoading(false);
  };

  // 编辑家庭成员
  const handleEditMember = (member: HouseholdMember) => {
    setEditingMember(member);
    setMemberForm({
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      relationship: member.relationship || '家人',
      role: member.role || 'member'
    });
    setShowAddMember(true);
  };

  // 更新家庭成员
  const handleUpdateMember = async () => {
    // 详细的表单验证
    const errors = [];
    if (!memberForm.name.trim()) {
      errors.push('• 请填写成员姓名');
    }
    if (!memberForm.email.trim()) {
      errors.push('• 请填写成员邮箱');
    } else if (!/\S+@\S+\.\S+/.test(memberForm.email.trim())) {
      errors.push('• 请填写有效的邮箱地址');
    }
    
    if (errors.length > 0) {
      Alert.alert('请完善以下信息', errors.join('\n'));
      return;
    }

    if (!currentHousehold || !editingMember) {
      Alert.alert('错误', '更新失败，请重试');
      return;
    }

    setLoading(true);
    try {
      const updatedMember = {
        ...editingMember,
        name: memberForm.name.trim(),
        email: memberForm.email.trim(),
        phone: memberForm.phone.trim(),
        relationship: memberForm.relationship,
        role: memberForm.role,
        updatedAt: new Date().toISOString()
      };

      // 更新本地存储
      const currentUser = JSON.parse(localStorage.getItem('wenting_user') || '{}');
      const storedHouseholds = localStorage.getItem(`wenting_households_${currentUser.uid}`);
      const allHouseholds = JSON.parse(storedHouseholds || '[]');
      const householdIndex = allHouseholds.findIndex((h: any) => h.id === currentHousehold.id);
      
      if (householdIndex !== -1) {
        const memberIndex = allHouseholds[householdIndex].members.findIndex((m: any) => m.id === editingMember.id);
        if (memberIndex !== -1) {
          allHouseholds[householdIndex].members[memberIndex] = updatedMember;
          localStorage.setItem(`wenting_households_${currentUser.uid}`, JSON.stringify(allHouseholds));
          
          // 更新状态
          const updatedMembers = householdMembers.map((m: HouseholdMember) => 
            m.id === editingMember.id ? updatedMember : m
          );
          setHouseholdMembers(updatedMembers);
          
          // 同时更新当前家庭数据
          const updatedHousehold = { ...currentHousehold, members: updatedMembers };
          setCurrentHousehold(updatedHousehold);
          
          // 重置表单
          setMemberForm({
            name: '',
            email: '',
            phone: '',
            relationship: '家人',
            role: 'member'
          });
          setEditingMember(null);
          setShowAddMember(false);
          
          alert('成功：成员信息更新成功！');
        } else {
          alert('错误：找不到要更新的成员');
        }
      } else {
        alert('错误：找不到当前家庭');
      }
    } catch (error) {
      console.error('更新成员失败:', error);
      alert('错误：更新成员失败，请重试');
    }
    setLoading(false);
  };

  // 删除家庭成员
  const handleDeleteMember = (member: HouseholdMember) => {
    console.log('删除成员函数被调用，成员信息:', member);
    console.log('当前家庭成员列表:', householdMembers);
    
    // 使用自定义确认弹窗
    setMemberToDelete(member);
    setShowDeleteConfirm(true);
  };

  // 确认删除成员
  const confirmDeleteMember = async () => {
    if (!memberToDelete) return;
    
    console.log('用户确认删除，开始执行删除操作');
    setLoading(true);
    setShowDeleteConfirm(false);
    
    try {
      if (!currentHousehold) {
        alert('错误：找不到当前家庭');
        return;
      }

      console.log('开始删除成员:', memberToDelete.name);

      // 更新本地存储
      const currentUser = JSON.parse(localStorage.getItem('wenting_user') || '{}');
      const storedHouseholds = localStorage.getItem(`wenting_households_${currentUser.uid}`);
      const allHouseholds = JSON.parse(storedHouseholds || '[]');
      console.log('从存储加载的用户家庭:', allHouseholds);
      
      const householdIndex = allHouseholds.findIndex((h: any) => h.id === currentHousehold.id);
      console.log('找到的家庭索引:', householdIndex);
      
      if (householdIndex !== -1) {
        console.log('删除前的成员列表:', allHouseholds[householdIndex].members);
        const originalMemberCount = allHouseholds[householdIndex].members.length;
        
        allHouseholds[householdIndex].members = allHouseholds[householdIndex].members.filter((m: any) => m.id !== memberToDelete.id);
        const newMemberCount = allHouseholds[householdIndex].members.length;
        
        console.log('删除后的成员列表:', allHouseholds[householdIndex].members);
        console.log(`成员数量从 ${originalMemberCount} 减少到 ${newMemberCount}`);
        
        if (originalMemberCount === newMemberCount) {
          console.error('删除失败：成员数量没有变化');
          alert('错误：删除失败，成员可能不存在');
          return;
        }
        
        localStorage.setItem(`wenting_households_${currentUser.uid}`, JSON.stringify(allHouseholds));
        console.log('本地存储更新完成');
        
        // 更新状态
        const updatedMembers = householdMembers.filter((m: HouseholdMember) => m.id !== memberToDelete.id);
        console.log('更新状态中的成员列表:', updatedMembers);
        setHouseholdMembers(updatedMembers);
        
        // 同时更新当前家庭数据
        const updatedHousehold = { ...currentHousehold, members: updatedMembers };
        setCurrentHousehold(updatedHousehold);
        
        // 重新加载家庭成员列表以确保同步
        await loadHouseholdMembers(currentHousehold.id);
        
        alert(`成功：${memberToDelete.name} 已从家庭中移除`);
        console.log('删除操作完成');
      } else {
        console.error('找不到当前家庭，householdIndex:', householdIndex);
        alert('错误：找不到当前家庭，请刷新页面重试');
      }
    } catch (error) {
      console.error('删除成员失败:', error);
      alert('错误：删除成员失败，请重试');
    } finally {
      setLoading(false);
      setMemberToDelete(null);
    }
  };

  // 取消删除
  const cancelDeleteMember = () => {
    console.log('用户取消删除操作');
    setShowDeleteConfirm(false);
    setMemberToDelete(null);
  };

  // 用户登录验证
  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      alert('错误：请输入用户名和密码');
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
        alert('成功：欢迎回来！');
      } else {
        alert(`登录失败：${result.error || '请检查用户名和密码'}`);
      }
    } catch (error) {
      console.error('Firebase 登录错误:', error);
      alert('登录失败：网络错误或服务不可用，请稍后重试');
    }
    
    setLoading(false);
  };

  // 用户注册
  const handleRegister = async () => {
    const { fullName, email, password, confirmPassword } = registerForm;
    
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      alert('错误：请填写所有字段');
      return;
    }

    if (password !== confirmPassword) {
      alert('错误：密码确认不匹配');
      return;
    }

    if (password.length < 6) {
      alert('错误：密码长度至少6位');
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
        alert('成功：注册成功！欢迎使用 WENTING');
      } else {
        alert(`注册失败：${result.error || '请检查网络连接'}`);
      }
    } catch (error) {
      console.error('Firebase 注册错误:', error);
      alert('注册失败：网络错误或服务不可用，请稍后重试');
    }
    
    setLoading(false);
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
        alert('成功：Google 登录成功！');
      } else {
        alert(`Google登录失败：${result.error || 'Google服务不可用'}`);
      }
    } catch (error) {
      console.error('Firebase Google 登录错误:', error);
      alert('Google登录失败：请检查网络连接或稍后重试');
    }
    
    setLoading(false);
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
                  (text) => setRegisterForm({...registerForm, email: text}) : 
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
                  (text) => setRegisterForm({...registerForm, password: text}) : 
                  setPassword
                }
                placeholder="请输入密码"
                placeholderTextColor="#999"
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
                  placeholderTextColor="#999"
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
          <ScrollView style={styles.screenContainer}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={() => setCurrentScreen('home')}
            >
              <Text style={styles.backButtonText}>← 返回</Text>
            </TouchableOpacity>
            <Text style={styles.screenTitle}>家庭成员管理</Text>
            
            {/* 如果没有家庭，显示创建家庭界面 */}
            {households.length === 0 ? (
              <View style={styles.noHouseholdContainer}>
                <Text style={styles.noHouseholdTitle}>还没有家庭</Text>
                <Text style={styles.noHouseholdText}>创建你的第一个家庭，开始管理家庭成员健康信息</Text>
                
                <TouchableOpacity
                  style={styles.createHouseholdButton}
                  onPress={() => setShowCreateHousehold(true)}
                >
                  <Text style={styles.createHouseholdButtonText}>+ 创建我的家庭</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* 如果有家庭，显示家庭成员列表 */
              <View>
                {/* 家庭信息卡片 */}
                <View style={styles.householdCard}>
                  <Text style={styles.householdName}>{currentHousehold?.name || '我的家庭'}</Text>
                  {currentHousehold?.description ? (
                    <Text style={styles.householdDescription}>{currentHousehold.description}</Text>
                  ) : null}
                  <Text style={styles.householdInfo}>
                    创建于 {currentHousehold && currentHousehold.createdAt ? new Date(currentHousehold.createdAt).toLocaleDateString('zh-CN') : '未知'}
                  </Text>
                </View>

                {/* 成员统计 */}
                <View style={styles.memberStatsContainer}>
                  <Text style={styles.memberStatsText}>
                    共 {householdMembers.length} 位成员
                  </Text>
                  <TouchableOpacity
                    style={styles.addMemberButton}
                    onPress={() => {
                      // 重置编辑状态和表单数据
                      setEditingMember(null);
                      setMemberForm({
                        name: '',
                        email: '',
                        phone: '',
                        relationship: '家人',
                        role: 'member'
                      });
                      setShowAddMember(true);
                    }}
                  >
                    <Text style={styles.addMemberButtonText}>+ 添加成员</Text>
                  </TouchableOpacity>
                </View>

                {/* 成员列表 */}
                <View style={styles.membersList}>
                  {householdMembers.map((member, index) => {
                    if (!member || !member.id) {
                      console.error('Invalid member data:', member);
                      return null;
                    }
                    return (
                    <View key={member.id} style={styles.memberCard}>
                      <View style={styles.memberInfo}>
                        <View style={styles.memberHeader}>
                          <Text style={styles.memberName}>{member.name}</Text>
                          <View style={styles.memberBadges}>
                            <Text style={[
                              styles.memberBadge, 
                              member.role === 'admin' ? styles.adminBadge : styles.memberBadge
                            ]}>
                              {member.role === 'admin' ? '管理员' : '成员'}
                            </Text>
                            <Text style={styles.relationshipBadge}>{member.relationship || '家人'}</Text>
                          </View>
                        </View>
                        
                        <Text style={styles.memberEmail}>{member.email || ''}</Text>
                        {member.phone && <Text style={styles.memberPhone}>📞 {member.phone}</Text>}
                        <Text style={styles.memberJoinDate}>
                          加入时间：{member && member.joinedAt ? new Date(member.joinedAt).toLocaleDateString('zh-CN') : '未知'}
                        </Text>
                      </View>
                      
                      <View style={styles.memberActions}>
                        <TouchableOpacity
                          style={styles.editButton}
                          onPress={() => {
                            console.log('编辑成员，成员详情:', member);
                            handleEditMember(member);
                          }}
                        >
                          <Text style={styles.editButtonText}>编辑</Text>
                        </TouchableOpacity>
                        
                        {member.role !== 'admin' ? (
                          <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={() => {
                              console.log('准备删除成员:', member);
                              handleDeleteMember(member);
                            }}
                          >
                            <Text style={styles.deleteButtonText}>移除</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.adminOnlyContainer}>
                            <Text style={styles.adminOnlyText}>管理员不可移除</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    );
                  })}
                </View>

              </View>
            )}

            {/* 创建家庭模态框 */}
            {showCreateHousehold && (
              <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                  <ScrollView style={styles.modalScrollView}>
                    <Text style={styles.modalTitle}>创建家庭</Text>
                    
                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>家庭名称 *</Text>
                      <TextInput
                        style={[styles.input, fieldErrors.householdName && styles.inputError]}
                        value={householdForm.name || ''}
                        onChangeText={(text) => {
                          setHouseholdForm({...householdForm, name: text});
                          if (fieldErrors.householdName && text.trim()) {
                            setFieldErrors({...fieldErrors, householdName: false});
                          }
                        }}
                        placeholder="例如：张家、我们的家庭"
                        placeholderTextColor="#999"
                        autoCapitalize="words"
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>家庭描述（可选）</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        value={householdForm.description || ''}
                        onChangeText={(text) => setHouseholdForm({...householdForm, description: text})}
                        placeholder="简单描述这个家庭..."
                        placeholderTextColor="#999"
                        multiline
                        numberOfLines={3}
                      />
                    </View>
                  </ScrollView>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setShowCreateHousehold(false);
                        setHouseholdForm({ name: '', description: '' });
                      }}
                    >
                      <Text style={styles.cancelButtonText}>取消</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.confirmButton, loading && styles.disabledButton]}
                      onPress={handleCreateHousehold}
                      disabled={loading}
                    >
                      <Text style={styles.confirmButtonText}>
                        {loading ? '创建中...' : '创建家庭'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* 添加/编辑成员模态框 */}
            {showAddMember && (
              <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                  <ScrollView style={styles.modalScrollView}>
                    <Text style={styles.modalTitle}>
                      {editingMember ? '编辑成员' : '添加家庭成员'}
                    </Text>
                  
                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>姓名 *</Text>
                    <TextInput
                      style={[styles.input, fieldErrors.memberName && styles.inputError]}
                      value={memberForm.name || ''}
                      onChangeText={(text) => {
                        setMemberForm({...memberForm, name: text});
                        if (fieldErrors.memberName && text.trim()) {
                          setFieldErrors({...fieldErrors, memberName: false});
                        }
                      }}
                      placeholder="成员姓名"
                      placeholderTextColor="#999"
                      autoCapitalize="words"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>邮箱 *</Text>
                    <TextInput
                      style={[styles.input, fieldErrors.memberEmail && styles.inputError]}
                      value={memberForm.email || ''}
                      onChangeText={(text) => {
                        setMemberForm({...memberForm, email: text});
                        if (fieldErrors.memberEmail && text.trim()) {
                          setFieldErrors({...fieldErrors, memberEmail: false});
                        }
                      }}
                      placeholder="email@example.com"
                      placeholderTextColor="#999"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>手机号</Text>
                    <TextInput
                      style={styles.input}
                      value={memberForm.phone || ''}
                      onChangeText={(text) => setMemberForm({...memberForm, phone: text})}
                      placeholder="手机号码"
                      placeholderTextColor="#999"
                      keyboardType="phone-pad"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>关系</Text>
                    <View style={styles.pickerContainer}>
                      {['父亲', '母亲', '儿子', '女儿', '爷爷', '奶奶', '外公', '外婆', '配偶', '家人', '其他'].map((rel) => (
                        <TouchableOpacity
                          key={rel}
                          style={[
                            styles.pickerOption,
                            (memberForm.relationship || '家人') === rel && styles.pickerOptionSelected
                          ]}
                          onPress={() => setMemberForm({...memberForm, relationship: rel})}
                        >
                          <Text style={[
                            styles.pickerOptionText,
                            (memberForm.relationship || '家人') === rel && styles.pickerOptionTextSelected
                          ]}>
                            {rel}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>权限</Text>
                    <View style={styles.pickerContainer}>
                      <TouchableOpacity
                        style={[
                          styles.pickerOption,
                          (memberForm.role || 'member') === 'member' && styles.pickerOptionSelected
                        ]}
                        onPress={() => setMemberForm({...memberForm, role: 'member'})}
                      >
                        <Text style={[
                          styles.pickerOptionText,
                          (memberForm.role || 'member') === 'member' && styles.pickerOptionTextSelected
                        ]}>
                          普通成员
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.pickerOption,
                          (memberForm.role || 'member') === 'admin' && styles.pickerOptionSelected
                        ]}
                        onPress={() => setMemberForm({...memberForm, role: 'admin'})}
                      >
                        <Text style={[
                          styles.pickerOptionText,
                          (memberForm.role || 'member') === 'admin' && styles.pickerOptionTextSelected
                        ]}>
                          管理员
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  </ScrollView>
                  
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => {
                        setShowAddMember(false);
                        setEditingMember(null);
                        setMemberForm({
                          name: '',
                          email: '',
                          phone: '',
                          relationship: '家人',
                          role: 'member'
                        });
                      }}
                    >
                      <Text style={styles.cancelButtonText}>取消</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.confirmButton, loading && styles.disabledButton]}
                      onPress={editingMember ? handleUpdateMember : handleAddMember}
                      disabled={loading}
                    >
                      <Text style={styles.confirmButtonText}>
                        {loading ? (editingMember ? '更新中...' : '添加中...') : (editingMember ? '更新成员' : '添加成员')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            {/* 删除确认弹窗 */}
            {showDeleteConfirm && memberToDelete && (
              <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                  <View style={styles.modalScrollView}>
                    <Text style={styles.modalTitle}>确认删除</Text>
                    <Text style={styles.deleteConfirmText}>
                      确定要将 {memberToDelete.name} 从家庭中移除吗？
                    </Text>
                    <Text style={styles.deleteWarningText}>
                      这个操作无法撤销。
                    </Text>
                  </View>
                  
                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={cancelDeleteMember}
                      disabled={loading}
                    >
                      <Text style={styles.cancelButtonText}>取消</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.deleteConfirmButton, loading && styles.disabledButton]}
                      onPress={confirmDeleteMember}
                      disabled={loading}
                    >
                      <Text style={styles.deleteConfirmButtonText}>
                        {loading ? '删除中...' : '删除'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
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
    color: '#333',
  },
  inputError: {
    borderColor: COLORS.ERROR,
    backgroundColor: '#fff5f5',
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
  
  // 家庭管理样式
  noHouseholdContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 20,
  },
  noHouseholdTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  noHouseholdText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  createHouseholdButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createHouseholdButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // 家庭卡片
  householdCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  householdName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
    marginBottom: 8,
  },
  householdDescription: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
    lineHeight: 22,
  },
  householdInfo: {
    fontSize: 14,
    color: '#999',
  },
  
  // 成员统计
  memberStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  memberStatsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  addMemberButton: {
    backgroundColor: COLORS.SUCCESS,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addMemberButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // 成员列表
  membersList: {
    marginBottom: 20,
  },
  memberCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  memberInfo: {
    flex: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  memberBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  memberBadge: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    fontWeight: '500',
  },
  adminBadge: {
    backgroundColor: '#fff3e0',
    color: '#f57c00',
  },
  relationshipBadge: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#f3e5f5',
    color: '#7b1fa2',
    fontWeight: '500',
  },
  memberEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  memberPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  memberJoinDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: COLORS.ERROR,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  adminOnlyContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#f0f0f0',
  },
  adminOnlyText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
  },
  
  // 家庭操作
  householdActions: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  
  // 模态框样式
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 20,
    maxHeight: '80%',
    minWidth: 300,
    overflow: 'hidden',
  },
  modalScrollView: {
    paddingHorizontal: 24,
    paddingTop: 24,
    maxHeight: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  
  // 选择器样式
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pickerOptionSelected: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  pickerOptionTextSelected: {
    color: '#fff',
  },
  
  // 删除确认弹窗样式
  deleteConfirmText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
  },
  deleteWarningText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  deleteConfirmButton: {
    flex: 1,
    backgroundColor: COLORS.ERROR,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;