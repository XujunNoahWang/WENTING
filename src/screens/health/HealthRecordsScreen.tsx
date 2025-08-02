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
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, FONTS, SPACING, SUCCESS_MESSAGES } from '@constants/index';
import {
  HealthRecord,
  HealthRecordForm,
  HealthRecordType,
  User,
  Household,
  UserRole,
  RootStackParamList,
} from '../../types/index';
import Button from '@components/common/Button';
import Input from '@components/common/Input';
import HealthRecordService from '@services/health/HealthRecordService';
import HouseholdService from '@services/household/HouseholdService';
import AuthService from '@services/auth/AuthService';
import GeminiService from '@services/gemini/GeminiService';

type HealthRecordsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'HealthRecords'>;

const HealthRecordsScreen: React.FC = () => {
  const navigation = useNavigation<HealthRecordsScreenNavigationProp>();
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
      const recordsResult = await HealthRecordService.getInstance().getHealthRecords(
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

      const result = await HealthRecordService.getInstance().createHealthRecord(
        recordForm,
        selectedHouseholdId,
        currentUser.id,
        currentUser.id,
        UserRole.MEMBER
      );

      if (result.success && result.data) {
        // 创建成功后，生成AI健康建议
        try {
          const prompt = `
            请根据以下新创建的健康记录信息，生成个性化的健康建议：

            记录类型：${getRecordTypeLabel(createForm.recordType)}
            记录标题：${createForm.title}
            记录描述：${createForm.description || '无'}

            要求：
            1. 针对具体的健康记录类型给出专业建议
            2. 建议要实用、可行
            3. 语言温馨友好，不超过200字
            4. 如果是用药记录，重点提醒用药注意事项和安全性
            5. 如果是体征记录，提醒定期监测的重要性
            6. 如果是诊断记录，给出日常护理和预防建议
            7. 直接返回建议内容，不要包含前缀文字

            请生成健康建议：
          `;

          const aiResult = await GeminiService.generateHealthAdvice(prompt);

          if (aiResult.success && aiResult.data) {
            // 更新记录，添加AI建议
            const updatedRecordData = {
              ...recordData,
              aiAdvice: aiResult.data,
              aiAdviceGeneratedAt: new Date().toISOString(),
            };

            await HealthRecordService.getInstance().updateHealthRecord(
              result.data.id,
              { recordData: updatedRecordData },
              currentUser.id,
              UserRole.MEMBER
            );

            Alert.alert('成功', `${SUCCESS_MESSAGES.RECORD_SAVED}\n\nAI健康建议已自动生成，您可以在详情页面查看。`);
          } else {
            Alert.alert('成功', `${SUCCESS_MESSAGES.RECORD_SAVED}\n\n注意：AI建议生成失败，您可以稍后在详情页面重新生成。`);
          }
        } catch (aiError) {
          console.error('Generate AI advice error:', aiError);
          Alert.alert('成功', `${SUCCESS_MESSAGES.RECORD_SAVED}\n\n注意：AI建议生成失败，您可以稍后在详情页面重新生成。`);
        }

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

  const handleDeleteRecord = (record: HealthRecord) => {
    Alert.alert(
      '确认删除',
      `确定要删除健康档案"${record.title}"吗？此操作无法撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            if (!currentUser) {
              Alert.alert('错误', '用户信息获取失败');
              return;
            }

            try {
              const result = await HealthRecordService.getInstance().deleteHealthRecord(
                record.id,
                currentUser.id,
                UserRole.MEMBER
              );

              if (result.success) {
                Alert.alert('成功', '健康档案已删除');
                await loadHealthRecords(selectedHouseholdId, currentUser.id);
              } else {
                Alert.alert('错误', result.error || '健康档案删除失败');
              }
            } catch (error) {
              console.error('Delete health record error:', error);
              Alert.alert('错误', '健康档案删除失败');
            }
          },
        },
      ]
    );
  };

  const renderHealthRecordCard = (record: HealthRecord) => {
    return (
      <View key={record.id} style={styles.recordCard}>
        <TouchableOpacity
          style={styles.recordCardContent}
          onPress={() => {
            console.log('Card clicked, recordId:', record.id);
            console.log('Navigation object:', navigation);
            console.log('Available navigation methods:', Object.keys(navigation));

            // 直接尝试导航
            try {
              navigation.navigate('ViewHealthRecord', { recordId: record.id });
              console.log('Navigation attempted successfully');
            } catch (error) {
              console.error('Navigation error:', error);
              Alert.alert('导航错误', `无法跳转到详情页面: ${error}`);
            }
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

          {record.recordData.aiAdvice && (
            <View style={styles.aiIndicator}>
              <Icon name="bulb" size={16} color={COLORS.PRIMARY} />
              <Text style={styles.aiIndicatorText}>包含AI建议</Text>
            </View>
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

        <View style={styles.recordActions}>
          <TouchableOpacity
            style={styles.recordActionButton}
            onPress={() => handleDeleteRecord(record)}
          >
            <Icon name="trash-outline" size={18} color={COLORS.ERROR} />
          </TouchableOpacity>
        </View>
      </View>
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
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => {
              if (healthRecords.length > 0) {
                const firstRecord = healthRecords[0];
                Alert.alert(
                  '测试导航',
                  `即将跳转到记录: ${firstRecord.title}`,
                  [
                    { text: '取消', style: 'cancel' },
                    {
                      text: '跳转',
                      onPress: () => {
                        try {
                          navigation.navigate('ViewHealthRecord', { recordId: firstRecord.id });
                        } catch (error) {
                          console.error('Navigation error:', error);
                          Alert.alert('错误', '导航失败');
                        }
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('提示', '没有健康记录可以测试');
              }
            }}
          >
            <Icon name="eye" size={20} color={COLORS.SECONDARY} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Icon name="add" size={24} color={COLORS.PRIMARY} />
          </TouchableOpacity>
        </View>
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
  headerButtons: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  testButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.SECONDARY,
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
    marginBottom: SPACING.MD,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
  },
  recordCardContent: {
    flex: 1,
    padding: SPACING.LG,
  },
  recordActions: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.BORDER,
  },
  recordActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${COLORS.ERROR}15`,
    justifyContent: 'center',
    alignItems: 'center',
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
  aiIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.PRIMARY}15`,
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.XS,
    borderRadius: 12,
    marginTop: SPACING.SM,
    alignSelf: 'flex-start',
  },
  aiIndicatorText: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.PRIMARY,
    marginLeft: SPACING.XS,
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