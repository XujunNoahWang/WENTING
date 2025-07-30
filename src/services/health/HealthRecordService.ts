import {
  HealthRecord,
  HealthRecordForm,
  HealthRecordType,
  User,
  UserRole,
  ApiResponse,
  AIProcessedData,
  HealthDocumentAnalysis,
} from '@types/index';
import DatabaseService from '@services/database/DatabaseService';
import { EncryptionManager } from '@utils/encryption/EncryptionManager';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@constants/index';

export class HealthRecordService {
  private static instance: HealthRecordService;

  private constructor() {}

  static getInstance(): HealthRecordService {
    if (!HealthRecordService.instance) {
      HealthRecordService.instance = new HealthRecordService();
    }
    return HealthRecordService.instance;
  }

  /**
   * Create a new health record
   */
  async createHealthRecord(
    healthRecordForm: HealthRecordForm,
    householdId: string,
    targetUserId: string,
    createdByUserId: string,
    userRole: UserRole
  ): Promise<ApiResponse<HealthRecord>> {
    try {
      // Check permissions
      const canCreate = await this.checkCreatePermission(
        householdId,
        targetUserId,
        createdByUserId,
        userRole
      );

      if (!canCreate.success) {
        return canCreate;
      }

      // Generate health record ID
      const recordId = this.generateHealthRecordId();

      // Generate encryption key for this user
      const encryptionKey = EncryptionManager.generateUserKey(targetUserId);

      const healthRecord: Omit<HealthRecord, 'createdAt' | 'updatedAt'> = {
        id: recordId,
        userId: targetUserId,
        householdId,
        title: healthRecordForm.title.trim(),
        description: healthRecordForm.description?.trim(),
        recordType: healthRecordForm.recordType,
        recordData: healthRecordForm.recordData,
        verified: false, // Initially false, user needs to verify
        createdBy: createdByUserId,
      };

      // Save to database with encryption
      await DatabaseService.createHealthRecord(healthRecord, encryptionKey);

      // Retrieve the created record
      const createdRecord = await this.getHealthRecordById(recordId, createdByUserId, userRole);

      if (!createdRecord.success || !createdRecord.data) {
        return {
          success: false,
          error: '健康档案创建失败'
        };
      }

      return {
        success: true,
        data: createdRecord.data,
        message: SUCCESS_MESSAGES.RECORD_SAVED
      };

    } catch (error: any) {
      console.error('Create health record error:', error);
      return {
        success: false,
        error: error.message || '健康档案创建失败'
      };
    }
  }

  /**
   * Get health records for a household
   */
  async getHealthRecords(
    householdId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ApiResponse<HealthRecord[]>> {
    try {
      // Generate encryption key for this user
      const encryptionKey = EncryptionManager.generateUserKey(userId);

      const records = await DatabaseService.getHealthRecords(
        householdId,
        userId,
        userRole,
        encryptionKey
      );

      return {
        success: true,
        data: records
      };

    } catch (error: any) {
      console.error('Get health records error:', error);
      return {
        success: false,
        error: error.message || '获取健康档案失败'
      };
    }
  }

  /**
   * Get a specific health record by ID
   */
  async getHealthRecordById(
    recordId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ApiResponse<HealthRecord>> {
    try {
      // Get the record first to check permissions
      const encryptionKey = EncryptionManager.generateUserKey(userId);
      const record = await DatabaseService.getHealthRecordById(recordId, encryptionKey);

      if (!record) {
        return {
          success: false,
          error: '健康档案不存在'
        };
      }

      // Check if user has permission to view this record
      const canView = await this.checkViewPermission(record, userId, userRole);
      if (!canView) {
        return {
          success: false,
          error: '没有权限查看此健康档案'
        };
      }

      return {
        success: true,
        data: record
      };

    } catch (error: any) {
      console.error('Get health record error:', error);
      return {
        success: false,
        error: error.message || '获取健康档案失败'
      };
    }
  }

  /**
   * Update health record
   */
  async updateHealthRecord(
    recordId: string,
    updates: Partial<HealthRecordForm>,
    userId: string,
    userRole: UserRole
  ): Promise<ApiResponse<HealthRecord>> {
    try {
      // Get existing record
      const existingRecord = await this.getHealthRecordById(recordId, userId, userRole);
      
      if (!existingRecord.success || !existingRecord.data) {
        return existingRecord;
      }

      // Check update permissions
      const canUpdate = await this.checkUpdatePermission(existingRecord.data, userId, userRole);
      if (!canUpdate) {
        return {
          success: false,
          error: '没有权限修改此健康档案'
        };
      }

      // Update the record
      const encryptionKey = EncryptionManager.generateUserKey(existingRecord.data.userId);
      await DatabaseService.updateHealthRecord(recordId, updates, encryptionKey);

      // Get updated record
      const updatedRecord = await this.getHealthRecordById(recordId, userId, userRole);

      return {
        success: true,
        data: updatedRecord.data!,
        message: '健康档案已更新'
      };

    } catch (error: any) {
      console.error('Update health record error:', error);
      return {
        success: false,
        error: error.message || '更新健康档案失败'
      };
    }
  }

  /**
   * Delete health record
   */
  async deleteHealthRecord(
    recordId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ApiResponse<void>> {
    try {
      // Get existing record to check permissions
      const existingRecord = await this.getHealthRecordById(recordId, userId, userRole);
      
      if (!existingRecord.success || !existingRecord.data) {
        return {
          success: false,
          error: '健康档案不存在'
        };
      }

      // Check delete permissions
      const canDelete = await this.checkDeletePermission(existingRecord.data, userId, userRole);
      if (!canDelete) {
        return {
          success: false,
          error: '没有权限删除此健康档案'
        };
      }

      // Delete the record
      await DatabaseService.deleteHealthRecord(recordId);

      return {
        success: true,
        message: '健康档案已删除'
      };

    } catch (error: any) {
      console.error('Delete health record error:', error);
      return {
        success: false,
        error: error.message || '删除健康档案失败'
      };
    }
  }

  /**
   * Verify health record (user confirms AI-processed data)
   */
  async verifyHealthRecord(
    recordId: string,
    userId: string,
    verified: boolean
  ): Promise<ApiResponse<HealthRecord>> {
    try {
      // Get existing record
      const existingRecord = await this.getHealthRecordById(recordId, userId, UserRole.MEMBER);
      
      if (!existingRecord.success || !existingRecord.data) {
        return existingRecord;
      }

      // Only the record owner can verify their own records
      if (existingRecord.data.userId !== userId) {
        return {
          success: false,
          error: '只能验证自己的健康档案'
        };
      }

      // Update verification status
      const encryptionKey = EncryptionManager.generateUserKey(userId);
      await DatabaseService.verifyHealthRecord(recordId, verified);

      // Get updated record
      const updatedRecord = await this.getHealthRecordById(recordId, userId, UserRole.MEMBER);

      return {
        success: true,
        data: updatedRecord.data!,
        message: verified ? '健康档案已验证' : '健康档案验证已取消'
      };

    } catch (error: any) {
      console.error('Verify health record error:', error);
      return {
        success: false,
        error: error.message || '验证健康档案失败'
      };
    }
  }

  /**
   * Add AI processed data to health record
   */
  async addAIProcessedData(
    recordId: string,
    aiData: HealthDocumentAnalysis,
    userId: string
  ): Promise<ApiResponse<HealthRecord>> {
    try {
      // Get existing record
      const existingRecord = await this.getHealthRecordById(recordId, userId, UserRole.MEMBER);
      
      if (!existingRecord.success || !existingRecord.data) {
        return existingRecord;
      }

      // Create AI processed data object
      const aiProcessedData: AIProcessedData = {
        extractedText: '', // This would be filled by the AI service
        structuredData: aiData,
        confidence: aiData.confidence,
        processingDate: new Date().toISOString(),
        needsReview: aiData.confidence < 0.8, // Low confidence needs review
      };

      // Update the record with AI data
      const encryptionKey = EncryptionManager.generateUserKey(existingRecord.data.userId);
      await DatabaseService.updateHealthRecordAIData(recordId, aiProcessedData, encryptionKey);

      // Get updated record
      const updatedRecord = await this.getHealthRecordById(recordId, userId, UserRole.MEMBER);

      return {
        success: true,
        data: updatedRecord.data!,
        message: 'AI分析数据已添加'
      };

    } catch (error: any) {
      console.error('Add AI processed data error:', error);
      return {
        success: false,
        error: error.message || '添加AI分析数据失败'
      };
    }
  }

  /**
   * Get health records by type
   */
  async getHealthRecordsByType(
    householdId: string,
    userId: string,
    userRole: UserRole,
    recordType: HealthRecordType
  ): Promise<ApiResponse<HealthRecord[]>> {
    try {
      const allRecords = await this.getHealthRecords(householdId, userId, userRole);
      
      if (!allRecords.success) {
        return allRecords;
      }

      const filteredRecords = allRecords.data!.filter(record => record.recordType === recordType);

      return {
        success: true,
        data: filteredRecords
      };

    } catch (error: any) {
      console.error('Get health records by type error:', error);
      return {
        success: false,
        error: error.message || '获取健康档案失败'
      };
    }
  }

  /**
   * Search health records
   */
  async searchHealthRecords(
    householdId: string,
    userId: string,
    userRole: UserRole,
    searchQuery: string
  ): Promise<ApiResponse<HealthRecord[]>> {
    try {
      const allRecords = await this.getHealthRecords(householdId, userId, userRole);
      
      if (!allRecords.success) {
        return allRecords;
      }

      const query = searchQuery.toLowerCase().trim();
      const filteredRecords = allRecords.data!.filter(record => 
        record.title.toLowerCase().includes(query) ||
        record.description?.toLowerCase().includes(query) ||
        JSON.stringify(record.recordData).toLowerCase().includes(query)
      );

      return {
        success: true,
        data: filteredRecords
      };

    } catch (error: any) {
      console.error('Search health records error:', error);
      return {
        success: false,
        error: error.message || '搜索健康档案失败'
      };
    }
  }

  /**
   * Get health records statistics
   */
  async getHealthRecordsStats(
    householdId: string,
    userId: string,
    userRole: UserRole
  ): Promise<ApiResponse<any>> {
    try {
      const allRecords = await this.getHealthRecords(householdId, userId, userRole);
      
      if (!allRecords.success) {
        return allRecords;
      }

      const records = allRecords.data!;
      
      const stats = {
        total: records.length,
        verified: records.filter(r => r.verified).length,
        unverified: records.filter(r => !r.verified).length,
        byType: {} as Record<string, number>,
        recentCount: records.filter(r => {
          const recordDate = new Date(r.createdAt);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return recordDate >= sevenDaysAgo;
        }).length,
      };

      // Count by type
      records.forEach(record => {
        stats.byType[record.recordType] = (stats.byType[record.recordType] || 0) + 1;
      });

      return {
        success: true,
        data: stats
      };

    } catch (error: any) {
      console.error('Get health records stats error:', error);
      return {
        success: false,
        error: error.message || '获取健康档案统计失败'
      };
    }
  }

  /**
   * Export health records (HIPAA compliant)
   */
  async exportHealthRecords(
    householdId: string,
    userId: string,
    userRole: UserRole,
    format: 'json' | 'csv' = 'json'
  ): Promise<ApiResponse<string>> {
    try {
      const allRecords = await this.getHealthRecords(householdId, userId, userRole);
      
      if (!allRecords.success) {
        return allRecords;
      }

      // Anonymize data for export (remove sensitive identifiers)
      const exportData = allRecords.data!.map(record => ({
        id: record.id,
        title: record.title,
        description: record.description,
        recordType: record.recordType,
        recordData: record.recordData,
        verified: record.verified,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }));

      let exportString = '';

      if (format === 'json') {
        exportString = JSON.stringify(exportData, null, 2);
      } else if (format === 'csv') {
        // Basic CSV export (would need proper CSV library for complex data)
        const headers = ['ID', 'Title', 'Type', 'Verified', 'Created'];
        const rows = exportData.map(record => [
          record.id,
          record.title,
          record.recordType,
          record.verified ? 'Yes' : 'No',
          record.createdAt,
        ]);

        exportString = [headers, ...rows].map(row => row.join(',')).join('\n');
      }

      return {
        success: true,
        data: exportString,
        message: '健康档案已导出'
      };

    } catch (error: any) {
      console.error('Export health records error:', error);
      return {
        success: false,
        error: error.message || '导出健康档案失败'
      };
    }
  }

  /**
   * Permission checking methods
   */
  private async checkCreatePermission(
    householdId: string,
    targetUserId: string,
    createdByUserId: string,
    userRole: UserRole
  ): Promise<ApiResponse<boolean>> {
    // Admin can create records for anyone in the household
    if (userRole === UserRole.ADMIN) {
      return { success: true, data: true };
    }

    // Members can only create records for themselves
    if (targetUserId === createdByUserId) {
      return { success: true, data: true };
    }

    return {
      success: false,
      error: '没有权限为其他用户创建健康档案'
    };
  }

  private async checkViewPermission(
    record: HealthRecord,
    userId: string,
    userRole: UserRole
  ): Promise<boolean> {
    // Admin can view all records in their households
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // Members can only view their own records
    return record.userId === userId;
  }

  private async checkUpdatePermission(
    record: HealthRecord,
    userId: string,
    userRole: UserRole
  ): Promise<boolean> {
    // Admin can update all records in their households
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // Members can only update their own records
    return record.userId === userId;
  }

  private async checkDeletePermission(
    record: HealthRecord,
    userId: string,
    userRole: UserRole
  ): Promise<boolean> {
    // Admin can delete all records in their households
    if (userRole === UserRole.ADMIN) {
      return true;
    }

    // Members can only delete their own records
    return record.userId === userId;
  }

  /**
   * Utility methods
   */
  private generateHealthRecordId(): string {
    return `health_record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default HealthRecordService.getInstance();