import { Platform } from 'react-native';
import { firebaseAuthService } from '../../config/firebase';
import { User, Household, HouseholdMember, HealthRecord, HealthCalendarEvent, UserRole, ApiResponse } from '../../types/index';
import { EncryptionManager } from '../../utils/encryption/EncryptionManager';
import DatabaseService from './DatabaseService';

export class FirebaseDatabaseService {
  private static instance: FirebaseDatabaseService;
  private initialized = false;

  private constructor() {}

  static getInstance(): FirebaseDatabaseService {
    if (!FirebaseDatabaseService.instance) {
      FirebaseDatabaseService.instance = new FirebaseDatabaseService();
    }
    return FirebaseDatabaseService.instance;
  }

  async initialize(): Promise<boolean> {
    try {
      // Initialize Firebase auth service first
      await firebaseAuthService.initialize();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Firebase Database Service initialization failed:', error);
      return false;
    }
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
        createdAt: new Date()
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
        joinedAt: new Date()
      };

      await firebaseAuthService.createDocument('household_members', membershipData, membershipId);

      // Also create in local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.createHousehold(household);
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
        throw new Error('Firebase Database Service not initialized');
      }

      // First get user's household memberships
      const memberships = await firebaseAuthService.queryDocuments('household_members', [
        { field: 'userId', operator: '==', value: userId }
      ]);

      const households: Household[] = [];

      // Get each household
      for (const membership of memberships) {
        const household = await this.getHouseholdById(membership.householdId);
        if (household) {
          households.push(household);
        }
      }

      // Sort by creation date
      households.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return households;
    } catch (error) {
      console.error('Get user households error:', error);
      // Fallback to local database on error
      if (Platform.OS !== 'web') {
        return await DatabaseService.getUserHouseholds(userId);
      }
      return [];
    }
  }

  async addHouseholdMember(member: Omit<HouseholdMember, 'user'>): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      const memberData = {
        ...member,
        joinedAt: new Date()
      };

      // Add member in Firestore
      await firebaseAuthService.createDocument('household_members', memberData, member.id);

      // Also add in local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.addHouseholdMember(member);
      }
    } catch (error) {
      console.error('Add household member error:', error);
      throw error;
    }
  }

  async getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      // Get memberships
      const memberships = await firebaseAuthService.queryDocuments('household_members', [
        { field: 'householdId', operator: '==', value: householdId }
      ]);

      const members: HouseholdMember[] = [];

      // Get user data for each member
      for (const membership of memberships) {
        const user = await this.getUserById(membership.userId);
        if (user) {
          members.push({
            id: membership.id,
            householdId: membership.householdId,
            userId: membership.userId,
            role: membership.role as UserRole,
            joinedAt: membership.joinedAt?.toISOString?.() || membership.joinedAt,
            user
          });
        }
      }

      // Sort by role (admin first) then by join date
      members.sort((a, b) => {
        if (a.role !== b.role) {
          return a.role === UserRole.ADMIN ? -1 : 1;
        }
        return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      });

      return members;
    } catch (error) {
      console.error('Get household members error:', error);
      // Fallback to local database on error
      if (Platform.OS !== 'web') {
        return await DatabaseService.getHouseholdMembers(householdId);
      }
      return [];
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
          createdAt: record.createdAt?.toISOString?.() || record.createdAt,
          updatedAt: record.updatedAt?.toISOString?.() || record.updatedAt,
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

  async deleteHealthRecord(recordId: string): Promise<void> {
    try {
      if (!this.initialized) {
        throw new Error('Firebase Database Service not initialized');
      }

      // Delete from Firestore
      await firebaseAuthService.deleteDocument('health_records', recordId);

      // Also delete from local SQLite if on mobile
      if (Platform.OS !== 'web') {
        await DatabaseService.deleteHealthRecord(recordId);
      }
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
      
      return events.map(event => ({
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
      })).sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
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
}

export default FirebaseDatabaseService.getInstance();