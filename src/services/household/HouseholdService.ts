import {
  Household,
  HouseholdMember,
  User,
  UserRole,
  ApiResponse,
  HouseholdForm,
} from '@types/index';
import DatabaseService from '@services/database/DatabaseService';
import { EncryptionManager } from '@utils/encryption/EncryptionManager';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@constants/index';

export class HouseholdService {
  private static instance: HouseholdService;

  private constructor() {}

  static getInstance(): HouseholdService {
    if (!HouseholdService.instance) {
      HouseholdService.instance = new HouseholdService();
    }
    return HouseholdService.instance;
  }

  /**
   * Create a new household
   */
  async createHousehold(
    householdForm: HouseholdForm,
    createdBy: string
  ): Promise<ApiResponse<Household>> {
    try {
      const householdId = this.generateHouseholdId();
      
      const household: Omit<Household, 'createdAt'> = {
        id: householdId,
        name: householdForm.name.trim(),
        description: householdForm.description?.trim(),
        createdBy,
      };

      await DatabaseService.createHousehold(household);

      const createdHousehold = await DatabaseService.getHouseholdById(householdId);
      
      if (!createdHousehold) {
        return {
          success: false,
          error: '家庭创建失败'
        };
      }

      return {
        success: true,
        data: createdHousehold,
        message: SUCCESS_MESSAGES.HOUSEHOLD_CREATED
      };

    } catch (error: any) {
      console.error('Create household error:', error);
      return {
        success: false,
        error: error.message || '家庭创建失败'
      };
    }
  }

  /**
   * Get user's households
   */
  async getUserHouseholds(userId: string): Promise<ApiResponse<Household[]>> {
    try {
      const households = await DatabaseService.getUserHouseholds(userId);
      
      return {
        success: true,
        data: households
      };

    } catch (error: any) {
      console.error('Get user households error:', error);
      return {
        success: false,
        error: error.message || '获取家庭列表失败'
      };
    }
  }

  /**
   * Get household details by ID
   */
  async getHouseholdById(householdId: string): Promise<ApiResponse<Household>> {
    try {
      const household = await DatabaseService.getHouseholdById(householdId);
      
      if (!household) {
        return {
          success: false,
          error: '家庭不存在'
        };
      }

      return {
        success: true,
        data: household
      };

    } catch (error: any) {
      console.error('Get household error:', error);
      return {
        success: false,
        error: error.message || '获取家庭信息失败'
      };
    }
  }

  /**
   * Get household members
   */
  async getHouseholdMembers(householdId: string): Promise<ApiResponse<HouseholdMember[]>> {
    try {
      const members = await DatabaseService.getHouseholdMembers(householdId);
      
      return {
        success: true,
        data: members
      };

    } catch (error: any) {
      console.error('Get household members error:', error);
      return {
        success: false,
        error: error.message || '获取家庭成员失败'
      };
    }
  }

  /**
   * Invite user to household (generate invitation)
   */
  async inviteUserToHousehold(
    householdId: string,
    inviterUserId: string,
    inviteeIdentifier: string, // email or phone
    role: UserRole = UserRole.MEMBER
  ): Promise<ApiResponse<string>> {
    try {
      // Check if inviter has admin privileges
      const members = await DatabaseService.getHouseholdMembers(householdId);
      const inviter = members.find(m => m.userId === inviterUserId);
      
      if (!inviter || inviter.role !== UserRole.ADMIN) {
        return {
          success: false,
          error: '只有管理员可以邀请成员'
        };
      }

      // Check if invitee exists
      let inviteeUser: User | null = null;
      
      if (inviteeIdentifier.includes('@')) {
        inviteeUser = await DatabaseService.getUserByEmail(inviteeIdentifier);
      } else {
        // Assume it's a phone number - would need a getUserByPhone method
        // inviteeUser = await DatabaseService.getUserByPhone(inviteeIdentifier);
      }

      if (!inviteeUser) {
        return {
          success: false,
          error: '被邀请的用户不存在'
        };
      }

      // Check if user is already a member
      const existingMember = members.find(m => m.userId === inviteeUser!.id);
      if (existingMember) {
        return {
          success: false,
          error: '用户已经是家庭成员'
        };
      }

      // Generate invitation token
      const invitationToken = this.generateInvitationToken(householdId, inviteeUser.id, role);

      // In a real app, this would send an email/SMS with the invitation link
      // For now, we'll return the invitation token
      
      return {
        success: true,
        data: invitationToken,
        message: SUCCESS_MESSAGES.INVITATION_SENT
      };

    } catch (error: any) {
      console.error('Invite user error:', error);
      return {
        success: false,
        error: error.message || '邀请发送失败'
      };
    }
  }

  /**
   * Accept household invitation
   */
  async acceptInvitation(
    invitationToken: string,
    userId: string
  ): Promise<ApiResponse<HouseholdMember>> {
    try {
      // Decode invitation token
      const invitation = this.decodeInvitationToken(invitationToken);
      
      if (!invitation) {
        return {
          success: false,
          error: '无效的邀请链接'
        };
      }

      if (invitation.inviteeUserId !== userId) {
        return {
          success: false,
          error: '邀请链接与用户不匹配'
        };
      }

      // Check if invitation is expired
      if (invitation.expiresAt < Date.now()) {
        return {
          success: false,
          error: '邀请链接已过期'
        };
      }

      // Check if user is already a member
      const members = await DatabaseService.getHouseholdMembers(invitation.householdId);
      const existingMember = members.find(m => m.userId === userId);
      
      if (existingMember) {
        return {
          success: false,
          error: '您已经是该家庭成员'
        };
      }

      // Add user to household
      const memberId = this.generateMemberId();
      const newMember: Omit<HouseholdMember, 'user'> = {
        id: memberId,
        householdId: invitation.householdId,
        userId,
        role: invitation.role,
        joinedAt: new Date().toISOString(),
      };

      await DatabaseService.addHouseholdMember(newMember);

      // Get the created member with user details
      const updatedMembers = await DatabaseService.getHouseholdMembers(invitation.householdId);
      const createdMember = updatedMembers.find(m => m.id === memberId);

      if (!createdMember) {
        return {
          success: false,
          error: '加入家庭失败'
        };
      }

      return {
        success: true,
        data: createdMember,
        message: '成功加入家庭'
      };

    } catch (error: any) {
      console.error('Accept invitation error:', error);
      return {
        success: false,
        error: error.message || '加入家庭失败'
      };
    }
  }

  /**
   * Promote user to admin
   */
  async promoteToAdmin(
    householdId: string,
    adminUserId: string,
    targetUserId: string
  ): Promise<ApiResponse<void>> {
    try {
      // Check if current user is admin
      const members = await DatabaseService.getHouseholdMembers(householdId);
      const adminMember = members.find(m => m.userId === adminUserId);
      
      if (!adminMember || adminMember.role !== UserRole.ADMIN) {
        return {
          success: false,
          error: '只有管理员可以提升其他用户'
        };
      }

      // Check if target user exists in household
      const targetMember = members.find(m => m.userId === targetUserId);
      if (!targetMember) {
        return {
          success: false,
          error: '用户不在该家庭中'
        };
      }

      if (targetMember.role === UserRole.ADMIN) {
        return {
          success: false,
          error: '用户已经是管理员'
        };
      }

      // Update user role in database
      await DatabaseService.updateHouseholdMemberRole(targetMember.id, UserRole.ADMIN);

      return {
        success: true,
        message: '用户已提升为管理员'
      };

    } catch (error: any) {
      console.error('Promote to admin error:', error);
      return {
        success: false,
        error: error.message || '提升管理员失败'
      };
    }
  }

  /**
   * Remove user from household
   */
  async removeUserFromHousehold(
    householdId: string,
    adminUserId: string,
    targetUserId: string
  ): Promise<ApiResponse<void>> {
    try {
      // Check if current user is admin
      const members = await DatabaseService.getHouseholdMembers(householdId);
      const adminMember = members.find(m => m.userId === adminUserId);
      
      if (!adminMember || adminMember.role !== UserRole.ADMIN) {
        return {
          success: false,
          error: '只有管理员可以移除成员'
        };
      }

      // Check if target user exists in household
      const targetMember = members.find(m => m.userId === targetUserId);
      if (!targetMember) {
        return {
          success: false,
          error: '用户不在该家庭中'
        };
      }

      // Prevent removing the household creator (would need additional logic)
      const household = await DatabaseService.getHouseholdById(householdId);
      if (household && household.createdBy === targetUserId) {
        return {
          success: false,
          error: '不能移除家庭创建者'
        };
      }

      // Remove user from household
      await DatabaseService.removeHouseholdMember(targetMember.id);

      return {
        success: true,
        message: '用户已从家庭中移除'
      };

    } catch (error: any) {
      console.error('Remove user error:', error);
      return {
        success: false,
        error: error.message || '移除用户失败'
      };
    }
  }

  /**
   * Leave household (user leaves voluntarily)
   */
  async leaveHousehold(
    householdId: string,
    userId: string
  ): Promise<ApiResponse<void>> {
    try {
      const members = await DatabaseService.getHouseholdMembers(householdId);
      const userMember = members.find(m => m.userId === userId);
      
      if (!userMember) {
        return {
          success: false,
          error: '您不在该家庭中'
        };
      }

      // Prevent household creator from leaving if there are other members
      const household = await DatabaseService.getHouseholdById(householdId);
      if (household && household.createdBy === userId && members.length > 1) {
        return {
          success: false,
          error: '请先转让管理员权限或移除其他成员'
        };
      }

      // Remove user from household
      await DatabaseService.removeHouseholdMember(userMember.id);

      return {
        success: true,
        message: '已离开家庭'
      };

    } catch (error: any) {
      console.error('Leave household error:', error);
      return {
        success: false,
        error: error.message || '离开家庭失败'
      };
    }
  }

  /**
   * Update household information
   */
  async updateHousehold(
    householdId: string,
    adminUserId: string,
    updates: Partial<HouseholdForm>
  ): Promise<ApiResponse<Household>> {
    try {
      // Check if current user is admin
      const members = await DatabaseService.getHouseholdMembers(householdId);
      const adminMember = members.find(m => m.userId === adminUserId);
      
      if (!adminMember || adminMember.role !== UserRole.ADMIN) {
        return {
          success: false,
          error: '只有管理员可以修改家庭信息'
        };
      }

      // Update household
      await DatabaseService.updateHousehold(householdId, updates);

      // Get updated household
      const updatedHousehold = await DatabaseService.getHouseholdById(householdId);
      
      if (!updatedHousehold) {
        return {
          success: false,
          error: '更新家庭信息失败'
        };
      }

      return {
        success: true,
        data: updatedHousehold,
        message: '家庭信息已更新'
      };

    } catch (error: any) {
      console.error('Update household error:', error);
      return {
        success: false,
        error: error.message || '更新家庭信息失败'
      };
    }
  }

  /**
   * Check if user has admin privileges in household
   */
  async isHouseholdAdmin(householdId: string, userId: string): Promise<boolean> {
    try {
      const members = await DatabaseService.getHouseholdMembers(householdId);
      const userMember = members.find(m => m.userId === userId);
      
      return userMember?.role === UserRole.ADMIN;
    } catch (error) {
      console.error('Check admin privileges error:', error);
      return false;
    }
  }

  /**
   * Get user's role in household
   */
  async getUserRoleInHousehold(householdId: string, userId: string): Promise<UserRole | null> {
    try {
      const members = await DatabaseService.getHouseholdMembers(householdId);
      const userMember = members.find(m => m.userId === userId);
      
      return userMember?.role || null;
    } catch (error) {
      console.error('Get user role error:', error);
      return null;
    }
  }

  /**
   * Private helper methods
   */
  private generateHouseholdId(): string {
    return `household_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMemberId(): string {
    return `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateInvitationToken(householdId: string, inviteeUserId: string, role: UserRole): string {
    const invitation = {
      householdId,
      inviteeUserId,
      role,
      createdAt: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
    };

    // In a real app, this would be a proper JWT or encrypted token
    return Buffer.from(JSON.stringify(invitation)).toString('base64');
  }

  private decodeInvitationToken(token: string): any {
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Invalid invitation token:', error);
      return null;
    }
  }
}

export default HouseholdService.getInstance();