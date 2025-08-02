import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Modal,
  TextInput,
  StyleSheet 
} from 'react-native';
import FirebaseDatabaseService from '../../services/database/FirebaseDatabaseService';
import HealthRecordService from '../../services/health/HealthRecordService';
import { COLORS } from '../../constants/colors';
import { 
  FirebaseUser, 
  HouseholdMember, 
  LocalHealthRecord,
  LocalHealthRecordForm,
  HealthRecordType,
  ExtendedHouseholdMember
} from '../../types/appTypes';

interface HealthScreenProps {
  user: FirebaseUser;
  onNavigate: (screen: string, data?: any) => void;
}

const HealthRecordsSkeleton = () => (
  <View style={styles.healthRecordsList}>
    {[1, 2, 3].map((i) => (
      <View key={i} style={[styles.healthRecordCard, styles.skeletonCard]}>
        <View style={[styles.skeletonLine, styles.skeletonTitle]} />
        <View style={[styles.skeletonLine, styles.skeletonSubtitle]} />
        <View style={[styles.skeletonLine, styles.skeletonDate]} />
      </View>
    ))}
  </View>
);

const HealthScreen: React.FC<HealthScreenProps> = ({ user, onNavigate }) => {
  const [householdMembers, setHouseholdMembers] = useState<ExtendedHouseholdMember[]>([]);
  const [currentMemberForHealth, setCurrentMemberForHealth] = useState<HouseholdMember | null>(null);
  const [healthRecords, setHealthRecords] = useState<LocalHealthRecord[]>([]);
  const [showAddHealthRecord, setShowAddHealthRecord] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [healthRecordForm, setHealthRecordForm] = useState<LocalHealthRecordForm>({
    title: '',
    description: '',
    recordType: HealthRecordType.MEDICAL_HISTORY,
    recordData: {},
  });

  useEffect(() => {
    loadHouseholdMembers();
  }, []);

  const loadHouseholdMembers = async () => {
    if (!user.uid) return;

    setMembersLoading(true);
    try {
      const membershipConditions = [
        { field: 'userId', operator: '==', value: user.uid }
      ];
      
      const memberships = await FirebaseDatabaseService.queryDocuments('household_members', membershipConditions);

      if (memberships.length > 0) {
        const householdId = memberships[0].householdId;
        
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
      }
    } catch (error) {
      console.error('加载家庭成员失败:', error);
    } finally {
      setMembersLoading(false);
    }
  };

  const loadHealthRecords = async (memberId: string) => {
    setRecordsLoading(true);
    try {
      const conditions = [
        { field: 'memberId', operator: '==', value: memberId }
      ];
      
      const records = await FirebaseDatabaseService.queryDocuments('health_records', conditions);
      
      const formattedRecords = records.map(record => ({
        ...record,
        memberName: record.memberName || currentMemberForHealth?.name || '未知用户'
      })) as LocalHealthRecord[];
      
      setHealthRecords(formattedRecords);
    } catch (error) {
      console.error('加载健康记录失败:', error);
      Alert.alert('错误', '加载健康记录失败');
    } finally {
      setRecordsLoading(false);
    }
  };

  const addHealthRecord = async () => {
    if (!healthRecordForm.title.trim() || !currentMemberForHealth) {
      Alert.alert('提示', '请填写标题并选择成员');
      return;
    }

    try {
      const recordData = {
        title: healthRecordForm.title.trim(),
        description: healthRecordForm.description?.trim() || '',
        recordType: healthRecordForm.recordType,
        recordData: healthRecordForm.recordData,
        memberId: currentMemberForHealth.id,
        memberName: currentMemberForHealth.name,
        createdBy: user.uid!,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        verified: false,
      };

      await FirebaseDatabaseService.createDocument('health_records', recordData);

      setHealthRecordForm({
        title: '',
        description: '',
        recordType: HealthRecordType.MEDICAL_HISTORY,
        recordData: {},
      });
      setShowAddHealthRecord(false);
      
      Alert.alert('成功', '健康记录添加成功！');
      await loadHealthRecords(currentMemberForHealth.id);
    } catch (error) {
      console.error('添加健康记录失败:', error);
      Alert.alert('错误', '添加健康记录失败');
    }
  };

  const getRecordTypeLabel = (type: HealthRecordType): string => {
    const labels = {
      [HealthRecordType.MEDICATION]: '用药记录',
      [HealthRecordType.DIAGNOSIS]: '诊断记录',
      [HealthRecordType.ALLERGY]: '过敏记录',
      [HealthRecordType.VACCINATION]: '疫苗记录',
      [HealthRecordType.VITAL_SIGNS]: '生命体征',
      [HealthRecordType.LAB_RESULT]: '检查结果',
      [HealthRecordType.MEDICAL_HISTORY]: '病史记录',
    };
    return labels[type] || '未知类型';
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => onNavigate('home')}
      >
        <Text style={styles.backButtonText}>← 返回</Text>
      </TouchableOpacity>

      <Text style={styles.screenTitle}>健康记录</Text>

      {/* 如果没有选择成员，显示成员选择界面 */}
      {!currentMemberForHealth ? (
        <View>
          <Text style={styles.sectionTitle}>选择家庭成员</Text>
          <Text style={styles.sectionSubtitle}>为哪位成员查看健康记录？</Text>

          {membersLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>正在加载家庭成员...</Text>
            </View>
          ) : householdMembers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>还没有家庭成员</Text>
              <Text style={styles.emptySubtext}>请先在家庭管理中添加成员</Text>
            </View>
          ) : (
            <View style={styles.memberSelectList}>
              {householdMembers.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={styles.memberSelectCard}
                  onPress={() => {
                    setCurrentMemberForHealth(member);
                    setHealthRecords([]); // 清空之前的记录
                    loadHealthRecords(member.id);
                  }}
                >
                  <Text style={styles.memberSelectName}>
                    {member.name}
                  </Text>
                  <Text style={styles.memberSelectRole}>
                    {member.role === 'admin' ? '管理员' : '成员'} • {member.relationship}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
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

          {/* 健康记录列表 */}
          <View style={styles.healthRecordsList}>
            {recordsLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>正在加载健康记录...</Text>
              </View>
            ) : healthRecords.length === 0 ? (
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
                      onNavigate('healthRecordDetail', { record });
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
                </View>
              ))
            )}
          </View>

          <TouchableOpacity
            style={styles.backToMembersButton}
            onPress={() => {
              setCurrentMemberForHealth(null);
              setHealthRecords([]);
            }}
          >
            <Text style={styles.backToMembersButtonText}>← 返回成员列表</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 添加健康记录模态框 */}
      <Modal
        visible={showAddHealthRecord}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>添加健康记录</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>标题 *</Text>
              <TextInput
                style={styles.input}
                value={healthRecordForm.title}
                onChangeText={(text) => setHealthRecordForm({ ...healthRecordForm, title: text })}
                placeholder="请输入记录标题"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>描述</Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={healthRecordForm.description}
                onChangeText={(text) => setHealthRecordForm({ ...healthRecordForm, description: text })}
                placeholder="请输入详细描述（可选）"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowAddHealthRecord(false);
                  setHealthRecordForm({
                    title: '',
                    description: '',
                    recordType: HealthRecordType.MEDICAL_HISTORY,
                    recordData: {},
                  });
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={addHealthRecord}
              >
                <Text style={styles.confirmButtonText}>添加</Text>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  memberSelectList: {
    padding: 20,
    gap: 12,
  },
  memberSelectCard: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  memberSelectName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  memberSelectRole: {
    fontSize: 12,
    color: COLORS.primary,
  },
  memberHealthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  memberHealthName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  memberHealthInfo: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  addHealthRecordButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addHealthRecordButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '500',
  },
  healthRecordsList: {
    paddingHorizontal: 20,
    gap: 12,
  },
  healthRecordCard: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  healthRecordContent: {
    padding: 16,
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
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  healthRecordType: {
    fontSize: 12,
    color: COLORS.primary,
    backgroundColor: COLORS.light,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  healthRecordDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  aiIndicator: {
    backgroundColor: COLORS.warning + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  aiIndicatorText: {
    fontSize: 12,
    color: COLORS.warning,
    fontWeight: '500',
  },
  healthRecordDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  noRecordsContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noRecordsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  noRecordsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  backToMembersButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 20,
  },
  backToMembersButtonText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
  },
  skeletonCard: {
    backgroundColor: COLORS.light,
    padding: 16,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: COLORS.border,
    borderRadius: 6,
    marginBottom: 8,
  },
  skeletonTitle: {
    width: '70%',
  },
  skeletonSubtitle: {
    width: '50%',
  },
  skeletonDate: {
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
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
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
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default HealthScreen;