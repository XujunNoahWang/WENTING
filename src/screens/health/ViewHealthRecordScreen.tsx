import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Modal,
  RefreshControl,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, FONTS, SPACING } from '@constants/index';
import { 
  HealthRecord, 
  HealthRecordForm, 
  HealthRecordType, 
  User,
  UserRole,
  RootStackParamList,
} from '../../types/index';
import Button from '@components/common/Button';
import Input from '@components/common/Input';
import HealthRecordService from '@services/health/HealthRecordService';
import AuthService from '@services/auth/AuthService';
import GeminiService from '@services/gemini/GeminiService';

type ViewHealthRecordRouteProp = RouteProp<RootStackParamList, 'ViewHealthRecord'>;
type ViewHealthRecordNavigationProp = StackNavigationProp<RootStackParamList, 'ViewHealthRecord'>;

const ViewHealthRecordScreen: React.FC = () => {
  const route = useRoute<ViewHealthRecordRouteProp>();
  const navigation = useNavigation<ViewHealthRecordNavigationProp>();
  const { recordId } = route.params || {};

  console.log('ViewHealthRecordScreen loaded with recordId:', recordId);

  if (!recordId) {
    console.error('No recordId provided to ViewHealthRecordScreen');
    return (
      <View style={styles.errorContainer}>
        <Icon name="alert-circle-outline" size={80} color={COLORS.ERROR} />
        <Text style={styles.errorTitle}>参数错误</Text>
        <Text style={styles.errorMessage}>未提供健康记录ID</Text>
        <Button
          title="返回"
          variant="primary"
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  const [healthRecord, setHealthRecord] = useState<HealthRecord | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isGeneratingAdvice, setIsGeneratingAdvice] = useState(false);
  const [showEditAdviceModal, setShowEditAdviceModal] = useState(false);
  const [editAdviceText, setEditAdviceText] = useState('');
  const [isUpdatingAdvice, setIsUpdatingAdvice] = useState(false);
  
  const [editForm, setEditForm] = useState<HealthRecordForm>({
    title: '',
    description: '',
    recordType: HealthRecordType.VITAL_SIGNS,
    recordData: {},
  });

  useEffect(() => {
    loadHealthRecord();
  }, [recordId]);

  const loadHealthRecord = async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const user = await AuthService.getCurrentUser();
      if (!user) {
        Alert.alert('错误', '请先登录');
        navigation.goBack();
        return;
      }
      setCurrentUser(user);

      // Load health record
      const result = await HealthRecordService.getInstance().getHealthRecordById(
        recordId,
        user.id,
        UserRole.MEMBER
      );
      
      if (result.success && result.data) {
        console.log('Health record loaded:', result.data);
        setHealthRecord(result.data);
        setEditForm({
          title: result.data.title,
          description: result.data.description || '',
          recordType: result.data.recordType,
          recordData: result.data.recordData,
        });
        setEditAdviceText(result.data.recordData.aiAdvice || '');
      } else {
        console.error('Failed to load health record:', result.error);
        Alert.alert('错误', result.error || '获取健康档案失败');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Load health record error:', error);
      Alert.alert('错误', '获取健康档案失败');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadHealthRecord();
    setIsRefreshing(false);
  };

  const handleEdit = () => {
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editForm.title.trim()) {
      Alert.alert('错误', '请输入健康档案标题');
      return;
    }

    if (!currentUser || !healthRecord) {
      Alert.alert('错误', '用户或健康档案信息获取失败');
      return;
    }

    try {
      setIsUpdating(true);
      
      const result = await HealthRecordService.getInstance().updateHealthRecord(
        recordId,
        editForm,
        currentUser.id,
        UserRole.MEMBER
      );
      
      if (result.success) {
        Alert.alert('成功', '健康档案已更新');
        setShowEditModal(false);
        await loadHealthRecord();
      } else {
        Alert.alert('错误', result.error || '健康档案更新失败');
      }
    } catch (error) {
      console.error('Update health record error:', error);
      Alert.alert('错误', '健康档案更新失败');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!currentUser) {
      Alert.alert('错误', '用户信息获取失败');
      return;
    }

    try {
      setIsDeleting(true);
      
      const result = await HealthRecordService.getInstance().deleteHealthRecord(
        recordId,
        currentUser.id,
        UserRole.MEMBER
      );
      
      if (result.success) {
        Alert.alert('成功', '健康档案已删除', [
          {
            text: '确定',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        Alert.alert('错误', result.error || '健康档案删除失败');
      }
    } catch (error) {
      console.error('Delete health record error:', error);
      Alert.alert('错误', '健康档案删除失败');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const generateHealthAdvice = async () => {
    if (!healthRecord) return;

    try {
      setIsGeneratingAdvice(true);

      // 构建提示词
      const prompt = `
        请根据以下健康记录信息，生成个性化的健康建议：

        记录类型：${getRecordTypeLabel(healthRecord.recordType)}
        记录标题：${healthRecord.title}
        记录描述：${healthRecord.description || '无'}
        记录数据：${JSON.stringify(healthRecord.recordData, null, 2)}

        要求：
        1. 针对具体的健康记录类型给出专业建议
        2. 建议要实用、可行
        3. 语言温馨友好，不超过200字
        4. 如果是用药记录，重点提醒用药注意事项
        5. 如果是体征记录，分析数值是否正常并给出建议
        6. 如果是诊断记录，给出日常护理和预防建议
        7. 直接返回建议内容，不要包含前缀文字

        请生成健康建议：
      `;

      const result = await GeminiService.generateHealthAdvice(prompt);
      
      if (result.success && result.data) {
        // 更新健康记录，添加AI建议
        const updatedRecordData = {
          ...healthRecord.recordData,
          aiAdvice: result.data,
          aiAdviceGeneratedAt: new Date().toISOString(),
        };

        const updateResult = await HealthRecordService.getInstance().updateHealthRecord(
          recordId,
          { recordData: updatedRecordData },
          currentUser!.id,
          UserRole.MEMBER
        );

        if (updateResult.success) {
          Alert.alert('成功', 'AI健康建议已生成并保存');
          setEditAdviceText(result.data);
          await loadHealthRecord();
        } else {
          Alert.alert('提示', `AI建议生成成功：\n\n${result.data}\n\n但保存失败，请重试。`);
        }
      } else {
        Alert.alert('错误', result.error || 'AI建议生成失败');
      }
    } catch (error) {
      console.error('Generate health advice error:', error);
      Alert.alert('错误', 'AI建议生成失败');
    } finally {
      setIsGeneratingAdvice(false);
    }
  };

  const handleEditAdvice = () => {
    setShowEditAdviceModal(true);
  };

  const handleUpdateAdvice = async () => {
    if (!editAdviceText.trim()) {
      Alert.alert('错误', '请输入AI建议内容');
      return;
    }

    if (!currentUser || !healthRecord) {
      Alert.alert('错误', '用户或健康档案信息获取失败');
      return;
    }

    try {
      setIsUpdatingAdvice(true);
      
      const updatedRecordData = {
        ...healthRecord.recordData,
        aiAdvice: editAdviceText.trim(),
        aiAdviceUpdatedAt: new Date().toISOString(),
      };

      const result = await HealthRecordService.updateHealthRecord(
        recordId,
        { recordData: updatedRecordData },
        currentUser.id,
        UserRole.MEMBER
      );
      
      if (result.success) {
        Alert.alert('成功', 'AI建议已更新');
        setShowEditAdviceModal(false);
        await loadHealthRecord();
      } else {
        Alert.alert('错误', result.error || 'AI建议更新失败');
      }
    } catch (error) {
      console.error('Update AI advice error:', error);
      Alert.alert('错误', 'AI建议更新失败');
    } finally {
      setIsUpdatingAdvice(false);
    }
  };

  const handleDeleteAdvice = () => {
    Alert.alert(
      '确认删除',
      '确定要删除AI建议吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            if (!currentUser || !healthRecord) return;

            try {
              const updatedRecordData = { ...healthRecord.recordData };
              delete updatedRecordData.aiAdvice;
              delete updatedRecordData.aiAdviceGeneratedAt;
              delete updatedRecordData.aiAdviceUpdatedAt;

              const result = await HealthRecordService.updateHealthRecord(
                recordId,
                { recordData: updatedRecordData },
                currentUser.id,
                UserRole.MEMBER
              );
              
              if (result.success) {
                Alert.alert('成功', 'AI建议已删除');
                setEditAdviceText('');
                await loadHealthRecord();
              } else {
                Alert.alert('错误', result.error || 'AI建议删除失败');
              }
            } catch (error) {
              console.error('Delete AI advice error:', error);
              Alert.alert('错误', 'AI建议删除失败');
            }
          },
        },
      ]
    );
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

  const renderRecordData = () => {
    if (!healthRecord) return null;

    const { recordData } = healthRecord;
    
    switch (healthRecord.recordType) {
      case HealthRecordType.VITAL_SIGNS:
        const vitals = recordData.vitals;
        if (!vitals) return null;
        
        return (
          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>生命体征数据</Text>
            {vitals.bloodPressure && (
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>血压</Text>
                <Text style={styles.dataValue}>
                  {vitals.bloodPressure.systolic}/{vitals.bloodPressure.diastolic} mmHg
                </Text>
              </View>
            )}
            {vitals.heartRate && (
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>心率</Text>
                <Text style={styles.dataValue}>{vitals.heartRate} bpm</Text>
              </View>
            )}
            {vitals.temperature && (
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>体温</Text>
                <Text style={styles.dataValue}>{vitals.temperature} °C</Text>
              </View>
            )}
            {vitals.weight && (
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>体重</Text>
                <Text style={styles.dataValue}>{vitals.weight} kg</Text>
              </View>
            )}
          </View>
        );

      case HealthRecordType.MEDICATION:
        const medication = recordData.medication;
        if (!medication) return null;
        
        return (
          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>用药信息</Text>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>药物名称</Text>
              <Text style={styles.dataValue}>{medication.name}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>剂量</Text>
              <Text style={styles.dataValue}>{medication.dosage}</Text>
            </View>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>用药频率</Text>
              <Text style={styles.dataValue}>{medication.frequency}</Text>
            </View>
            {medication.duration && (
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>用药周期</Text>
                <Text style={styles.dataValue}>{medication.duration}</Text>
              </View>
            )}
            {medication.instructions && (
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>用药说明</Text>
                <Text style={styles.dataValue}>{medication.instructions}</Text>
              </View>
            )}
          </View>
        );

      case HealthRecordType.DIAGNOSIS:
        const diagnosis = recordData.diagnosis;
        if (!diagnosis) return null;
        
        return (
          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>诊断信息</Text>
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>诊断结果</Text>
              <Text style={styles.dataValue}>{diagnosis.condition}</Text>
            </View>
            {diagnosis.severity && (
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>严重程度</Text>
                <Text style={styles.dataValue}>{diagnosis.severity}</Text>
              </View>
            )}
            <View style={styles.dataItem}>
              <Text style={styles.dataLabel}>诊断日期</Text>
              <Text style={styles.dataValue}>
                {new Date(diagnosis.diagnosedDate).toLocaleDateString('zh-CN')}
              </Text>
            </View>
            {diagnosis.doctor && (
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>医生</Text>
                <Text style={styles.dataValue}>{diagnosis.doctor}</Text>
              </View>
            )}
            {diagnosis.hospital && (
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>医院</Text>
                <Text style={styles.dataValue}>{diagnosis.hospital}</Text>
              </View>
            )}
            {diagnosis.notes && (
              <View style={styles.dataItem}>
                <Text style={styles.dataLabel}>备注</Text>
                <Text style={styles.dataValue}>{diagnosis.notes}</Text>
              </View>
            )}
          </View>
        );

      default:
        return (
          <View style={styles.dataSection}>
            <Text style={styles.dataSectionTitle}>记录数据</Text>
            <Text style={styles.dataValue}>
              {JSON.stringify(recordData, null, 2)}
            </Text>
          </View>
        );
    }
  };

  const renderAIAdvice = () => {
    if (!healthRecord?.recordData.aiAdvice) return null;

    return (
      <View style={styles.aiAdviceSection}>
        <View style={styles.aiAdviceHeader}>
          <View style={styles.aiAdviceHeaderLeft}>
            <Icon name="bulb-outline" size={20} color={COLORS.PRIMARY} />
            <Text style={styles.aiAdviceTitle}>AI健康建议</Text>
          </View>
          <View style={styles.aiAdviceActions}>
            <TouchableOpacity
              style={styles.aiActionButton}
              onPress={handleEditAdvice}
            >
              <Icon name="create-outline" size={18} color={COLORS.PRIMARY} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.aiActionButton}
              onPress={handleDeleteAdvice}
            >
              <Icon name="trash-outline" size={18} color={COLORS.ERROR} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.aiAdviceContent}>
          {healthRecord.recordData.aiAdvice}
        </Text>
        <View style={styles.aiAdviceFooter}>
          {healthRecord.recordData.aiAdviceGeneratedAt && (
            <Text style={styles.aiAdviceTime}>
              生成时间：{new Date(healthRecord.recordData.aiAdviceGeneratedAt).toLocaleString('zh-CN')}
            </Text>
          )}
          {healthRecord.recordData.aiAdviceUpdatedAt && (
            <Text style={styles.aiAdviceTime}>
              更新时间：{new Date(healthRecord.recordData.aiAdviceUpdatedAt).toLocaleString('zh-CN')}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowEditModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setShowEditModal(false)}
            style={styles.closeButton}
          >
            <Icon name="close" size={24} color={COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>编辑健康档案</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.modalContent}>
          <Input
            label="档案标题"
            placeholder="输入健康档案标题"
            value={editForm.title}
            onChangeText={(text) => setEditForm({ ...editForm, title: text })}
            required
          />

          <Input
            label="档案描述"
            placeholder="输入健康档案描述（可选）"
            value={editForm.description}
            onChangeText={(text) => setEditForm({ ...editForm, description: text })}
            multiline
            numberOfLines={3}
            style={{ height: 80 }}
          />

          <Text style={styles.infoText}>
            注意：记录类型和具体数据需要在专门的编辑页面中修改。
          </Text>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Button
            title="取消"
            variant="outline"
            onPress={() => setShowEditModal(false)}
            style={styles.footerButton}
          />
          <Button
            title="保存"
            variant="primary"
            onPress={handleUpdate}
            loading={isUpdating}
            style={styles.footerButton}
          />
        </View>
      </View>
    </Modal>
  );

  const renderEditAdviceModal = () => (
    <Modal
      visible={showEditAdviceModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowEditAdviceModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setShowEditAdviceModal(false)}
            style={styles.closeButton}
          >
            <Icon name="close" size={24} color={COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>编辑AI建议</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.modalContent}>
          <Input
            label="AI健康建议"
            placeholder="输入或编辑AI健康建议内容"
            value={editAdviceText}
            onChangeText={setEditAdviceText}
            multiline
            numberOfLines={8}
            style={{ height: 200 }}
            required
          />

          <Text style={styles.infoText}>
            您可以编辑AI生成的建议内容，使其更符合您的具体情况。
          </Text>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Button
            title="取消"
            variant="outline"
            onPress={() => setShowEditAdviceModal(false)}
            style={styles.footerButton}
          />
          <Button
            title="保存"
            variant="primary"
            onPress={handleUpdateAdvice}
            loading={isUpdatingAdvice}
            style={styles.footerButton}
          />
        </View>
      </View>
    </Modal>
  );

  const renderDeleteConfirmModal = () => (
    <Modal
      visible={showDeleteConfirm}
      animationType="fade"
      transparent
      onRequestClose={() => setShowDeleteConfirm(false)}
    >
      <View style={styles.deleteModalOverlay}>
        <View style={styles.deleteModalContainer}>
          <Icon name="warning-outline" size={48} color={COLORS.ERROR} />
          <Text style={styles.deleteModalTitle}>确认删除</Text>
          <Text style={styles.deleteModalMessage}>
            确定要删除这个健康档案吗？此操作无法撤销。
          </Text>
          <View style={styles.deleteModalButtons}>
            <Button
              title="取消"
              variant="outline"
              onPress={() => setShowDeleteConfirm(false)}
              style={styles.deleteModalButton}
            />
            <Button
              title="删除"
              variant="danger"
              onPress={confirmDelete}
              loading={isDeleting}
              style={styles.deleteModalButton}
            />
          </View>
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

  if (!healthRecord) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="document-outline" size={80} color={COLORS.TEXT_SECONDARY} />
        <Text style={styles.errorTitle}>健康档案不存在</Text>
        <Button
          title="返回"
          variant="primary"
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.recordIconContainer}>
            <Icon 
              name={getRecordTypeIcon(healthRecord.recordType)} 
              size={32} 
              color={COLORS.PRIMARY} 
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.recordTitle}>{healthRecord.title}</Text>
            <Text style={styles.recordType}>
              {getRecordTypeLabel(healthRecord.recordType)}
            </Text>
            <View style={styles.recordMeta}>
              <Text style={styles.recordDate}>
                创建于 {new Date(healthRecord.createdAt).toLocaleDateString('zh-CN')}
              </Text>
              <View style={styles.verificationStatus}>
                {healthRecord.verified ? (
                  <>
                    <Icon name="checkmark-circle" size={16} color={COLORS.SUCCESS} />
                    <Text style={[styles.statusText, { color: COLORS.SUCCESS }]}>已验证</Text>
                  </>
                ) : (
                  <>
                    <Icon name="time-outline" size={16} color={COLORS.WARNING} />
                    <Text style={[styles.statusText, { color: COLORS.WARNING }]}>待验证</Text>
                  </>
                )}
              </View>
            </View>
          </View>
        </View>

        {healthRecord.description && (
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>描述</Text>
            <Text style={styles.descriptionText}>{healthRecord.description}</Text>
          </View>
        )}

        {renderRecordData()}

        {renderAIAdvice()}

        {!healthRecord.recordData.aiAdvice && (
          <View style={styles.aiGenerateSection}>
            <Button
              title="生成AI健康建议"
              variant="outline"
              onPress={generateHealthAdvice}
              loading={isGeneratingAdvice}
              style={styles.generateButton}
            />
          </View>
        )}

        {healthRecord.recordData.aiAdvice && (
          <View style={styles.aiRegenerateSection}>
            <Button
              title="重新生成AI建议"
              variant="outline"
              onPress={generateHealthAdvice}
              loading={isGeneratingAdvice}
              style={styles.regenerateButton}
            />
          </View>
        )}

        <View style={styles.actionsSection}>
          <Button
            title="编辑"
            variant="outline"
            onPress={handleEdit}
            style={styles.actionButton}
          />
          <Button
            title="删除"
            variant="danger"
            onPress={handleDelete}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>

      {renderEditModal()}
      {renderEditAdviceModal()}
      {renderDeleteConfirmModal()}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND,
    padding: SPACING.LG,
  },
  errorTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.LG,
    marginBottom: SPACING.SM,
  },
  errorMessage: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: SPACING.LG,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    padding: SPACING.LG,
    backgroundColor: COLORS.SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  recordIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: `${COLORS.PRIMARY}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.MD,
  },
  headerInfo: {
    flex: 1,
  },
  recordTitle: {
    fontSize: FONTS.SIZES.XLARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.XS,
  },
  recordType: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.SM,
  },
  recordMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordDate: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
  },
  verificationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    marginLeft: SPACING.XS,
  },
  descriptionSection: {
    padding: SPACING.LG,
    backgroundColor: COLORS.SURFACE,
    marginTop: SPACING.SM,
  },
  sectionTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SM,
  },
  descriptionText: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 22,
  },
  dataSection: {
    padding: SPACING.LG,
    backgroundColor: COLORS.SURFACE,
    marginTop: SPACING.SM,
  },
  dataSectionTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.MD,
  },
  dataItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.SM,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  dataLabel: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    flex: 1,
  },
  dataValue: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_PRIMARY,
    flex: 2,
    textAlign: 'right',
  },
  aiAdviceSection: {
    padding: SPACING.LG,
    backgroundColor: `${COLORS.PRIMARY}10`,
    marginTop: SPACING.SM,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.PRIMARY,
  },
  aiAdviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  aiAdviceHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiAdviceTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.PRIMARY,
    marginLeft: SPACING.SM,
  },
  aiAdviceActions: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  aiActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  aiAdviceContent: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 22,
    marginBottom: SPACING.SM,
  },
  aiAdviceFooter: {
    marginTop: SPACING.SM,
  },
  aiAdviceTime: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    fontStyle: 'italic',
    marginBottom: SPACING.XS,
  },
  aiGenerateSection: {
    padding: SPACING.LG,
  },
  generateButton: {
    marginTop: SPACING.SM,
  },
  aiRegenerateSection: {
    padding: SPACING.LG,
  },
  regenerateButton: {
    marginTop: SPACING.SM,
  },
  actionsSection: {
    flexDirection: 'row',
    padding: SPACING.LG,
    gap: SPACING.MD,
  },
  actionButton: {
    flex: 1,
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
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.LG,
  },
  deleteModalContainer: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    padding: SPACING.LG,
    alignItems: 'center',
    minWidth: 300,
  },
  deleteModalTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.MD,
    marginBottom: SPACING.SM,
  },
  deleteModalMessage: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.LG,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: SPACING.MD,
  },
  deleteModalButton: {
    flex: 1,
    minWidth: 100,
  },
});

export default ViewHealthRecordScreen;