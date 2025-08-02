import { Platform } from 'react-native';
import { User, Household, HouseholdMember, HealthRecord, HealthCalendarEvent, UserRole, ApiResponse } from '../../types/index';
import { EncryptionManager } from '../../utils/encryption/EncryptionManager';
import { performanceMonitor } from '../../utils/performance/PerformanceMonitor';

// 平台特定的Firebase服务导入  
let firebaseAuthService: any = null;
if (Platform.OS === 'web') {
  firebaseAuthService = require('../../config/firebase-web').firebaseWebAuthService;
} else {
  firebaseAuthService = require('../../config/firebase-web').firebaseWebAuthService;
}

// 只在非Web环境下导入DatabaseService
let DatabaseService: any = null;
// 在Web环境下不导入DatabaseService模块
if (Platform.OS !== 'web') {
  DatabaseService = require('./DatabaseService').default;
}

export class FirebaseDatabaseService {
  private static instance: FirebaseDatabaseService;
  private initialized = false;
  private initPromise: Promise<boolean> | null = null;
  
  // 缓存系统
  private cache = new Map<string, { data: any, timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  
  // 存储键常量
  private readonly STORAGE_KEYS = {
    HOUSEHOLDS: 'wenting_households',
    MEMBERS: 'wenting_members_',
    USER_PROFILE: 'wenting_user_profile_',
    HEALTH_RECORDS: 'wenting_health_records_'
  };

  private constructor() {}

  static getInstance(): FirebaseDatabaseService {
    if (!FirebaseDatabaseService.instance) {
      FirebaseDatabaseService.instance = new FirebaseDatabaseService();
    }
    return FirebaseDatabaseService.instance;
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  private async _doInitialize(): Promise<boolean> {
    try {
      // Initialize Firebase auth service first
      await firebaseAuthService.initialize();
      this.initialized = true;
      console.log('Firebase Database Service initialized successfully');
      return true;
    } catch (error) {
      console.error('Firebase Database Service initialization failed:', error);
      this.initPromise = null; // 重置以允许重试
      return false;
    }
  }

  // 缓存辅助方法
  private getCacheKey(collection: string, id?: string, params?: any): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return id ? `${collection}:${id}:${paramStr}` : `${collection}:${paramStr}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`Cache hit for key: ${key}`);
      return cached.data;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
    console.log(`Cache set for key: ${key}`);
  }

  clearCacheByPattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        console.log(`Cache cleared for key: ${key}`);
      }
    }
  }

  // 本地存储辅助方法
  private getFromLocalStorage<T>(key: string): T | null {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        // 检查是否过期（本地存储保持更长时间，15分钟）
        if (Date.now() - parsed.timestamp < 15 * 60 * 1000) {
          console.log(`LocalStorage hit for key: ${key}`);
          return parsed.data;
        }
      }
    } catch (error) {
      console.error('LocalStorage get error:', error);
    }
    return null;
  }

  private setLocalStorage(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      console.log(`LocalStorage set for key: ${key}`);
    } catch (error) {
      console.error('LocalStorage set error:', error);
    }
  }

  // 重试机制
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await requestFn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        console.log(`Request failed, retrying in ${delay * Math.pow(2, i)}ms... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
    throw new Error('Max retries exceeded');
  }

  // User Management
  async createUser(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      // Create user in Firestore
      const userData = {
        ...user,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await firebaseAuthService.createDocument('users', userData, user.id);

      // Also create in local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.createUser(user);
      }

      return user.id;
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  }

  async getUserById(userId: string): Promise<User | null> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      // Try Firestore first
      const userData = await firebaseAuthService.getDocument('users', userId);
      
      if (userData) {
        return {
          id: userData.id,
          phoneNumber: userData.phoneNumber,
          email: userData.email,
          googleId: userData.googleId,
          fullName: userData.fullName,
          avatarUrl: userData.avatarUrl,
          biometricEnabled: userData.biometricEnabled || false,
          createdAt: userData.createdAt?.toISOString?.() || userData.createdAt,
          updatedAt: userData.updatedAt?.toISOString?.() || userData.updatedAt,
        };
      }

      // Fallback to local SQLite if on mobile
      if (Platform.OS !== 'web') {
        return await DatabaseService.getUserById(userId);
      }

      return null;
    } catch (error) {
      console.error('Get user by ID error:', error);
      // Fallback to local database on error
      if (Platform.OS !== 'web') {
        return await DatabaseService.getUserById(userId);
      }
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      // Query Firestore
      const users = await firebaseAuthService.queryDocuments('users', [
        { field: 'email', operator: '==', value: email }
      ]);

      if (users.length > 0) {
        const userData = users[0];
        return {
          id: userData.id,
          phoneNumber: userData.phoneNumber,
          email: userData.email,
          googleId: userData.googleId,
          fullName: userData.fullName,
          avatarUrl: userData.avatarUrl,
          biometricEnabled: userData.biometricEnabled || false,
          createdAt: userData.createdAt?.toISOString?.() || userData.createdAt,
          updatedAt: userData.updatedAt?.toISOString?.() || userData.updatedAt,
        };
      }

      // Fallback to local SQLite if on mobile
      if (Platform.OS !== 'web') {
        return await DatabaseService.getUserByEmail(email);
      }

      return null;
    } catch (error) {
      console.error('Get user by email error:', error);
      // Fallback to local database on error
      if (Platform.OS !== 'web') {
        return await DatabaseService.getUserByEmail(email);
      }
      return null;
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      // Update in Firestore
      await firebaseAuthService.updateDocument('users', userId, updateData);

      // Also update in local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.updateUser(userId, updates);
      }
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  }

  // Household Management
  async createHousehold(household: Omit<Household, 'createdAt'>): Promise<string> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      const householdData = {
        ...household,
        createdAt: Platform.OS === 'web' ? new Date().toISOString() : new Date()
      };

      // Create household in Firestore
      await firebaseAuthService.createDocument('households', householdData, household.id);

      // Create membership record
      const membershipId = `${household.id}_${household.createdBy}`;
      const membershipData = {
        id: membershipId,
        householdId: household.id,
        userId: household.createdBy,
        role: UserRole.ADMIN,
        joinedAt: Platform.OS === 'web' ? new Date().toISOString() : new Date()
      };

      await firebaseAuthService.createDocument('household_members', membershipData, membershipId);

      // Also create in local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.createHousehold(household);
      }

      // 清除相关缓存
      this.clearCacheByPattern('user_households');
      this.clearCacheByPattern('household_members');
      
      // 清除本地存储中的家庭数据
      const localKey = this.STORAGE_KEYS.HOUSEHOLDS + household.createdBy;
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(localKey);
      }

      return household.id;
    } catch (error) {
      console.error('Create household error:', error);
      throw error;
    }
  }

  async getHouseholdById(householdId: string): Promise<Household | null> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      const householdData = await firebaseAuthService.getDocument('households', householdId);
      
      if (householdData) {
        return {
          id: householdData.id,
          name: householdData.name,
          description: householdData.description,
          createdBy: householdData.createdBy,
          createdAt: householdData.createdAt?.toISOString?.() || householdData.createdAt,
        };
      }

      // Fallback to local SQLite if on mobile
      if (Platform.OS !== 'web') {
        return await DatabaseService.getHouseholdById(householdId);
      }

      return null;
    } catch (error) {
      console.error('Get household by ID error:', error);
      // Fallback to local database on error
      if (Platform.OS !== 'web') {
        return await DatabaseService.getHouseholdById(householdId);
      }
      return null;
    }
  }

  async getUserHouseholds(userId: string): Promise<Household[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // 检查缓存
      const cacheKey = this.getCacheKey('user_households', userId);
      const cached = this.getFromCache<Household[]>(cacheKey);
      if (cached) return cached;

      // 检查本地存储
      const localKey = this.STORAGE_KEYS.HOUSEHOLDS + userId;
      const localCached = this.getFromLocalStorage<Household[]>(localKey);
      if (localCached) {
        this.setCache(cacheKey, localCached);
        return localCached;
      }

      console.log('Fetching user households from Firebase for user:', userId);

      // First get user's household memberships
      const memberships = await firebaseAuthService.queryDocuments('household_members', [
        { field: 'userId', operator: '==', value: userId }
      ]);
      
      console.log('Found memberships:', memberships.length, memberships);

      if (memberships.length === 0) {
        const emptyResult: Household[] = [];
        this.setCache(cacheKey, emptyResult);
        this.setLocalStorage(localKey, emptyResult);
        return emptyResult;
      }

      // 批量获取家庭信息
      const householdIds = memberships.map((m: any) => m.householdId);
      console.log('Household IDs to fetch:', householdIds);
      const households = await this.batchGetHouseholds(householdIds);
      console.log('Fetched households:', households.length, households);

      // Sort by creation date
      households.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // 缓存结果
      this.setCache(cacheKey, households);
      this.setLocalStorage(localKey, households);

      return households;
    } catch (error) {
      console.error('Get user households error:', error);
      
      // 尝试从本地存储获取过期数据作为后备
      const localKey = this.STORAGE_KEYS.HOUSEHOLDS + userId;
      try {
        const stored = localStorage.getItem(localKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log('Using stale households data from localStorage as fallback');
          return parsed.data || [];
        }
      } catch (e) {
        console.error('Fallback localStorage read error:', e);
      }

      // Fallback to local database on error
      if (Platform.OS !== 'web') {
        return await DatabaseService.getUserHouseholds(userId);
      }
      return [];
    }
  }

  // 批量获取家庭信息的新方法
  private async batchGetHouseholds(householdIds: string[]): Promise<Household[]> {
    if (householdIds.length === 0) return [];

    try {
      // Firebase 'in' 查询限制为10个，需要分批处理
      const batchSize = 10;
      const batches: string[][] = [];
      
      for (let i = 0; i < householdIds.length; i += batchSize) {
        batches.push(householdIds.slice(i, i + batchSize));
      }

      const allHouseholds: Household[] = [];
      
      // 并行执行所有批次
      const batchPromises = batches.map(batch => 
        firebaseAuthService.queryDocuments('households', [
          { field: 'id', operator: 'in', value: batch }
        ])
      );

      const batchResults = await Promise.all(batchPromises);
      
      for (const households of batchResults) {
        allHouseholds.push(...households);
      }

      return allHouseholds;
    } catch (error) {
      console.error('Batch get households error:', error);
      
      // 降级到单个查询
      const households: Household[] = [];
      for (const householdId of householdIds) {
        try {
          const household = await this.getHouseholdById(householdId);
          if (household) households.push(household);
        } catch (e) {
          console.error(`Failed to get household ${householdId}:`, e);
        }
      }
      return households;
    }
  }

  async addHouseholdMember(member: Omit<HouseholdMember, 'user'>): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      const memberData = {
        ...member,
        joinedAt: member.joinedAt || (Platform.OS === 'web' ? new Date().toISOString() : new Date())
      };

      // Add member in Firestore
      await firebaseAuthService.createDocument('household_members', memberData, member.id);

      // Also add in local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.addHouseholdMember(member);
      }

      // 清除相关缓存
      this.clearCacheByPattern('household_members');
      
      // 清除本地存储中的成员数据
      const localKey = this.STORAGE_KEYS.MEMBERS + member.householdId;
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(localKey);
      }

    } catch (error) {
      console.error('Add household member error:', error);
      throw error;
    }
  }

  async getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // 检查缓存
      const cacheKey = this.getCacheKey('household_members', householdId);
      const cached = this.getFromCache<HouseholdMember[]>(cacheKey);
      if (cached) return cached;

      // 检查本地存储
      const localKey = this.STORAGE_KEYS.MEMBERS + householdId;
      const localCached = this.getFromLocalStorage<HouseholdMember[]>(localKey);
      if (localCached) {
        this.setCache(cacheKey, localCached);
        return localCached;
      }

      console.log('Fetching household members from Firebase...');
      performanceMonitor.startTimer(`getHouseholdMembers_${householdId}`);

      // Get memberships
      const memberships = await firebaseAuthService.queryDocuments('household_members', [
        { field: 'householdId', operator: '==', value: householdId }
      ]);

      if (memberships.length === 0) {
        const emptyResult: HouseholdMember[] = [];
        this.setCache(cacheKey, emptyResult);
        this.setLocalStorage(localKey, emptyResult);
        return emptyResult;
      }

      // 批量获取用户信息（优化：一次查询所有用户）
      const userIds = memberships.map((m: any) => m.userId);
      const users = await this.batchGetUsers(userIds);
      const userMap = new Map(users.map((u: any) => [u.id, u]));

      // 在内存中组合数据
      const members: HouseholdMember[] = memberships
        .map((membership: any) => {
          const user = userMap.get(membership.userId);
          if (!user) return null;
          
          return {
            id: membership.id,
            householdId: membership.householdId,
            userId: membership.userId,
            role: membership.role as UserRole,
            joinedAt: membership.joinedAt?.toISOString?.() || membership.joinedAt,
            user
          };
        })
        .filter(Boolean) as HouseholdMember[];

      // Sort by role (admin first) then by join date
      members.sort((a, b) => {
        if (a.role !== b.role) {
          return a.role === UserRole.ADMIN ? -1 : 1;
        }
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      });

      // 缓存结果
      this.setCache(cacheKey, members);
      this.setLocalStorage(localKey, members);

      performanceMonitor.endTimer(`getHouseholdMembers_${householdId}`);
      return members;
    } catch (error) {
      console.error('Get household members error:', error);
      
      // 尝试从本地存储获取过期数据作为后备
      const localKey = this.STORAGE_KEYS.MEMBERS + householdId;
      try {
        const stored = localStorage.getItem(localKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          console.log('Using stale data from localStorage as fallback');
          return parsed.data || [];
        }
      } catch (e) {
        console.error('Fallback localStorage read error:', e);
      }

      // Fallback to local database on error
      if (Platform.OS !== 'web') {
        return await DatabaseService.getHouseholdMembers(householdId);
      }
      return [];
    }
  }

  // 批量获取用户信息的新方法
  private async batchGetUsers(userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) return [];

    try {
      // Firebase 'in' 查询限制为10个，需要分批处理
      const batchSize = 10;
      const batches: string[][] = [];
      
      for (let i = 0; i < userIds.length; i += batchSize) {
        batches.push(userIds.slice(i, i + batchSize));
      }

      const allUsers: User[] = [];
      
      // 并行执行所有批次
      const batchPromises = batches.map(batch => 
        firebaseAuthService.queryDocuments('users', [
          { field: 'id', operator: 'in', value: batch }
        ])
      );

      const batchResults = await Promise.all(batchPromises);
      
      for (const users of batchResults) {
        allUsers.push(...users);
      }

      return allUsers;
    } catch (error) {
      console.error('Batch get users error:', error);
      
      // 降级到单个查询
      const users: User[] = [];
      for (const userId of userIds) {
        try {
          const user = await this.getUserById(userId);
          if (user) users.push(user);
        } catch (e) {
          console.error(`Failed to get user ${userId}:`, e);
        }
      }
      return users;
    }
  }

  // Health Records Management
  async createHealthRecord(record: Omit<HealthRecord, 'createdAt' | 'updatedAt'>, encryptionKey: string): Promise<string> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      // Encrypt sensitive data
      const encryptedRecordData = await EncryptionManager.encryptHealthData(record.recordData, encryptionKey);
      
      let encryptedAIData = null;
      if (record.aiProcessedData) {
        encryptedAIData = await EncryptionManager.encryptHealthData(record.aiProcessedData, encryptionKey);
      }

      const recordData = {
        ...record,
        recordData: encryptedRecordData,
        aiProcessedData: encryptedAIData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Create in Firestore
      await firebaseAuthService.createDocument('health_records', recordData, record.id);

      // Also create in local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.createHealthRecord(record, encryptionKey);
      }

      return record.id;
    } catch (error) {
      console.error('Create health record error:', error);
      throw error;
    }
  }

  async getHealthRecords(householdId: string, userId: string, userRole: UserRole, encryptionKey: string): Promise<HealthRecord[]> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      let conditions = [
        { field: 'householdId', operator: '==', value: householdId }
      ];

      // Members can only see their own records
      if (userRole === UserRole.MEMBER) {
        conditions.push({ field: 'userId', operator: '==', value: userId });
      }

      const records = await firebaseAuthService.queryDocuments('health_records', conditions);
      const healthRecords: HealthRecord[] = [];

      for (const record of records) {
        try {
          // Decrypt sensitive data
          const recordData = await EncryptionManager.decryptHealthData(record.recordData, encryptionKey);
          
          let aiProcessedData = null;
          if (record.aiProcessedData) {
            aiProcessedData = await EncryptionManager.decryptHealthData(record.aiProcessedData, encryptionKey);
          }

          healthRecords.push({
            id: record.id,
            userId: record.userId,
            householdId: record.householdId,
            title: record.title,
            description: record.description,
            recordType: record.recordType,
            recordData,
            documentPath: record.documentPath,
            aiProcessedData,
            verified: record.verified || false,
            createdBy: record.createdBy,
            createdAt: record.createdAt?.toISOString?.() || record.createdAt,
            updatedAt: record.updatedAt?.toISOString?.() || record.updatedAt,
          });
        } catch (decryptError) {
          console.error('Failed to decrypt health record:', record.id, decryptError);
          // Skip this record if decryption fails
        }
      }

      // Sort by creation date (newest first)
      healthRecords.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return healthRecords;
    } catch (error) {
      console.error('Get health records error:', error);
      // Fallback to local database on error
      if (Platform.OS !== 'web') {
        return await DatabaseService.getHealthRecords(householdId, userId, userRole, encryptionKey);
      }
      return [];
    }
  }

  async getHealthRecordById(recordId: string, encryptionKey: string): Promise<HealthRecord | null> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      const record = await firebaseAuthService.getDocument('health_records', recordId);
      
      if (record) {
        // Decrypt sensitive data
        const recordData = await EncryptionManager.decryptHealthData(record.recordData, encryptionKey);
        
        let aiProcessedData = null;
        if (record.aiProcessedData) {
          aiProcessedData = await EncryptionManager.decryptHealthData(record.aiProcessedData, encryptionKey);
        }

        return {
          id: record.id,
          userId: record.userId,
          householdId: record.householdId,
          title: record.title,
          description: record.description,
          recordType: record.recordType,
          recordData,
          documentPath: record.documentPath,
          aiProcessedData,
          verified: record.verified || false,
          createdBy: record.createdBy,
          createdAt: record.createdAt?.toDate ? record.createdAt.toDate().toISOString() : (record.createdAt || new Date().toISOString()),
          updatedAt: record.updatedAt?.toDate ? record.updatedAt.toDate().toISOString() : (record.updatedAt || new Date().toISOString()),
        };
      }

      // Fallback to local SQLite if on mobile
      if (Platform.OS !== 'web') {
        return await DatabaseService.getHealthRecordById(recordId, encryptionKey);
      }

      return null;
    } catch (error) {
      console.error('Get health record by ID error:', error);
      // Fallback to local database on error
      if (Platform.OS !== 'web') {
        return await DatabaseService.getHealthRecordById(recordId, encryptionKey);
      }
      return null;
    }
  }

  async updateHealthRecord(recordId: string, updates: any, encryptionKey: string): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      const updateData: any = { ...updates, updatedAt: new Date() };

      // Encrypt record data if provided
      if (updates.recordData) {
        updateData.recordData = await EncryptionManager.encryptHealthData(updates.recordData, encryptionKey);
      }

      // Update in Firestore
      await firebaseAuthService.updateDocument('health_records', recordId, updateData);

      // Also update in local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.updateHealthRecord(recordId, updates, encryptionKey);
      }
    } catch (error) {
      console.error('Update health record error:', error);
      throw error;
    }
  }

  async updateHealthRecordAIData(recordId: string, aiData: any, encryptionKey: string): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      // Encrypt AI data
      const encryptedAIData = await EncryptionManager.encryptHealthData(aiData, encryptionKey);

      const updateData = {
        aiProcessedData: encryptedAIData,
        updatedAt: new Date()
      };

      // Update in Firestore
      await firebaseAuthService.updateDocument('health_records', recordId, updateData);

      // Also update in local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.updateHealthRecordAIData(recordId, aiData, encryptionKey);
      }
    } catch (error) {
      console.error('Update health record AI data error:', error);
      throw error;
    }
  }

  async verifyHealthRecord(recordId: string, verified: boolean): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      const updateData = {
        verified,
        updatedAt: new Date()
      };

      // Update in Firestore
      await firebaseAuthService.updateDocument('health_records', recordId, updateData);

      // Also update in local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.verifyHealthRecord(recordId, verified);
      }
    } catch (error) {
      console.error('Verify health record error:', error);
      throw error;
    }
  }

  async deleteHealthRecord(recordId: string): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      // Delete from Firestore
      await firebaseAuthService.deleteDocument('health_records', recordId);

      // 清除相关缓存
      this.clearCacheByPattern('health_records');
      
      // 清除本地存储中的健康记录数据
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_KEYS.HEALTH_RECORDS)) {
          localStorage.removeItem(key);
        }
      }

      // Also delete from local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.deleteHealthRecord(recordId);
      }

      console.log('Health record deleted and caches cleared');
    } catch (error) {
      console.error('Delete health record error:', error);
      throw error;
    }
  }

  // Calendar Events Management
  async createCalendarEvent(event: Omit<HealthCalendarEvent, 'createdAt'>): Promise<string> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      const eventData = {
        ...event,
        createdAt: new Date()
      };

      // Create in Firestore
      await firebaseAuthService.createDocument('appointments', eventData, event.id);

      // Also create in local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.createCalendarEvent(event);
      }

      return event.id;
    } catch (error) {
      console.error('Create calendar event error:', error);
      throw error;
    }
  }

  async getCalendarEvents(
    householdId: string,
    userId: string,
    userRole: UserRole,
    startDate?: string,
    endDate?: string
  ): Promise<HealthCalendarEvent[]> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      let conditions = [
        { field: 'householdId', operator: '==', value: householdId }
      ];

      // Members can only see their own events
      if (userRole === UserRole.MEMBER) {
        conditions.push({ field: 'userId', operator: '==', value: userId });
      }

      // Add date filters if provided
      if (startDate) {
        conditions.push({ field: 'scheduledDate', operator: '>=', value: startDate });
      }

      if (endDate) {
        conditions.push({ field: 'scheduledDate', operator: '<=', value: endDate });
      }

      const events = await firebaseAuthService.queryDocuments('appointments', conditions);
      
      return events.map((event: any) => ({
        id: event.id,
        userId: event.userId,
        householdId: event.householdId,
        title: event.title,
        description: event.description,
        appointmentType: event.appointmentType,
        scheduledDate: event.scheduledDate,
        location: event.location,
        doctorInfo: event.doctorInfo,
        googleCalendarEventId: event.googleCalendarEventId,
        createdBy: event.createdBy,
        createdAt: event.createdAt?.toISOString?.() || event.createdAt,
      })).sort((a: any, b: any) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
    } catch (error) {
      console.error('Get calendar events error:', error);
      // Fallback to local database on error
      if (Platform.OS !== 'web') {
        return await DatabaseService.getCalendarEvents(householdId, userId, userRole, startDate, endDate);
      }
      return [];
    }
  }

  async updateCalendarEvent(eventId: string, updates: any): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      const updateData = { ...updates, updatedAt: new Date() };

      // Update in Firestore
      await firebaseAuthService.updateDocument('appointments', eventId, updateData);

      // Also update in local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.updateCalendarEvent(eventId, updates);
      }
    } catch (error) {
      console.error('Update calendar event error:', error);
      throw error;
    }
  }

  async deleteCalendarEvent(eventId: string): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      // Delete from Firestore
      await firebaseAuthService.deleteDocument('appointments', eventId);

      // Also delete from local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.deleteCalendarEvent(eventId);
      }
    } catch (error) {
      console.error('Delete calendar event error:', error);
      throw error;
    }
  }

  async updateHouseholdMemberRole(memberId: string, role: UserRole): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      const updateData = {
        role,
        updatedAt: new Date()
      };

      // Update in Firestore
      await firebaseAuthService.updateDocument('household_members', memberId, updateData);

      // Also update in local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.updateHouseholdMemberRole(memberId, role);
      }
    } catch (error) {
      console.error('Update household member role error:', error);
      throw error;
    }
  }

  async removeHouseholdMember(memberId: string): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Delete from Firestore with retry
      await this.retryRequest(() => 
        firebaseAuthService.deleteDocument('household_members', memberId)
      );

      // 清除相关缓存
      this.clearCacheByPattern('household_members');
      
      // 清除本地存储中的成员数据
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_KEYS.MEMBERS)) {
          localStorage.removeItem(key);
        }
      }

      // Also delete from local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.removeHouseholdMember(memberId);
      }

      console.log('Household member removed and caches cleared');
    } catch (error) {
      console.error('Remove household member error:', error);
      throw error;
    }
  }

  async updateHousehold(householdId: string, updates: any): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      // Update in Firestore
      await firebaseAuthService.updateDocument('households', householdId, updateData);

      // Also update in local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.updateHousehold(householdId, updates);
      }
    } catch (error) {
      console.error('Update household error:', error);
      throw error;
    }
  }

  // Sync local data with Firebase (for offline support)
  async syncWithFirebase(): Promise<void> {
    try {
      if (!this.initialized || Platform.OS === 'web') {
        return; // No sync needed for web platform
      }

      console.log('Starting sync with Firebase...');
      
      // This would implement a comprehensive sync strategy
      // For now, we'll just log that sync is needed
      console.log('Sync with Firebase completed');
    } catch (error) {
      console.error('Sync with Firebase failed:', error);
    }
  }

  // 获取单个文档
  async getDocument(collection: string, docId: string): Promise<any> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      return await firebaseAuthService.getDocument(collection, docId);
    } catch (error) {
      console.error(`Get document error (${collection}/${docId}):`, error);
      throw error;
    }
  }

  // 创建文档
  async createDocument(collection: string, data: any, docId?: string): Promise<string> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      const timestamp = Platform.OS === 'web' ? new Date().toISOString() : new Date();
      const documentData = {
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      
      if (docId) {
        await firebaseAuthService.createDocument(collection, documentData, docId);
        return docId;
      } else {
        return await firebaseAuthService.createDocument(collection, documentData);
      }
    } catch (error) {
      console.error(`Create document error (${collection}):`, error);
      throw error;
    }
  }

  // 更新文档
  async updateDocument(collection: string, docId: string, updates: any): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      const timestamp = Platform.OS === 'web' ? new Date().toISOString() : new Date();
      const updateData = {
        ...updates,
        updatedAt: timestamp
      };
      
      await firebaseAuthService.updateDocument(collection, docId, updateData);
    } catch (error) {
      console.error(`Update document error (${collection}/${docId}):`, error);
      throw error;
    }
  }

  // 删除文档
  async deleteDocument(collection: string, docId: string): Promise<void> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      await firebaseAuthService.deleteDocument(collection, docId);
    } catch (error) {
      console.error(`Delete document error (${collection}/${docId}):`, error);
      throw error;
    }
  }

  // 查询文档
  async queryDocuments(collection: string, conditions: Array<{field: string, operator: string, value: any}> = []): Promise<any[]> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      
      return await firebaseAuthService.queryDocuments(collection, conditions);
    } catch (error) {
      console.error(`Query documents error (${collection}):`, error);
      throw error;
    }
  }
}

// 创建并导出单例实例
const firebaseDatabaseService = new FirebaseDatabaseService();

// 为了兼容性，添加静态方法
FirebaseDatabaseService.getDocument = (collection: string, docId: string) => {
  return firebaseDatabaseService.getDocument(collection, docId);
};

FirebaseDatabaseService.createDocument = (collection: string, data: any, docId?: string) => {
  return firebaseDatabaseService.createDocument(collection, data, docId);
};

FirebaseDatabaseService.updateDocument = (collection: string, docId: string, updates: any) => {
  return firebaseDatabaseService.updateDocument(collection, docId, updates);
};

FirebaseDatabaseService.deleteDocument = (collection: string, docId: string) => {
  return firebaseDatabaseService.deleteDocument(collection, docId);
};

FirebaseDatabaseService.queryDocuments = (collection: string, conditions: Array<{field: string, operator: string, value: any}>) => {
  return firebaseDatabaseService.queryDocuments(collection, conditions);
};

export default FirebaseDatabaseService;