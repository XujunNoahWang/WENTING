import React from 'react';
import { StatusBar, StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { firebaseWebAuthService } from './src/config/firebase-web';
import { GeminiService } from './src/services/gemini/GeminiService';
import HealthRecordService from './src/services/health/HealthRecordService';
import FirebaseDatabaseService from './src/services/database/FirebaseDatabaseService';
import { UserRole, User, Household, HouseholdMember, HealthRecordData } from './src/types/index';
import { performanceMonitor } from './src/utils/performance/PerformanceMonitor';

// 本地枚举和接口定义
enum HealthRecordType {
  MEDICATION = 'medication',
  DIAGNOSIS = 'diagnosis',
  ALLERGY = 'allergy',
  VACCINATION = 'vaccination',
  VITAL_SIGNS = 'vital_signs',
  LAB_RESULT = 'lab_result',
  MEDICAL_HISTORY = 'medical_history'
}

interface FirebaseUser {
  uid?: string;
  email?: string;
  displayName?: string;
  username?: string;
  fullName?: string;
  loginTime?: string;
  provider?: string;
  mode?: string;
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

// 扩展的家庭成员接口，包含显示所需的字段
interface ExtendedHouseholdMember extends HouseholdMember {
  name: string;
  email: string;
  phone: string;
  relationship: string;
}

interface MemberForm {
  name: string;
  email: string;
  phone: string;
  relationship: string;
  role: 'admin' | 'member';
}

// 健康记录相关接口
interface MedicationData {
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  notes?: string;
}

interface VitalSignsData {
  bloodPressure?: {
    systolic: number;
    diastolic: number;
  };
  heartRate?: number;
  temperature?: number;
  weight?: number;
  height?: number;
  bloodSugar?: number;
  oxygenSaturation?: number;
}

interface MedicationData {
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  sideEffects?: string[];
}

interface DiagnosisData {
  condition: string;
  severity?: string;
  diagnosedDate: string;
  doctor?: string;
  hospital?: string;
  notes?: string;
}

interface AllergyData {
  allergen: string;
  severity: 'mild' | 'moderate' | 'severe';
  symptoms: string[];
  treatment?: string;
}

// 扩展健康记录数据类型，添加AI建议字段
interface ExtendedHealthRecordData extends HealthRecordData {
  medication?: MedicationData;
  diagnosis?: DiagnosisData;
  allergy?: AllergyData;
  vitalSigns?: VitalSignsData;
  notes?: string;
  aiAdvice?: string;
  aiAdviceGeneratedAt?: string;
}

// 本地健康记录接口，包含memberName字段用于显示
interface LocalHealthRecord {
  id: string;
  userId: string;
  householdId: string;
  memberName: string;
  title: string;
  description?: string;
  recordType: HealthRecordType;
  recordData: ExtendedHealthRecordData;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface LocalHealthRecordForm {
  title: string;
  description: string;
  recordType: HealthRecordType;
  recordData: ExtendedHealthRecordData;
}

// Constants
const COLORS = {
  PRIMARY: '#007AFF',
  BACKGROUND: '#F2F2F7',
  SUCCESS: '#34C759',
  ERROR: '#FF3B30',
};

// 骨架屏组件
const MemberListSkeleton = () => (
  <View style={styles.membersList}>
    {[1, 2, 3].map(i => (
      <View key={i} style={[styles.memberCard, styles.skeletonCard]}>
        <View style={styles.skeletonAvatar} />
        <View style={styles.skeletonContent}>
          <View style={[styles.skeletonLine, styles.skeletonTitle]} />
          <View style={[styles.skeletonLine, styles.skeletonSubtitle]} />
        </View>
      </View>
    ))}
  </View>
);

const HealthRecordsSkeleton = () => (
  <View style={styles.healthRecordsList}>
    {[1, 2, 3, 4].map(i => (
      <View key={i} style={[styles.healthRecordCard, styles.skeletonCard]}>
        <View style={[styles.skeletonLine, styles.skeletonTitle]} />
        <View style={[styles.skeletonLine, styles.skeletonSubtitle]} />
        <View style={[styles.skeletonLine, styles.skeletonDate]} />
      </View>
    ))}
  </View>
);

// Simple navigation state
let renderCount = 0;

const App: React.FC = () => {
  renderCount++;
  if (renderCount % 10 === 0) { // 只每10次渲染打印一次日志
    console.log(`[DEBUG] App component render #${renderCount}`);
  }

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

  // 健康记录相关状态
  const [healthRecords, setHealthRecords] = React.useState<LocalHealthRecord[]>([]);
  const [currentMemberForHealth, setCurrentMemberForHealth] = React.useState<HouseholdMember | null>(null);
  const [showAddHealthRecord, setShowAddHealthRecord] = React.useState(false);
  const [healthRecordForm, setHealthRecordForm] = React.useState<LocalHealthRecordForm>({
    title: '',
    description: '',
    recordType: HealthRecordType.VITAL_SIGNS,
    recordData: {
      vitals: {
        heartRate: undefined,
        temperature: undefined,
        weight: undefined,
        height: undefined,
        bloodPressure: undefined,
        bloodSugar: undefined,
        oxygenSaturation: undefined
      }
    }
  });
  // geminiAdvice状态已移除，AI建议现在保存在记录中
  const [selectedHealthRecord, setSelectedHealthRecord] = React.useState<LocalHealthRecord | null>(null);
  const [generatingAIForRecords, setGeneratingAIForRecords] = React.useState<string[]>([]);
  const [detailPageKey, setDetailPageKey] = React.useState<number>(0);

  // 不再需要复杂的实时更新机制，用户手动生成AI建议

  // 初始化 Firebase 并检查认证状态
  React.useEffect(() => {
    const initFirebase = async () => {
      try {
        setLoading(true);

        // 初始化 Firebase
        const initialized = await firebaseWebAuthService.initialize();

        // 清空Firebase数据以开始全新测试
        console.log('清空Firebase数据以开始全新测试...');
        await firebaseWebAuthService.clearAllData();

        // 清除本地存储缓存
        console.log('清除本地存储缓存...');
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('wenting_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          console.log(`已清除缓存：${key}`);
        });
        console.log('本地存储缓存清除完成！');

        if (initialized) {
          // 监听认证状态变化
          const unsubscribe = firebaseWebAuthService.onAuthStateChanged(async (user) => {
            if (user) {
              console.log('用户认证状态变化:', user);

              // 获取完整的用户文档信息
              try {
                const dbService = FirebaseDatabaseService.getInstance();
                await dbService.initialize();
                const userDoc = await dbService.getUserById(user.uid);

                if (userDoc) {
                  console.log('获取到完整用户文档:', userDoc);
                  setUsername(userDoc.fullName || user.displayName || user.email || 'User');

                  // 存储完整用户信息
                  localStorage.setItem('wenting_user', JSON.stringify({
                    uid: user.uid,
                    email: userDoc.email || user.email,
                    displayName: user.displayName,
                    fullName: userDoc.fullName,
                    photoURL: userDoc.avatarUrl || user.photoURL,
                    emailVerified: user.emailVerified,
                    provider: userDoc.googleId ? 'google' : 'email',
                    loginTime: new Date().toISOString()
                  }));
                } else {
                  console.log('用户文档不存在，使用认证信息');
                  setUsername(user.displayName || user.email || 'User');

                  // 存储基本认证信息
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
                }
              } catch (error) {
                console.error('获取用户文档失败:', error);
                setUsername(user.displayName || user.email || 'User');

                // 使用认证信息作为后备
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
              }

              setIsLoggedIn(true);
              setCurrentScreen('home');
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
  // 加载用户的家庭列表
  const loadHouseholds = React.useCallback(async (forceRefresh = false) => {
    console.log('[DEBUG] loadHouseholds called, forceRefresh:', forceRefresh);
    try {
      const currentUser = firebaseWebAuthService.getCurrentUser();

      if (!currentUser?.uid) {
        console.warn('用户未登录或没有用户ID');
        return;
      }

      // 如果强制刷新，先清除缓存
      if (forceRefresh) {
        const dbService = FirebaseDatabaseService.getInstance();
        dbService.clearCacheByPattern('user_households');
        localStorage.removeItem(`wenting_households${currentUser.uid}`);
      }

      // 初始化Firebase数据库服务
      const dbService = FirebaseDatabaseService.getInstance();
      await dbService.initialize();

      // 从Firebase获取用户的家庭列表
      const householdsResult = await dbService.getUserHouseholds(currentUser.uid);

      if (householdsResult && householdsResult.length > 0) {
        setHouseholds(householdsResult);

        // 设置第一个家庭为当前家庭
        const firstHousehold = householdsResult[0];
        setCurrentHousehold(firstHousehold);

        // 预加载第一个家庭的成员数据（不阻塞UI）
        loadHouseholdMembers(firstHousehold.id);

        // 预加载健康记录（后台进行）
        setTimeout(() => {
          loadHealthRecords();
        }, 500);

      } else {
        console.log('用户没有家庭，需要创建');
        setHouseholds([]);
        setCurrentHousehold(null);
        setHouseholdMembers([]);
      }
    } catch (error) {
      console.error('加载家庭数据失败:', error);

      // 尝试从本地存储获取缓存数据
      try {
        const cachedHouseholds = localStorage.getItem('wenting_households');
        if (cachedHouseholds) {
          const parsed = JSON.parse(cachedHouseholds);
          if (Date.now() - parsed.timestamp < 10 * 60 * 1000) { // 10分钟内的缓存
            console.log('Using cached households data');
            setHouseholds(parsed.data || []);
          }
        }
      } catch (cacheError) {
        console.error('Failed to load cached households:', cacheError);
      }
    }
  }, []);

  // 预加载用户数据
  const preloadUserData = React.useCallback(async () => {
    if (!isLoggedIn) return;

    console.log('[DEBUG] Starting preload of user data...');
    performanceMonitor.startTimer('preloadUserData');

    try {
      // 并行加载多个数据源，不阻塞UI
      const promises = [
        loadHouseholds(),
        // 可以添加其他预加载任务
      ];

      // 使用 Promise.allSettled 确保即使某个请求失败也不影响其他请求
      const results = await Promise.allSettled(promises);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Preload task ${index} failed:`, result.reason);
        }
      });

      console.log('[DEBUG] Preload completed');
      performanceMonitor.endTimer('preloadUserData');

      // 在开发环境下打印性能报告
      if (process.env.NODE_ENV === 'development') {
        setTimeout(() => {
          performanceMonitor.printReport();
        }, 2000);
      }
    } catch (error) {
      console.error('Preload error:', error);
      performanceMonitor.endTimer('preloadUserData');
    }
  }, [isLoggedIn, loadHouseholds]);

  React.useEffect(() => {
    console.log('[DEBUG] useEffect - isLoggedIn changed:', isLoggedIn);
    if (isLoggedIn) {
      preloadUserData();
    }
  }, [isLoggedIn, preloadUserData]);

  // 添加成员加载状态
  const [membersLoading, setMembersLoading] = React.useState(false);

  // 加载家庭成员
  const loadHouseholdMembers = async (householdId: string) => {
    try {
      console.log('加载家庭成员，householdId:', householdId);
      setMembersLoading(true);
      performanceMonitor.startTimer('loadHouseholdMembers_UI');

      const currentUser = firebaseWebAuthService.getCurrentUser();

      if (!currentUser?.uid) {
        console.warn('用户未登录');
        return;
      }

      // 从Firebase获取家庭成员
      const dbService = FirebaseDatabaseService.getInstance();
      const membersResult = await dbService.getHouseholdMembers(householdId);

      if (membersResult && membersResult.length > 0) {
        console.log('设置家庭成员:', membersResult);
        setHouseholdMembers(membersResult);
      } else {
        console.log('未找到家庭成员数据');
        setHouseholdMembers([]);
      }
    } catch (error) {
      console.error('加载家庭成员失败:', error);
    } finally {
      setMembersLoading(false);
      performanceMonitor.endTimer('loadHouseholdMembers_UI');
    }
  };

  // 创建家庭
  const handleCreateHousehold = async () => {
    if (!householdForm.name.trim()) {
      setFieldErrors({ ...fieldErrors, householdName: true });
      Alert.alert('请完善信息', '• 请输入家庭名称\n\n家庭名称是必填项，用于标识您的家庭。');
      return;
    } else {
      setFieldErrors({ ...fieldErrors, householdName: false });
    }

    const currentUser = firebaseWebAuthService.getCurrentUser();

    if (!currentUser?.uid) {
      alert('错误：用户未登录');
      return;
    }

    setLoading(true);
    try {
      // 确保Firebase数据库服务已初始化
      const dbService = FirebaseDatabaseService.getInstance();
      await dbService.initialize();

      // 生成家庭ID
      const householdId = `household_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 确保用户文档存在（登录时应该已经创建，这里作为备用）
      try {
        await dbService.createUser({
          id: currentUser.uid,
          phoneNumber: '',
          email: currentUser.email || '',
          googleId: '',
          fullName: currentUser.displayName || currentUser.email || '用户',
          avatarUrl: currentUser.photoURL || '',
          biometricEnabled: false
        });
      } catch (error) {
        // 用户文档可能已存在，继续创建家庭
        console.log('用户文档已存在或创建失败，继续创建家庭:', error);
      }

      // 使用Firebase数据库服务创建家庭
      const createdHouseholdId = await dbService.createHousehold({
        id: householdId,
        name: householdForm.name.trim(),
        description: householdForm.description.trim(),
        createdBy: currentUser.uid
      });

      console.log('家庭创建成功，ID:', createdHouseholdId);

      // 等待一小段时间确保数据已写入Firebase，然后强制刷新
      setTimeout(async () => {
        await loadHouseholds(true); // 强制刷新
      }, 500);

      alert('成功：家庭创建成功！');

      // 重置表单
      setHouseholdForm({ name: '', description: '' });
      setShowCreateHousehold(false);
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
    const existingMember = householdMembers.find(m => {
      const memberEmail = m.user?.email || m.email || '';
      return memberEmail.toLowerCase() === memberForm.email.toLowerCase() &&
        (!editingMember || m.id !== editingMember.id);
    });
    if (existingMember) {
      Alert.alert('错误', '该成员已在家庭中');
      return;
    }

    setLoading(true);
    try {
      console.log('开始添加新成员:', memberForm);

      // 使用Firebase添加成员
      const dbService = FirebaseDatabaseService.getInstance();
      await dbService.initialize();

      // 生成临时用户ID（实际应该通过邮箱邀请等方式处理）
      const tempUserId = `temp_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 创建临时用户文档
      await dbService.createUser({
        id: tempUserId,
        phoneNumber: memberForm.phone.trim(),
        email: memberForm.email.trim(),
        googleId: '',
        fullName: memberForm.name.trim(),
        avatarUrl: '',
        biometricEnabled: false
      });

      // 创建家庭成员关系
      const membershipId = `${currentHousehold.id}_${tempUserId}`;
      await dbService.addHouseholdMember({
        id: membershipId,
        householdId: currentHousehold.id,
        userId: tempUserId,
        role: memberForm.role === 'admin' ? UserRole.ADMIN : UserRole.MEMBER,
        joinedAt: new Date().toISOString()
      });

      console.log('新成员添加成功');

      // 清除缓存并重新加载家庭成员数据
      // 手动清除相关缓存
      localStorage.removeItem(`wenting_members_${currentHousehold.id}`);

      // 重新加载家庭成员数据
      await loadHouseholdMembers(currentHousehold.id);

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
    } catch (error) {
      console.error('添加成员失败:', error);
      alert('错误：添加成员失败，请重试');
    }
    setLoading(false);
  };

  // 编辑家庭成员
  const handleEditMember = (member: any) => {
    console.log('编辑成员，完整数据:', member);
    setEditingMember(member);

    // 处理从Firebase获取的数据结构
    const memberData = member.user || member;
    setMemberForm({
      name: memberData.fullName || memberData.name || memberData.displayName || '',
      email: memberData.email || '',
      phone: memberData.phoneNumber || memberData.phone || '',
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
      console.error('更新成员失败:', {
        currentHousehold: currentHousehold,
        editingMember: editingMember,
        hasCurrentHousehold: !!currentHousehold,
        hasEditingMember: !!editingMember
      });
      Alert.alert('错误', !currentHousehold ? '找不到当前家庭，请重新选择家庭' : '更新失败，请重试');
      return;
    }

    setLoading(true);
    try {
      console.log('开始更新成员:', {
        editingMember: editingMember,
        memberForm: memberForm,
        currentHousehold: currentHousehold
      });

      // 使用Firebase更新用户文档
      const dbService = FirebaseDatabaseService.getInstance();
      await dbService.initialize();

      // 更新用户基本信息
      await dbService.updateUser(editingMember.userId, {
        fullName: memberForm.name.trim(),
        email: memberForm.email.trim(),
        phoneNumber: memberForm.phone.trim()
      });

      console.log('用户信息更新成功');

      // 重新加载家庭成员数据
      await loadHouseholdMembers(currentHousehold.id);

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
    if (!memberToDelete || !currentHousehold) return;

    console.log('用户确认删除，开始执行删除操作');
    setShowDeleteConfirm(false);

    // 1. 乐观更新：立即从UI中移除成员
    const memberName = memberToDelete.user?.fullName || memberToDelete.name || '成员';
    const originalMembers = [...householdMembers];
    setHouseholdMembers(prev => prev.filter(m => m.id !== memberToDelete.id));

    // 2. 立即显示成功消息，提升用户体验
    alert(`${memberName} 已从家庭中移除`);

    try {
      console.log('后台删除成员:', memberName);

      // 3. 后台执行实际删除操作
      const dbService = FirebaseDatabaseService.getInstance();
      await dbService.removeHouseholdMember(memberToDelete.id);

      console.log('成员关系删除成功');

      // 4. 静默刷新确保数据一致性（延迟执行，不阻塞UI）
      setTimeout(() => {
        loadHouseholdMembers(currentHousehold.id);
      }, 1000);

    } catch (error) {
      console.error('删除成员失败:', error);

      // 5. 失败时回滚UI状态
      setHouseholdMembers(originalMembers);
      alert(`错误：删除 ${memberName} 失败，请重试`);
    } finally {
      setMemberToDelete(null);
    }
  };

  // 取消删除
  const cancelDeleteMember = () => {
    console.log('用户取消删除操作');
    setShowDeleteConfirm(false);
    setMemberToDelete(null);
  };

  // 健康记录管理功能

  // 加载健康记录
  const loadHealthRecords = async (memberId?: string, forceRefresh = false) => {
    try {
      const currentUser = firebaseWebAuthService.getCurrentUser();

      if (!currentUser?.uid || !currentHousehold) {
        console.warn('用户未登录或没有选择家庭');
        return;
      }

      // 确保Firebase数据库服务已初始化
      const dbService = FirebaseDatabaseService.getInstance();
      await dbService.initialize();

      // 使用HealthRecordService加载健康记录
      const healthService = HealthRecordService.getInstance();

      // 如果需要强制刷新，清除缓存
      if (forceRefresh) {
        healthService.clearCache(currentHousehold.id);
        localStorage.removeItem(`wenting_health_records_${currentHousehold.id}`);
      }
      const result = await healthService.getHealthRecords(
        currentHousehold.id,
        currentUser.uid,
        UserRole.ADMIN // 假设当前用户是管理员，实际应该从用户角色获取
      );

      if (result.success && result.data) {
        // 如果指定了成员ID，过滤记录
        const filteredRecords = memberId
          ? result.data.filter((record: any) => record.userId === memberId)
          : result.data;

        setHealthRecords(filteredRecords as LocalHealthRecord[]);
      } else {
        console.error('加载健康记录失败:', result.error);
        setHealthRecords([]);
      }
    } catch (error) {
      console.error('加载健康记录失败:', error);
    }
  };

  // 创建健康记录
  const handleCreateHealthRecord = async () => {
    if (!currentMemberForHealth || !currentHousehold) {
      alert('错误：请选择成员和家庭');
      return;
    }

    if (!healthRecordForm.title.trim()) {
      alert('错误：请输入记录标题');
      return;
    }

    setLoading(true);
    try {
      const currentUser = firebaseWebAuthService.getCurrentUser();

      if (!currentUser?.uid) {
        alert('错误：用户未登录');
        return;
      }

      // 确保Firebase数据库服务已初始化
      const dbService = FirebaseDatabaseService.getInstance();
      await dbService.initialize();

      // 使用HealthRecordService创建健康记录
      const healthService = HealthRecordService.getInstance();
      const result = await healthService.createHealthRecord(
        healthRecordForm,
        currentHousehold.id,
        currentMemberForHealth.id,
        currentUser.uid,
        UserRole.ADMIN // 假设当前用户是管理员
      );

      if (result.success && result.data) {
        // 清除健康记录缓存并重新加载
        const healthService = HealthRecordService.getInstance();
        healthService.clearCache(currentHousehold.id);

        if (currentHousehold) {
          localStorage.removeItem(`wenting_health_records_${currentHousehold.id}`);
        }
        await loadHealthRecords();

        // 重置表单
        setHealthRecordForm({
          title: '',
          description: '',
          recordType: HealthRecordType.VITAL_SIGNS,
          recordData: {
            vitals: {
              heartRate: undefined,
              temperature: undefined,
              weight: undefined,
              height: undefined,
              bloodPressure: undefined,
              bloodSugar: undefined,
              oxygenSaturation: undefined
            }
          }
        });
        setShowAddHealthRecord(false);
      } else {
        throw new Error(result.error || '创建健康记录失败');
      }
    } catch (error) {
      console.error('创建健康记录失败:', error);
      alert('错误：创建健康记录失败，请重试');
    }
    setLoading(false);
  };


  // 为已存在的记录生成AI建议
  const generateAIForExistingRecord = async (record: LocalHealthRecord) => {
    setGeneratingAIForRecords(prev => [...prev, record.id]);
    try {
      const geminiService = GeminiService.getInstance();

      let prompt = `基于以下健康记录为${record.memberName}提供健康建议：\n\n`;
      prompt += `记录类型：${getRecordTypeLabel(record.recordType)}\n`;
      prompt += `标题：${record.title}\n`;

      if (record.description) {
        prompt += `描述：${record.description}\n`;
      }

      // 根据记录类型添加具体数据
      if (record.recordType === HealthRecordType.VITAL_SIGNS && record.recordData.vitals) {
        const vs = record.recordData.vitals;
        prompt += `生命体征数据：\n`;
        if (vs.heartRate) prompt += `- 心率：${vs.heartRate} bpm\n`;
        if (vs.temperature) prompt += `- 体温：${vs.temperature}°C\n`;
        if (vs.weight) prompt += `- 体重：${vs.weight} kg\n`;
        if (vs.height) prompt += `- 身高：${vs.height} cm\n`;
        if (vs.bloodPressure) prompt += `- 血压：${vs.bloodPressure.systolic}/${vs.bloodPressure.diastolic} mmHg\n`;
        if (vs.bloodSugar) prompt += `- 血糖：${vs.bloodSugar} mg/dL\n`;
        if (vs.oxygenSaturation) prompt += `- 血氧饱和度：${vs.oxygenSaturation}%\n`;
      }

      prompt += `\n请提供具体的健康建议和注意事项，包括：\n1. 对当前数据的评估\n2. 生活方式建议\n3. 需要注意的健康风险\n4. 建议的后续行动\n\n请用中文回答，保持专业但易懂。`;

      const result = await geminiService.generateHealthAdvice(prompt);

      if (result.success && result.data) {
        // 更新记录，添加AI建议
        const updatedRecord = {
          ...record,
          recordData: {
            ...record.recordData,
            aiAdvice: result.data,
            aiAdviceGeneratedAt: new Date().toISOString(),
          }
        };

        // 更新本地状态
        setHealthRecords(prev =>
          prev.map(r => r.id === record.id ? updatedRecord : r)
        );

        // 保存到Firebase
        try {
          const currentUser = firebaseWebAuthService.getCurrentUser();
          if (currentUser?.uid && currentHousehold) {
            // 确保Firebase数据库服务已初始化
            const dbService = FirebaseDatabaseService.getInstance();
            await dbService.initialize();

            const healthService = HealthRecordService.getInstance();
            const updateResult = await healthService.updateHealthRecord(
              record.id,
              { recordData: updatedRecord.recordData },
              currentUser.uid,
              UserRole.ADMIN
            );

            if (updateResult.success) {
              console.log('AI建议已保存到Firebase');
            } else {
              console.error('保存AI建议到Firebase失败:', updateResult.error);
            }
          }
        } catch (storageError) {
          console.error('保存AI建议失败:', storageError);
        }

        // 如果当前正在查看这个记录的详情，也更新选中的记录
        if (selectedHealthRecord && selectedHealthRecord.id === record.id) {
          console.log('直接更新选中的记录 - 手动生成');
          setSelectedHealthRecord(updatedRecord);
          setDetailPageKey(prev => prev + 1); // 强制重新渲染详情页面
        }

        console.log('AI建议已生成并保存到记录中');
        alert('AI建议已生成！');
      } else {
        console.log('AI建议生成失败:', result.error);
        alert('AI建议生成失败，请稍后重试。');
      }
    } catch (error) {
      console.error('获取AI建议失败:', error);
      alert('AI建议生成失败，请稍后重试。');
    } finally {
      setGeneratingAIForRecords(prev => prev.filter(id => id !== record.id));
    }
  };

  // 获取记录类型标签
  const getRecordTypeLabel = (type: HealthRecordType): string => {
    const labels = {
      [HealthRecordType.VITAL_SIGNS]: '生命体征',
      [HealthRecordType.MEDICATION]: '用药记录',
      [HealthRecordType.DIAGNOSIS]: '诊断记录',
      [HealthRecordType.ALLERGY]: '过敏信息',
      [HealthRecordType.VACCINATION]: '疫苗接种',
      [HealthRecordType.LAB_RESULT]: '检验结果',
      [HealthRecordType.MEDICAL_HISTORY]: '病史记录'
    };
    return labels[type] || type;
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
        // 使用统一的用户创建逻辑
        try {
          const dbService = FirebaseDatabaseService.getInstance();
          await dbService.initialize();

          await dbService.createUser({
            id: result.user.uid,
            phoneNumber: '',
            email: result.user.email || '',
            googleId: '',
            fullName: result.user.displayName || fullName || result.user.email || '用户',
            avatarUrl: result.user.photoURL || '',
            biometricEnabled: false
          });

          console.log('邮箱注册用户文档创建成功:', {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            fullName: fullName
          });
        } catch (error) {
          console.error('创建邮箱注册用户文档失败:', error);
          // 不影响注册流程，只是记录错误
        }

        setUsername(result.user.displayName || fullName || result.user.email || 'User');
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
        // 立即创建用户文档，确保用户信息完整
        try {
          const dbService = FirebaseDatabaseService.getInstance();
          await dbService.initialize();

          await dbService.createUser({
            id: result.user.uid,
            phoneNumber: '',
            email: result.user.email || '',
            googleId: result.user.uid,
            fullName: result.user.displayName || result.user.email || 'Google用户',
            avatarUrl: result.user.photoURL || '',
            biometricEnabled: false
          });

          console.log('Google登录用户文档创建成功:', {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL
          });
        } catch (error) {
          console.error('创建Google用户文档失败:', error);
          // 不影响登录流程，只是记录错误
        }

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
                autoCorrect={false}
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
          <ScrollView style={styles.screenContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setCurrentScreen('home');
                setCurrentMemberForHealth(null);
                setHealthRecords([]);
              }}
            >
              <Text style={styles.backButtonText}>← 返回</Text>
            </TouchableOpacity>
            <Text style={styles.screenTitle}>健康记录</Text>

            {/* 如果没有选择成员，显示成员选择界面 */}
            {!currentMemberForHealth ? (
              <View>
                <Text style={styles.sectionTitle}>选择家庭成员</Text>
                <Text style={styles.sectionSubtitle}>为哪位成员添加健康记录？</Text>

                <View style={styles.memberSelectList}>
                  {householdMembers.map((member) => (
                    <TouchableOpacity
                      key={member.id}
                      style={styles.memberSelectCard}
                      onPress={() => {
                        setCurrentMemberForHealth(member);
                        loadHealthRecords(member.id);
                      }}
                    >
                      <Text style={styles.memberSelectName}>
                        {member.user?.fullName || member.user?.displayName || member.name || '未知用户'}
                      </Text>
                      <Text style={styles.memberSelectRole}>
                        {member.role === 'admin' ? '管理员' : '成员'} • {member.relationship}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              /* 显示选中成员的健康记录 */
              <View>
                <View style={styles.memberHealthHeader}>
                  <View>
                    <Text style={styles.memberHealthName}>{currentMemberForHealth.name}</Text>
                    <Text style={styles.memberHealthInfo}>
                      {currentMemberForHealth.relationship} • 共 {healthRecords.length} 条记录
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.addHealthRecordButton}
                    onPress={() => setShowAddHealthRecord(true)}
                  >
                    <Text style={styles.addHealthRecordButtonText}>+ 添加记录</Text>
                  </TouchableOpacity>
                </View>

                {/* AI建议已移至详情页面 */}

                {/* 健康记录列表 */}
                <View style={styles.healthRecordsList}>
                  {healthRecords.length === 0 ? (
                    <View style={styles.noRecordsContainer}>
                      <Text style={styles.noRecordsTitle}>还没有健康记录</Text>
                      <Text style={styles.noRecordsText}>开始为{currentMemberForHealth.name}记录健康数据吧</Text>
                    </View>
                  ) : (
                    healthRecords.map((record) => (
                      <View key={record.id} style={styles.healthRecordCard}>
                        <TouchableOpacity
                          style={styles.healthRecordContent}
                          onPress={() => {
                            console.log('卡片被点击，记录ID:', record.id);
                            setSelectedHealthRecord(record);
                            setCurrentScreen('healthRecordDetail');
                          }}
                        >
                          <View style={styles.healthRecordHeader}>
                            <Text style={styles.healthRecordTitle}>{record.title}</Text>
                            <Text style={styles.healthRecordType}>
                              {getRecordTypeLabel(record.recordType)}
                            </Text>
                          </View>

                          {record.description && (
                            <Text style={styles.healthRecordDescription}>{record.description}</Text>
                          )}

                          {/* 显示AI建议指示器 */}
                          {record.recordData.aiAdvice && (
                            <View style={styles.aiIndicator}>
                              <Text style={styles.aiIndicatorText}>💡 包含AI建议</Text>
                            </View>
                          )}

                          <Text style={styles.healthRecordDate}>
                            记录时间: {record.createdAt ? new Date(record.createdAt).toLocaleString('zh-CN') : '未知时间'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.deleteButton, { backgroundColor: '#ffebee' }]}
                          onPress={() => {
                            console.log('删除按钮被点击，记录ID:', record.id);
                            console.log('当前健康记录数量:', healthRecords.length);

                            if (window.confirm(`确定要删除健康记录"${record.title}"吗？此操作无法撤销。`)) {
                              console.log('用户确认删除');

                              // 1. 乐观更新：立即从UI中移除记录
                              const recordTitle = record.title;
                              const originalRecords = [...healthRecords];
                              setHealthRecords(prev => prev.filter(r => r.id !== record.id));

                              // 2. 立即显示成功消息，提升用户体验
                              alert(`健康记录"${recordTitle}"已删除`);

                              // 3. 后台执行实际删除操作（异步，不阻塞UI）
                              (async () => {
                                try {
                                  console.log('后台删除健康记录:', recordTitle);

                                  const currentUser = firebaseWebAuthService.getCurrentUser();
                                  if (currentUser && currentHousehold) {
                                    // 直接调用Firebase删除，跳过复杂的服务层
                                    await firebaseWebAuthService.deleteDocument('health_records', record.id);

                                    // 清除所有相关缓存
                                    const healthService = HealthRecordService.getInstance();
                                    healthService.clearCache(); // 清除所有缓存，不只是特定模式

                                    // 清除本地存储中所有健康记录相关的数据
                                    const keysToRemove = [];
                                    for (let i = 0; i < localStorage.length; i++) {
                                      const key = localStorage.key(i);
                                      if (key && (key.includes('health_records') || key.includes('wenting_health'))) {
                                        keysToRemove.push(key);
                                      }
                                    }
                                    keysToRemove.forEach(key => {
                                      localStorage.removeItem(key);
                                      console.log(`已清除缓存：${key}`);
                                    });

                                    console.log('健康记录已从数据库中删除');

                                    // 4. 静默刷新确保数据一致性（延迟执行，不阻塞UI）
                                    setTimeout(async () => {
                                      console.log('开始静默刷新健康记录...');

                                      try {
                                        // 直接从Firebase获取最新数据，绕过所有缓存
                                        const conditions = [
                                          { field: 'householdId', operator: '==', value: currentHousehold.id }
                                        ];

                                        const rawRecords = await firebaseWebAuthService.queryDocuments('health_records', conditions);
                                        console.log('从Firebase获取到的原始记录数量:', rawRecords.length);

                                        // 简单处理，不解密，只显示基本信息
                                        const freshRecords = rawRecords.map((rawRecord: any) => ({
                                          id: rawRecord.id,
                                          userId: rawRecord.userId,
                                          householdId: rawRecord.householdId,
                                          memberName: '成员', // 简化显示
                                          title: rawRecord.title || '健康记录',
                                          description: rawRecord.description || '',
                                          recordType: rawRecord.recordType || 'vital_signs',
                                          recordData: rawRecord.recordData || {},
                                          createdBy: rawRecord.createdBy,
                                          createdAt: rawRecord.createdAt?.toDate ? rawRecord.createdAt.toDate().toISOString() : (rawRecord.createdAt || new Date().toISOString()),
                                          updatedAt: rawRecord.updatedAt?.toDate ? rawRecord.updatedAt.toDate().toISOString() : (rawRecord.updatedAt || new Date().toISOString())
                                        }));

                                        console.log('处理后的记录数量:', freshRecords.length);
                                        setHealthRecords(freshRecords);
                                      } catch (refreshError) {
                                        console.error('静默刷新失败:', refreshError);
                                        // 如果刷新失败，使用原来的方法
                                        loadHealthRecords(undefined, true);
                                      }
                                    }, 1000);
                                  }
                                } catch (error) {
                                  console.error('后台删除健康记录失败:', error);

                                  // 5. 失败时回滚UI状态
                                  setHealthRecords(originalRecords);
                                  alert(`删除失败：${recordTitle} 已恢复显示`);
                                }
                              })();
                            } else {
                              console.log('用户取消删除');
                            }
                          }}
                        >
                          <Text style={styles.deleteButtonText}>🗑️</Text>
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </View>
              </View>
            )}

            {/* 添加健康记录模态框 */}
            {showAddHealthRecord && currentMemberForHealth && (
              <View style={styles.modalOverlay}>
                <View style={styles.modalContainer}>
                  <ScrollView style={styles.modalScrollView}>
                    <Text style={styles.modalTitle}>为 {currentMemberForHealth.name} 添加健康记录</Text>

                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>记录标题 *</Text>
                      <TextInput
                        style={styles.input}
                        value={healthRecordForm.title || ''}
                        onChangeText={(text) => setHealthRecordForm({ ...healthRecordForm, title: text })}
                        placeholder="例如：体检记录、血压监测"
                        placeholderTextColor="#999"
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>记录类型</Text>
                      <View style={styles.pickerContainer}>
                        {Object.values(HealthRecordType).map((type) => (
                          <TouchableOpacity
                            key={type}
                            style={[
                              styles.pickerOption,
                              healthRecordForm.recordType === type && styles.pickerOptionSelected
                            ]}
                            onPress={() => setHealthRecordForm({
                              ...healthRecordForm,
                              recordType: type,
                              recordData: type === HealthRecordType.VITAL_SIGNS ? {
                                vitals: {
                                  heartRate: undefined,
                                  temperature: undefined,
                                  weight: undefined,
                                  height: undefined,
                                  bloodPressure: undefined,
                                  bloodSugar: undefined,
                                  oxygenSaturation: undefined
                                }
                              } : {}
                            })}
                          >
                            <Text style={[
                              styles.pickerOptionText,
                              healthRecordForm.recordType === type && styles.pickerOptionTextSelected
                            ]}>
                              {getRecordTypeLabel(type)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* 生命体征数据输入 */}
                    {healthRecordForm.recordType === HealthRecordType.VITAL_SIGNS && (
                      <View>
                        <Text style={styles.inputLabel}>生命体征数据</Text>

                        <View style={styles.vitalSignsInputGrid}>
                          <View style={styles.vitalSignInputItem}>
                            <Text style={styles.vitalSignLabel}>心率 (bpm)</Text>
                            <TextInput
                              style={styles.vitalSignInput}
                              value={healthRecordForm.recordData.vitals?.heartRate?.toString() || ''}
                              onChangeText={(text) => setHealthRecordForm({
                                ...healthRecordForm,
                                recordData: {
                                  ...healthRecordForm.recordData,
                                  vitals: {
                                    ...healthRecordForm.recordData.vitals,
                                    heartRate: text ? parseInt(text) : undefined
                                  }
                                }
                              })}
                              placeholder="72"
                              placeholderTextColor="#999"
                              keyboardType="numeric"
                            />
                          </View>

                          <View style={styles.vitalSignInputItem}>
                            <Text style={styles.vitalSignLabel}>体温 (°C)</Text>
                            <TextInput
                              style={styles.vitalSignInput}
                              value={healthRecordForm.recordData.vitals?.temperature?.toString() || ''}
                              onChangeText={(text) => setHealthRecordForm({
                                ...healthRecordForm,
                                recordData: {
                                  ...healthRecordForm.recordData,
                                  vitals: {
                                    ...healthRecordForm.recordData.vitals,
                                    temperature: text ? parseFloat(text) : undefined
                                  }
                                }
                              })}
                              placeholder="36.5"
                              placeholderTextColor="#999"
                              keyboardType="decimal-pad"
                            />
                          </View>

                          <View style={styles.vitalSignInputItem}>
                            <Text style={styles.vitalSignLabel}>体重 (kg)</Text>
                            <TextInput
                              style={styles.vitalSignInput}
                              value={healthRecordForm.recordData.vitals?.weight?.toString() || ''}
                              onChangeText={(text) => setHealthRecordForm({
                                ...healthRecordForm,
                                recordData: {
                                  ...healthRecordForm.recordData,
                                  vitals: {
                                    ...healthRecordForm.recordData.vitals,
                                    weight: text ? parseFloat(text) : undefined
                                  }
                                }
                              })}
                              placeholder="65.0"
                              placeholderTextColor="#999"
                              keyboardType="decimal-pad"
                            />
                          </View>

                          <View style={styles.vitalSignInputItem}>
                            <Text style={styles.vitalSignLabel}>身高 (cm)</Text>
                            <TextInput
                              style={styles.vitalSignInput}
                              value={healthRecordForm.recordData.vitals?.height?.toString() || ''}
                              onChangeText={(text) => setHealthRecordForm({
                                ...healthRecordForm,
                                recordData: {
                                  ...healthRecordForm.recordData,
                                  vitals: {
                                    ...healthRecordForm.recordData.vitals,
                                    height: text ? parseInt(text) : undefined
                                  }
                                }
                              })}
                              placeholder="170"
                              placeholderTextColor="#999"
                              keyboardType="numeric"
                            />
                          </View>
                        </View>

                        {/* 血压输入 */}
                        <View style={styles.bloodPressureContainer}>
                          <Text style={styles.vitalSignLabel}>血压 (mmHg)</Text>
                          <View style={styles.bloodPressureInputs}>
                            <TextInput
                              style={styles.bloodPressureInput}
                              value={healthRecordForm.recordData.vitals?.bloodPressure?.systolic?.toString() || ''}
                              onChangeText={(text) => setHealthRecordForm({
                                ...healthRecordForm,
                                recordData: {
                                  ...healthRecordForm.recordData,
                                  vitals: {
                                    ...healthRecordForm.recordData.vitals,
                                    bloodPressure: {
                                      systolic: text ? parseInt(text) : 0,
                                      diastolic: healthRecordForm.recordData.vitals?.bloodPressure?.diastolic || 0
                                    }
                                  }
                                }
                              })}
                              placeholder="120"
                              placeholderTextColor="#999"
                              keyboardType="numeric"
                            />
                            <Text style={styles.bloodPressureSeparator}>/</Text>
                            <TextInput
                              style={styles.bloodPressureInput}
                              value={healthRecordForm.recordData.vitals?.bloodPressure?.diastolic?.toString() || ''}
                              onChangeText={(text) => setHealthRecordForm({
                                ...healthRecordForm,
                                recordData: {
                                  ...healthRecordForm.recordData,
                                  vitals: {
                                    ...healthRecordForm.recordData.vitals,
                                    bloodPressure: {
                                      systolic: healthRecordForm.recordData.vitals?.bloodPressure?.systolic || 0,
                                      diastolic: text ? parseInt(text) : 0
                                    }
                                  }
                                }
                              })}
                              placeholder="80"
                              placeholderTextColor="#999"
                              keyboardType="numeric"
                            />
                          </View>
                        </View>
                      </View>
                    )}

                    <View style={styles.inputContainer}>
                      <Text style={styles.inputLabel}>备注</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        value={healthRecordForm.description || ''}
                        onChangeText={(text) => setHealthRecordForm({ ...healthRecordForm, description: text })}
                        placeholder="记录其他相关信息..."
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
                        setShowAddHealthRecord(false);
                        setHealthRecordForm({
                          title: '',
                          description: '',
                          recordType: HealthRecordType.VITAL_SIGNS,
                          recordData: {
                            vitals: {
                              heartRate: undefined,
                              temperature: undefined,
                              weight: undefined,
                              height: undefined,
                              bloodPressure: undefined,
                              bloodSugar: undefined,
                              oxygenSaturation: undefined
                            }
                          }
                        });
                      }}
                    >
                      <Text style={styles.cancelButtonText}>取消</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.confirmButton, loading && styles.disabledButton]}
                      onPress={handleCreateHealthRecord}
                      disabled={loading}
                    >
                      <Text style={styles.confirmButtonText}>
                        {loading ? '创建中...' : '创建记录'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </ScrollView>
        );
      case 'healthRecordDetail':
        return (
          <ScrollView style={styles.screenContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setCurrentScreen('health');
                setSelectedHealthRecord(null);
              }}
            >
              <Text style={styles.backButtonText}>← 返回</Text>
            </TouchableOpacity>

            {selectedHealthRecord && (
              <View key={selectedHealthRecord.id}>
                <Text style={styles.screenTitle}>{selectedHealthRecord.title}</Text>
                <Text style={styles.recordTypeLabel}>
                  {getRecordTypeLabel(selectedHealthRecord.recordType)}
                </Text>

                {selectedHealthRecord.description && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>描述</Text>
                    <Text style={styles.detailSectionContent}>{selectedHealthRecord.description}</Text>
                  </View>
                )}

                {/* 显示具体数据 */}
                {selectedHealthRecord.recordType === HealthRecordType.VITAL_SIGNS && selectedHealthRecord.recordData.vitals && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>生命体征数据</Text>
                    <View style={styles.vitalSignsDetail}>
                      {selectedHealthRecord.recordData.vitals.heartRate && (
                        <Text style={styles.vitalSignDetailItem}>心率: {selectedHealthRecord.recordData.vitals.heartRate} bpm</Text>
                      )}
                      {selectedHealthRecord.recordData.vitals.temperature && (
                        <Text style={styles.vitalSignDetailItem}>体温: {selectedHealthRecord.recordData.vitals.temperature}°C</Text>
                      )}
                      {selectedHealthRecord.recordData.vitals.weight && (
                        <Text style={styles.vitalSignDetailItem}>体重: {selectedHealthRecord.recordData.vitals.weight} kg</Text>
                      )}
                      {selectedHealthRecord.recordData.vitals.height && (
                        <Text style={styles.vitalSignDetailItem}>身高: {selectedHealthRecord.recordData.vitals.height} cm</Text>
                      )}
                      {selectedHealthRecord.recordData.vitals.bloodPressure && (
                        <Text style={styles.vitalSignDetailItem}>
                          血压: {selectedHealthRecord.recordData.vitals.bloodPressure.systolic}/{selectedHealthRecord.recordData.vitals.bloodPressure.diastolic} mmHg
                        </Text>
                      )}
                      {selectedHealthRecord.recordData.vitals.bloodSugar && (
                        <Text style={styles.vitalSignDetailItem}>血糖: {selectedHealthRecord.recordData.vitals.bloodSugar} mg/dL</Text>
                      )}
                      {selectedHealthRecord.recordData.vitals.oxygenSaturation && (
                        <Text style={styles.vitalSignDetailItem}>血氧: {selectedHealthRecord.recordData.vitals.oxygenSaturation}%</Text>
                      )}
                    </View>
                  </View>
                )}

                {/* AI建议部分 */}
                {selectedHealthRecord.recordData.aiAdvice ? (
                  <View style={styles.aiAdviceDetailSection}>
                    <Text style={styles.aiAdviceDetailTitle}>🤖 AI健康建议</Text>
                    <Text style={styles.aiAdviceDetailContent}>{selectedHealthRecord.recordData.aiAdvice}</Text>
                    {selectedHealthRecord.recordData.aiAdviceGeneratedAt && (
                      <Text style={styles.aiAdviceDetailTime}>
                        生成时间: {new Date(selectedHealthRecord.recordData.aiAdviceGeneratedAt).toLocaleString('zh-CN')}
                      </Text>
                    )}
                  </View>
                ) : generatingAIForRecords.includes(selectedHealthRecord.id) ? (
                  <View style={styles.generatingAiSection}>
                    <Text style={styles.generatingAiTitle}>🤖 AI健康建议</Text>
                    <View style={styles.generatingAiContent}>
                      <Text style={styles.generatingAiText}>AI正在分析您的健康记录，生成个性化建议...</Text>
                      <View style={styles.loadingDots}>
                        <Text style={styles.loadingDot}>●</Text>
                        <Text style={styles.loadingDot}>●</Text>
                        <Text style={styles.loadingDot}>●</Text>
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.noAiAdviceSection}>
                    <Text style={styles.noAiAdviceText}>暂无AI建议</Text>
                    <TouchableOpacity
                      style={styles.generateAiButton}
                      onPress={() => generateAIForExistingRecord(selectedHealthRecord)}
                    >
                      <Text style={styles.generateAiButtonText}>生成AI建议</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={styles.recordDetailDate}>
                  记录时间: {selectedHealthRecord.createdAt ? new Date(selectedHealthRecord.createdAt).toLocaleString('zh-CN') : '未知时间'}
                </Text>
              </View>
            )}
          </ScrollView>
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
                {membersLoading ? (
                  <MemberListSkeleton />
                ) : (
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
                              <Text style={styles.memberName}>
                                {member.user?.fullName || member.user?.displayName || member.name || '未知用户'}
                              </Text>
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

                            <Text style={styles.memberEmail}>{member.user?.email || member.email || ''}</Text>
                            {(member.user?.phoneNumber || member.phone) &&
                              <Text style={styles.memberPhone}>📞 {member.user?.phoneNumber || member.phone}</Text>
                            }
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
                )}

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
                          setHouseholdForm({ ...householdForm, name: text });
                          if (fieldErrors.householdName && text.trim()) {
                            setFieldErrors({ ...fieldErrors, householdName: false });
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
                        onChangeText={(text) => setHouseholdForm({ ...householdForm, description: text })}
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
                          setMemberForm({ ...memberForm, name: text });
                          if (fieldErrors.memberName && text.trim()) {
                            setFieldErrors({ ...fieldErrors, memberName: false });
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
                          setMemberForm({ ...memberForm, email: text });
                          if (fieldErrors.memberEmail && text.trim()) {
                            setFieldErrors({ ...fieldErrors, memberEmail: false });
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
                        onChangeText={(text) => setMemberForm({ ...memberForm, phone: text })}
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
                            onPress={() => setMemberForm({ ...memberForm, relationship: rel })}
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
                          onPress={() => setMemberForm({ ...memberForm, role: 'member' })}
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
                          onPress={() => setMemberForm({ ...memberForm, role: 'admin' })}
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
  // 旧的deleteButton样式已移除，使用新的样式
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

  // 健康记录样式
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  memberSelectList: {
    marginBottom: 20,
  },
  memberSelectCard: {
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
  memberSelectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  memberSelectRole: {
    fontSize: 14,
    color: '#666',
  },
  memberHealthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  memberHealthName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
    marginBottom: 4,
  },
  memberHealthInfo: {
    fontSize: 14,
    color: '#666',
  },
  addHealthRecordButton: {
    backgroundColor: COLORS.SUCCESS,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addHealthRecordButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  aiAdviceCard: {
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.PRIMARY,
  },
  aiAdviceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.PRIMARY,
    marginBottom: 8,
  },
  aiAdviceContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  healthRecordsList: {
    marginBottom: 20,
    padding: 16,
  },
  noRecordsContainer: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  noRecordsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  noRecordsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  healthRecordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    flexDirection: 'row',
  },
  healthRecordContent: {
    flex: 1,
    padding: 16,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#f0f0f0',
  },
  deleteButtonText: {
    fontSize: 18,
  },
  aiIndicator: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  aiIndicatorText: {
    fontSize: 12,
    color: '#2e7d32',
    fontWeight: '500',
  },
  // 详情页面样式
  recordTypeLabel: {
    fontSize: 14,
    color: COLORS.PRIMARY,
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 20,
    fontWeight: '500',
  },
  detailSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  detailSectionContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  vitalSignsDetail: {
    gap: 8,
  },
  vitalSignDetailItem: {
    fontSize: 14,
    color: '#333',
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  aiAdviceDetailSection: {
    backgroundColor: '#e8f5e8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.PRIMARY,
  },
  aiAdviceDetailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.PRIMARY,
    marginBottom: 12,
  },
  aiAdviceDetailContent: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    marginBottom: 8,
  },
  aiAdviceDetailTime: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  noAiAdviceSection: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  noAiAdviceText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  generateAiButton: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  generateAiButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  recordDetailDate: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  generatingAiSection: {
    backgroundColor: '#fff3e0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  generatingAiTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ff9800',
    marginBottom: 12,
  },
  generatingAiContent: {
    alignItems: 'center',
  },
  generatingAiText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  loadingDot: {
    fontSize: 16,
    color: '#ff9800',
  },
  healthRecordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  healthRecordTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  healthRecordType: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#e3f2fd',
    color: '#1976d2',
    fontWeight: '500',
  },
  healthRecordDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  vitalSignsData: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  vitalSignItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
    fontWeight: '500',
  },
  healthRecordDate: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
  },
  vitalSignsInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  vitalSignInputItem: {
    flex: 1,
    minWidth: '45%',
  },
  vitalSignLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  vitalSignInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#fff',
    textAlign: 'center',
  },
  bloodPressureContainer: {
    marginTop: 12,
  },
  bloodPressureInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  bloodPressureInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    backgroundColor: '#fff',
    textAlign: 'center',
    width: 80,
  },
  bloodPressureSeparator: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },

  // 骨架屏样式
  skeletonCard: {
    backgroundColor: '#f5f5f5',
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
    marginRight: 12,
  },
  skeletonContent: {
    flex: 1,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    marginBottom: 8,
  },
  skeletonTitle: {
    width: '70%',
    height: 16,
  },
  skeletonSubtitle: {
    width: '50%',
    height: 12,
  },
  skeletonDate: {
    width: '30%',
    height: 10,
  },
});

export default React.memo(App);