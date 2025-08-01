import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, FONTS, SPACING, SUCCESS_MESSAGES } from '@constants/index';
import { 
  HealthRecord, 
  HealthRecordForm, 
  HealthRecordType, 
  User, 
  Household,
  UserRole,
} from '@types/index';
import Button from '@components/common/Button';
import Input from '@components/common/Input';
import HealthRecordService from '@services/health/HealthRecordService';
import HouseholdService from '@services/household/HouseholdService';
import AuthService from '@services/auth/AuthService';

const HealthRecordsScreen: React.FC = () => {
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>('');
  const [createForm, setCreateForm] = useState<HealthRecordForm>({
    title: '',
    description: '',
    recordType: HealthRecordType.VITAL_SIGNS,
    recordData: {},
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const user = await AuthService.getCurrentUser();
      if (!user) {
        Alert.alert('错误', '请先登录');
        return;
      }
      setCurrentUser(user);

      // Get user's households
      const householdsResult = await HouseholdService.getUserHouseholds(user.id);
      if (householdsResult.success && householdsResult.data) {
        setHouseholds(householdsResult.data);
        
        if (householdsResult.data.length > 0) {
          const firstHouseholdId = householdsResult.data[0].id;
          setSelectedHouseholdId(firstHouseholdId);
          
          // Load health records for the first household
          await loadHealthRecords(firstHouseholdId, user.id);
        }
      }
    } catch (error) {
      console.error('Load health records data error:', error);
      Alert.alert('错误', '加载健康档案数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  const loadHealthRecords = async (householdId: string, userId: string) => {
    try {
      const recordsResult = await HealthRecordService.getHealthRecords(
        householdId,
        userId,
        UserRole.MEMBER // Assuming member role for now
      );
      
      if (recordsResult.success && recordsResult.data) {
        setHealthRecords(recordsResult.data);
      }
    } catch (error) {
      console.error('Load health records error:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleCreateHealthRecord = async () => {
    if (!createForm.title.trim()) {
      Alert.alert('错误', '请输入健康档案标题');
      return;
    }

    if (!currentUser || !selectedHouseholdId) {
      Alert.alert('错误', '用户或家庭信息获取失败');
      return;
    }

    try {
      setIsCreating(true);
      
      // Create basic record data based on type
      let recordData = {};
      
      switch (createForm.recordType) {
        case HealthRecordType.VITAL_SIGNS:
          recordData = {
            vitals: {
              bloodPressure: { systolic: 0, diastolic: 0 },
              heartRate: 0,
              temperature: 0,
              weight: 0,
            }
          };
          break;
        case HealthRecordType.MEDICATION:
          recordData = {
            medication: {
              name: '',
              dosage: '',
              frequency: '',
              instructions: '',
            }
          };
          break;
        case HealthRecordType.DIAGNOSIS:
          recordData = {
            diagnosis: {
              condition: '',
              severity: '',
              diagnosedDate: new Date().toISOString(),
              notes: '',
            }
          };
          break;
        default:
          recordData = {};
      }

      const recordForm: HealthRecordForm = {
        ...createForm,
        recordData,
      };
      
      const result = await HealthRecordService.createHealthRecord(
        recordForm,
        selectedHouseholdId,
        currentUser.id,
        currentUser.id,
        UserRole.MEMBER
      );
      
      if (result.success) {
        Alert.alert('成功', SUCCESS_MESSAGES.RECORD_SAVED);
        setShowCreateModal(false);
        setCreateForm({
          title: '',
          description: '',
          recordType: HealthRecordType.VITAL_SIGNS,
          recordData: {},
        });
        await loadHealthRecords(selectedHouseholdId, currentUser.id);
      } else {
        Alert.alert('错误', result.error || '健康档案创建失败');
      }
    } catch (error) {
      console.error('Create health record error:', error);
      Alert.alert('错误', '健康档案创建失败');
    } finally {
      setIsCreating(false);
    }
  };

  const getRecordTypeLabel = (type: HealthRecordType): string => {
    const labels = {
      [HealthRecordType.VITAL_SIGNS]: '生命体征',
      [HealthRecordType.MEDICATION]: '用药记录',
      [HealthRecordType.DIAGNOSIS]: '诊断记录',
      [HealthRecordType.ALLERGY]: '过敏记录',
      [HealthRecordType.VACCINATION]: '疫苗记录',
      [HealthRecordType.LAB_RESULT]: '检验结果',
      [HealthRecordType.MEDICAL_HISTORY]: '病史记录',
    };
    return labels[type] || type;
  };

  const getRecordTypeIcon = (type: HealthRecordType): string => {
    const icons = {
      [HealthRecordType.VITAL_SIGNS]: 'heart-outline',
      [HealthRecordType.MEDICATION]: 'medical-outline',
      [HealthRecordType.DIAGNOSIS]: 'document-text-outline',
      [HealthRecordType.ALLERGY]: 'warning-outline',
      [HealthRecordType.VACCINATION]: 'shield-checkmark-outline',
      [HealthRecordType.LAB_RESULT]: 'flask-outline',
      [HealthRecordType.MEDICAL_HISTORY]: 'time-outline',
    };
    return icons[type] || 'document-outline';
  };

  const renderHealthRecordCard = (record: HealthRecord) => {
    return (
      <TouchableOpacity 
        key={record.id} 
        style={styles.recordCard}
        onPress={() => {
          Alert.alert('提示', '健康档案详情页面开发中...');
        }}
      >
        <View style={styles.recordHeader}>
          <View style={styles.recordIconContainer}>
            <Icon 
              name={getRecordTypeIcon(record.recordType)} 
              size={24} 
              color={COLORS.PRIMARY} 
            />
          </View>
          <View style={styles.recordInfo}>
            <Text style={styles.recordTitle}>{record.title}</Text>
            <Text style={styles.recordType}>
              {getRecordTypeLabel(record.recordType)}
            </Text>
          </View>
          <View style={styles.recordStatus}>
            {record.verified ? (
              <Icon name="checkmark-circle" size={20} color={COLORS.SUCCESS} />
            ) : (
              <Icon name="time-outline" size={20} color={COLORS.WARNING} />
            )}
          </View>
        </View>
        
        {record.description && (
          <Text style={styles.recordDescription}>{record.description}</Text>
        )}

        <View style={styles.recordFooter}>
          <Text style={styles.recordDate}>
            创建于 {new Date(record.createdAt).toLocaleDateString('zh-CN')}
          </Text>
          <Text style={styles.recordVerificationStatus}>
            {record.verified ? '已验证' : '待验证'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCreateModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setShowCreateModal(false)}
            style={styles.closeButton}
          >
            <Icon name="close" size={24} color={COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>创建健康档案</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.modalContent}>
          <Input
            label="档案标题"
            placeholder="输入健康档案标题"
            value={createForm.title}
            onChangeText={(text) => setCreateForm({ ...createForm, title: text })}
            required
          />
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>档案类型 *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.typeButtons}>
                {Object.values(HealthRecordType).map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      createForm.recordType === type && styles.typeButtonSelected
                    ]}
                    onPress={() => setCreateForm({ ...createForm, recordType: type })}
                  >
                    <Icon 
                      name={getRecordTypeIcon(type)}
                      size={20}
                      color={createForm.recordType === type ? COLORS.SURFACE : COLORS.TEXT_SECONDARY}
                    />
                    <Text style={[
                      styles.typeButtonText,
                      createForm.recordType === type && styles.typeButtonTextSelected
                    ]}>
                      {getRecordTypeLabel(type)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <Input
            label="档案描述"
            placeholder="输入健康档案描述（可选）"
            value={createForm.description}
            onChangeText={(text) => setCreateForm({ ...createForm, description: text })}
            multiline
            numberOfLines={3}
            style={{ height: 80 }}
          />

          <Text style={styles.infoText}>
            创建档案后，您可以添加具体的健康数据和文档。AI将帮助分析和整理您的健康信息。
          </Text>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Button
            title="取消"
            variant="outline"
            onPress={() => setShowCreateModal(false)}
            style={styles.footerButton}
          />
          <Button
            title="创建"
            variant="primary"
            onPress={handleCreateHealthRecord}
            loading={isCreating}
            style={styles.footerButton}
          />
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>健康档案</Text>
          <Text style={styles.subtitle}>
            {households.length > 0 ? households[0].name : '暂无家庭'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Icon name="add" size={24} color={COLORS.PRIMARY} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {healthRecords.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="document-text-outline" size={80} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.emptyTitle}>暂无健康档案</Text>
            <Text style={styles.emptyDescription}>
              创建您的第一个健康档案，开始记录和管理健康数据
            </Text>
            <Button
              title="创建档案"
              variant="primary"
              onPress={() => setShowCreateModal(true)}
              style={styles.createButton}
            />
          </View>
        ) : (
          <View style={styles.recordsList}>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{healthRecords.length}</Text>
                <Text style={styles.statLabel}>总档案</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {healthRecords.filter(r => r.verified).length}
                </Text>
                <Text style={styles.statLabel}>已验证</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {healthRecords.filter(r => !r.verified).length}
                </Text>
                <Text style={styles.statLabel}>待验证</Text>
              </View>
            </View>
            
            {healthRecords.map(renderHealthRecordCard)}
          </View>
        )}
      </ScrollView>

      {renderCreateModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.LG,
    paddingBottom: SPACING.MD,
  },
  title: {
    fontSize: FONTS.SIZES.XLARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
  },
  subtitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    marginTop: SPACING.XS,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    marginTop: SPACING.XXL,
  },
  emptyTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.LG,
    marginBottom: SPACING.SM,
  },
  emptyDescription: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.LG,
  },
  createButton: {
    marginTop: SPACING.MD,
  },
  recordsList: {
    paddingHorizontal: SPACING.LG,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    padding: SPACING.LG,
    marginBottom: SPACING.LG,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FONTS.SIZES.XLARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY,
  },
  statLabel: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    marginTop: SPACING.XS,
  },
  recordCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    padding: SPACING.LG,
    marginBottom: SPACING.MD,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  recordIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${COLORS.PRIMARY}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.MD,
  },
  recordInfo: {
    flex: 1,
  },
  recordTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
  },
  recordType: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    marginTop: SPACING.XS,
  },
  recordStatus: {
    marginLeft: SPACING.SM,
  },
  recordDescription: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
    marginBottom: SPACING.SM,
  },
  recordFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordDate: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
  },
  recordVerificationStatus: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
  },
  placeholder: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.LG,
  },
  inputGroup: {
    marginBottom: SPACING.MD,
  },
  inputLabel: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SM,
  },
  typeButtons: {
    flexDirection: 'row',
    paddingBottom: SPACING.SM,
  },
  typeButton: {
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    marginRight: SPACING.SM,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 100,
  },
  typeButtonSelected: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  typeButtonText: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    marginLeft: SPACING.XS,
  },
  typeButtonTextSelected: {
    color: COLORS.SURFACE,
  },
  infoText: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 18,
    marginTop: SPACING.MD,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.LG,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  footerButton: {
    flex: 1,
    marginHorizontal: SPACING.XS,
  },
});

export default HealthRecordsScreen;