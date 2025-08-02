import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  TextInput,
  Modal,
  StyleSheet 
} from 'react-native';
import FirebaseDatabaseService from '../../services/database/FirebaseDatabaseService';
import { COLORS } from '../../constants/colors';
import { 
  FirebaseUser, 
  Household, 
  HouseholdMember, 
  HouseholdForm, 
  MemberForm,
  ExtendedHouseholdMember
} from '../../types/appTypes';

interface FamilyScreenProps {
  user: FirebaseUser;
  onNavigate: (screen: string) => void;
}

const MemberListSkeleton = () => (
  <View style={styles.membersList}>
    {[1, 2, 3].map((i) => (
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

const FamilyScreen: React.FC<FamilyScreenProps> = ({ user, onNavigate }) => {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [currentHousehold, setCurrentHousehold] = useState<Household | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<ExtendedHouseholdMember[]>([]);
  const [showCreateHousehold, setShowCreateHousehold] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingMember, setEditingMember] = useState<HouseholdMember | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [creatingHousehold, setCreatingHousehold] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [householdForm, setHouseholdForm] = useState<HouseholdForm>({
    name: '',
    description: '',
  });
  const [memberForm, setMemberForm] = useState<MemberForm>({
    name: '',
    email: '',
    phone: '',
    relationship: '',
    role: 'member',
  });
  const [fieldErrors, setFieldErrors] = useState({
    householdName: false,
    memberName: false,
    memberEmail: false,
    memberRelationship: false,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<HouseholdMember | null>(null);

  useEffect(() => {
    loadUserHouseholds();
  }, []);

  const loadUserHouseholds = async () => {
    if (!user.uid) {
      console.warn('用户未登录或没有用户ID');
      setInitialLoading(false);
      return;
    }

    try {
      const membershipConditions = [
        { field: 'userId', operator: '==', value: user.uid }
      ];
      
      const memberships = await FirebaseDatabaseService.queryDocuments('household_members', membershipConditions);

      if (memberships.length > 0) {
        const householdIds = memberships.map(m => m.householdId);
        const householdPromises = householdIds.map(id => 
          FirebaseDatabaseService.getDocument('households', id)
        );
        
        const householdResults = await Promise.all(householdPromises);
        const validHouseholds = householdResults.filter(h => h !== null) as Household[];
        
        setHouseholds(validHouseholds);
        
        if (validHouseholds.length > 0 && !currentHousehold) {
          setCurrentHousehold(validHouseholds[0]);
          await loadHouseholdMembers(validHouseholds[0].id);
        }
      } else {
        setHouseholds([]);
        setCurrentHousehold(null);
        setHouseholdMembers([]);
      }
    } catch (error) {
      console.error('加载家庭数据失败:', error);
      Alert.alert('错误', '加载家庭数据失败，请稍后重试');
    } finally {
      setInitialLoading(false);
    }
  };

  const loadHouseholdMembers = async (householdId: string) => {
    setMembersLoading(true);
    try {
      const memberConditions = [
        { field: 'householdId', operator: '==', value: householdId }
      ];
      
      const members = await FirebaseDatabaseService.queryDocuments('household_members', memberConditions);

      const membersWithUserInfo = await Promise.all(
        members.map(async (member) => {
          try {
            // 首先尝试使用成员记录中已保存的用户信息
            if (member.userName && member.userEmail) {
              return {
                ...member,
                user: {
                  fullName: member.userName,
                  displayName: member.userName,
                  email: member.userEmail
                },
                name: member.userName,
                email: member.userEmail,
                phone: member.userPhone || '',
                relationship: member.relationship || '家庭成员'
              };
            }

            // 如果没有保存的信息，尝试从users集合获取
            const userDoc = await FirebaseDatabaseService.getDocument('users', member.userId);
            return {
              ...member,
              user: userDoc,
              name: userDoc?.fullName || userDoc?.displayName || member.userName || '未知用户',
              email: userDoc?.email || member.userEmail || '',
              phone: userDoc?.phone || member.userPhone || '',
              relationship: member.relationship || '家庭成员'
            };
          } catch (error) {
            console.error(`获取用户信息失败 (${member.userId}):`, error);
            // 使用成员记录中的后备信息
            return {
              ...member,
              user: null,
              name: member.userName || member.inviteName || '未知用户',
              email: member.userEmail || member.inviteEmail || '',
              phone: member.userPhone || member.invitePhone || '',
              relationship: member.relationship || '家庭成员'
            };
          }
        })
      );

      setHouseholdMembers(membersWithUserInfo);
    } catch (error) {
      console.error('加载家庭成员失败:', error);
      Alert.alert('错误', '加载家庭成员失败，请稍后重试');
    } finally {
      setMembersLoading(false);
    }
  };

  const createHousehold = async () => {
    if (!householdForm.name.trim()) {
      setFieldErrors({ ...fieldErrors, householdName: true });
      Alert.alert('提示', '请输入家庭名称');
      return;
    }

    if (creatingHousehold) {
      return; // 防止重复提交
    }

    setCreatingHousehold(true);
    try {
      const householdId = `household_${Date.now()}`;
      
      const newHousehold = {
        id: householdId,
        name: householdForm.name.trim(),
        description: householdForm.description.trim(),
        createdBy: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await FirebaseDatabaseService.createDocument('households', newHousehold, householdId);

      // 创建创建者的成员记录，包含完整用户信息
      const membershipId = `${user.uid}_${householdId}`;
      const newMembership = {
        id: membershipId,
        householdId: householdId,
        userId: user.uid!,
        role: 'admin' as const,
        relationship: '家庭创建者',
        joinedAt: new Date().toISOString(),
        // 添加用户信息字段
        userName: user.fullName || user.displayName || user.email || '家庭创建者',
        userEmail: user.email || '',
        status: 'active'
      };

      await FirebaseDatabaseService.createDocument('household_members', newMembership, membershipId);

      setHouseholds([...households, newHousehold]);
      setCurrentHousehold(newHousehold);
      setHouseholdForm({ name: '', description: '' });
      setShowCreateHousehold(false);
      setFieldErrors({ ...fieldErrors, householdName: false });
      
      Alert.alert('成功', '家庭创建成功！');
      await loadHouseholdMembers(householdId);
    } catch (error) {
      console.error('创建家庭失败:', error);
      Alert.alert('错误', '创建家庭失败，请稍后重试');
    } finally {
      setCreatingHousehold(false);
    }
  };

  const addMember = async () => {
    if (!memberForm.name.trim() || !memberForm.email.trim() || !memberForm.relationship.trim()) {
      setFieldErrors({
        ...fieldErrors,
        memberName: !memberForm.name.trim(),
        memberEmail: !memberForm.email.trim(),
        memberRelationship: !memberForm.relationship.trim(),
      });
      Alert.alert('提示', '请填写所有必填信息');
      return;
    }

    if (!currentHousehold) {
      Alert.alert('错误', '请先选择一个家庭');
      return;
    }

    if (addingMember) {
      return; // 防止重复提交
    }

    setAddingMember(true);
    try {
      if (editingMember) {
        // 编辑现有成员
        const updateData = {
          userName: memberForm.name.trim(),
          userEmail: memberForm.email.trim(),
          userPhone: memberForm.phone.trim(),
          relationship: memberForm.relationship.trim(),
          role: memberForm.role,
          updatedAt: new Date().toISOString(),
        };

        await FirebaseDatabaseService.updateDocument('household_members', editingMember.id, updateData);
        Alert.alert('成功', '成员信息已更新！');
      } else {
        // 添加新成员
        const memberData = {
          householdId: currentHousehold.id,
          userId: `temp_${Date.now()}`,
          role: memberForm.role,
          relationship: memberForm.relationship.trim(),
          userName: memberForm.name.trim(),
          userEmail: memberForm.email.trim(),
          userPhone: memberForm.phone.trim(),
          inviteEmail: memberForm.email.trim(),
          inviteName: memberForm.name.trim(),
          invitePhone: memberForm.phone.trim(),
          status: 'pending',
          invitedBy: user.uid,
          invitedAt: new Date().toISOString(),
        };

        await FirebaseDatabaseService.createDocument('household_members', memberData);
        Alert.alert('成功', '成员邀请已发送！');
      }

      setMemberForm({
        name: '',
        email: '',
        phone: '',
        relationship: '',
        role: 'member',
      });
      setEditingMember(null);
      setShowAddMember(false);
      setFieldErrors({
        ...fieldErrors,
        memberName: false,
        memberEmail: false,
        memberRelationship: false,
      });

      await loadHouseholdMembers(currentHousehold.id);
    } catch (error) {
      console.error(editingMember ? '编辑成员失败:' : '添加成员失败:', error);
      Alert.alert('错误', editingMember ? '编辑成员失败，请稍后重试' : '添加成员失败，请稍后重试');
    } finally {
      setAddingMember(false);
    }
  };

  const deleteMember = async (member: HouseholdMember) => {
    if (!currentHousehold) return;

    try {
      await FirebaseDatabaseService.deleteDocument('household_members', member.id);
      
      Alert.alert('成功', '成员已移除');
      await loadHouseholdMembers(currentHousehold.id);
      setShowDeleteConfirm(false);
      setMemberToDelete(null);
    } catch (error) {
      console.error('删除成员失败:', error);
      Alert.alert('错误', '删除成员失败，请稍后重试');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => onNavigate('home')}
      >
        <Text style={styles.backButtonText}>← 返回</Text>
      </TouchableOpacity>

      <Text style={styles.screenTitle}>家庭管理</Text>

      {/* 初始加载状态 */}
      {initialLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>正在加载家庭信息...</Text>
        </View>
      ) : (
        <>
          {/* 家庭信息 */}
          {currentHousehold ? (
        <View style={styles.householdInfo}>
          <Text style={styles.householdName}>{currentHousehold.name}</Text>
          <Text style={styles.householdDescription}>
            {currentHousehold.description || '暂无描述'}
          </Text>
          <View style={styles.householdActions}>
            <TouchableOpacity
              style={styles.addMemberButton}
              onPress={() => setShowAddMember(true)}
            >
              <Text style={styles.addMemberButtonText}>+ 添加成员</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.noHouseholdContainer}>
          <Text style={styles.noHouseholdTitle}>还没有加入任何家庭</Text>
          <Text style={styles.noHouseholdText}>创建一个家庭来开始管理成员</Text>
          <TouchableOpacity
            style={styles.createHouseholdButton}
            onPress={() => setShowCreateHousehold(true)}
          >
            <Text style={styles.createHouseholdButtonText}>创建家庭</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 家庭成员列表 */}
      {currentHousehold && (
        <View style={styles.membersSection}>
          <Text style={styles.sectionTitle}>家庭成员 ({householdMembers.length})</Text>
          
          {membersLoading ? (
            <MemberListSkeleton />
          ) : (
            <View style={styles.membersList}>
              {householdMembers.map((member) => (
                <View key={member.id} style={styles.memberCard}>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member.name}</Text>
                    <Text style={styles.memberRole}>
                      {member.role === 'admin' ? '管理员' : '成员'} • {member.relationship}
                    </Text>
                    <Text style={styles.memberEmail}>{member.email}</Text>
                  </View>
                  <View style={styles.memberActions}>
                    <TouchableOpacity
                      style={styles.editMemberButton}
                      onPress={() => {
                        setEditingMember(member);
                        setMemberForm({
                          name: member.name,
                          email: member.email,
                          phone: member.phone,
                          relationship: member.relationship,
                          role: member.role
                        });
                        setShowAddMember(true);
                      }}
                    >
                      <Text style={styles.editMemberButtonText}>编辑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteMemberButton}
                      onPress={() => {
                        setMemberToDelete(member);
                        setShowDeleteConfirm(true);
                      }}
                    >
                      <Text style={styles.deleteMemberButtonText}>移除</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
        </>
      )}

      {/* 创建家庭模态框 */}
      <Modal
        visible={showCreateHousehold}
        animationType="slide"
        transparent={true}
      >
        <View style={[styles.modalOverlay, creatingHousehold && styles.loadingOverlay]}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>创建家庭</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>家庭名称 *</Text>
              <TextInput
                style={[styles.input, fieldErrors.householdName && styles.inputError]}
                value={householdForm.name}
                onChangeText={(text) => {
                  setHouseholdForm({ ...householdForm, name: text });
                  setFieldErrors({ ...fieldErrors, householdName: false });
                }}
                placeholder="请输入家庭名称"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>家庭描述</Text>
              <TextInput
                style={styles.input}
                value={householdForm.description}
                onChangeText={(text) => setHouseholdForm({ ...householdForm, description: text })}
                placeholder="请输入家庭描述（可选）"
                multiline
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelButton, creatingHousehold && styles.disabledButton]}
                onPress={() => {
                  if (creatingHousehold) return;
                  setShowCreateHousehold(false);
                  setHouseholdForm({ name: '', description: '' });
                  setFieldErrors({ ...fieldErrors, householdName: false });
                }}
                disabled={creatingHousehold}
              >
                <Text style={[styles.cancelButtonText, creatingHousehold && styles.disabledButtonText]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, creatingHousehold && styles.disabledButton]}
                onPress={createHousehold}
                disabled={creatingHousehold}
              >
                <Text style={[styles.confirmButtonText, creatingHousehold && styles.disabledButtonText]}>
                  {creatingHousehold ? '创建中...' : '创建'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 添加成员模态框 */}
      <Modal
        visible={showAddMember}
        animationType="slide"
        transparent={true}
      >
        <View style={[styles.modalOverlay, addingMember && styles.loadingOverlay]}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{editingMember ? '编辑家庭成员' : '添加家庭成员'}</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>姓名 *</Text>
              <TextInput
                style={[styles.input, fieldErrors.memberName && styles.inputError]}
                value={memberForm.name}
                onChangeText={(text) => {
                  setMemberForm({ ...memberForm, name: text });
                  setFieldErrors({ ...fieldErrors, memberName: false });
                }}
                placeholder="请输入成员姓名"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>邮箱 *</Text>
              <TextInput
                style={[styles.input, fieldErrors.memberEmail && styles.inputError]}
                value={memberForm.email}
                onChangeText={(text) => {
                  setMemberForm({ ...memberForm, email: text });
                  setFieldErrors({ ...fieldErrors, memberEmail: false });
                }}
                placeholder="请输入邮箱地址"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>关系 *</Text>
              <TextInput
                style={[styles.input, fieldErrors.memberRelationship && styles.inputError]}
                value={memberForm.relationship}
                onChangeText={(text) => {
                  setMemberForm({ ...memberForm, relationship: text });
                  setFieldErrors({ ...fieldErrors, memberRelationship: false });
                }}
                placeholder="如：父亲、母亲、孩子等"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelButton, addingMember && styles.disabledButton]}
                onPress={() => {
                  if (addingMember) return;
                  setShowAddMember(false);
                  setEditingMember(null);
                  setMemberForm({
                    name: '',
                    email: '',
                    phone: '',
                    relationship: '',
                    role: 'member',
                  });
                  setFieldErrors({
                    ...fieldErrors,
                    memberName: false,
                    memberEmail: false,
                    memberRelationship: false,
                  });
                }}
                disabled={addingMember}
              >
                <Text style={[styles.cancelButtonText, addingMember && styles.disabledButtonText]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, addingMember && styles.disabledButton]}
                onPress={addMember}
                disabled={addingMember}
              >
                <Text style={[styles.confirmButtonText, addingMember && styles.disabledButtonText]}>
                  {addingMember ? (editingMember ? '保存中...' : '添加中...') : (editingMember ? '保存' : '添加')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 删除确认模态框 */}
      <Modal
        visible={showDeleteConfirm}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>确认移除</Text>
            <Text style={styles.confirmText}>
              确定要移除成员 "{memberToDelete?.name}" 吗？此操作无法撤销。
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setMemberToDelete(null);
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => memberToDelete && deleteMember(memberToDelete)}
              >
                <Text style={styles.deleteButtonText}>移除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  householdInfo: {
    backgroundColor: COLORS.light,
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  householdName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  householdDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  householdActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  addMemberButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addMemberButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '500',
  },
  noHouseholdContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noHouseholdTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  noHouseholdText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  createHouseholdButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createHouseholdButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '600',
  },
  membersSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  membersList: {
    gap: 12,
  },
  memberCard: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editMemberButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginRight: 8,
  },
  editMemberButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '500',
  },
  deleteMemberButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  deleteMemberButtonText: {
    color: COLORS.danger,
    fontSize: 12,
    fontWeight: '500',
  },
  skeletonCard: {
    backgroundColor: COLORS.light,
  },
  skeletonAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.border,
  },
  skeletonContent: {
    flex: 1,
    marginLeft: 12,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: COLORS.border,
    borderRadius: 6,
    marginBottom: 6,
  },
  skeletonTitle: {
    width: '60%',
  },
  skeletonSubtitle: {
    width: '40%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.light,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 6,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmText: {
    fontSize: 14,
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  loadingOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledButtonText: {
    color: COLORS.textSecondary,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default FamilyScreen;