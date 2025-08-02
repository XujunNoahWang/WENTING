import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, FONTS, SPACING, SUCCESS_MESSAGES } from '@constants/index';
import { 
  HealthRecordForm, 
  HealthRecordType, 
  User,
  UserRole,
  RootStackParamList,
} from '../../types/index';
import Button from '@components/common/Button';
import Input from '@components/common/Input';
import HealthRecordService from '@services/health/HealthRecordService';
import HouseholdService from '@services/household/HouseholdService';
import AuthService from '@services/auth/AuthService';
import GeminiService from '@services/gemini/GeminiService';

type AddHealthRecordRouteProp = RouteProp<RootStackParamList, 'AddHealthRecord'>;
type AddHealthRecordNavigationProp = StackNavigationProp<RootStackParamList, 'AddHealthRecord'>;

const AddHealthRecordScreen: React.FC = () => {
  const route = useRoute<AddHealthRecordRouteProp>();
  const navigation = useNavigation<AddHealthRecordNavigationProp>();
  const { userId } = route.params || {};

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  
  const [form, setForm] = useState<HealthRecordForm>({
    title: '',
    description: '',
    recordType: HealthRecordType.VITAL_SIGNS,
    recordData: {},
  });

  // 具体数据字段
  const [vitalSigns, setVitalSigns] = useState({
    systolic: '',
    diastolic: '',
    heartRate: '',
    temperature: '',
    weight: '',
  });

  const [medication, setMedication] = useState({
    name: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: '',
  });

  const [diagnosis, setDiagnosis] = useState({
    condition: '',
    severity: '',
    doctor: '',
    hospital: '',
    notes: '',
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
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

      // Get user's households
      const householdsResult = await HouseholdService.getUserHouseholds(user.id);
      if (householdsResult.success && householdsResult.data && householdsResult.data.length > 0) {
        setSelectedHouseholdId(householdsResult.data[0].id);
      }
    } catch (error) {
      console.error('Load initial data error:', error);
      Alert.alert('错误', '加载数据失败');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) {
      Alert.alert('错误', '请输入健康档案标题');
      return;
    }

    if (!currentUser || !selectedHouseholdId) {
      Alert.alert('错误', '用户或家庭信息获取失败');
      return;
    }

    try {
      setIsCreating(true);
      
      // 构建记录数据
      let recordData = {};
      
      switch (form.recordType) {
        case HealthRecordType.VITAL_SIGNS:
          recordData = {
            vitals: {
              bloodPressure: {
                systolic: parseInt(vitalSigns.systolic) || 0,
                diastolic: parseInt(vitalSigns.diastolic) || 0,
              },
              heartRate: parseInt(vitalSigns.heartRate) || 0,
              temperature: parseFloat(vitalSigns.temperature) || 0,
              weight: parseFloat(vitalSigns.weight) || 0,
            }
          };
          break;
        case HealthRecordType.MEDICATION:
          recordData = {
            medication: {
              name: medication.name,
              dosage: medication.dosage,
              frequency: medication.frequency,
              duration: medication.duration,
              instructions: medication.instructions,
            }
          };
          break;
        case HealthRecordType.DIAGNOSIS:
          recordData = {
            diagnosis: {
              condition: diagnosis.condition,
              severity: diagnosis.severity,
              diagnosedDate: new Date().toISOString(),
              doctor: diagnosis.doctor,
              hospital: diagnosis.hospital,
              notes: diagnosis.notes,
            }
          };
          break;
        default:
          recordData = {};
      }

      const recordForm: HealthRecordForm = {
        ...form,
        recordData,
      };
      
      const result = await HealthRecordService.getInstance().createHealthRecord(
        recordForm,
        selectedHouseholdId,
        userId || currentUser.id,
        currentUser.id,
        UserRole.MEMBER
      );
      
      if (result.success && result.data) {
        // 创建成功后，生成AI健康建议
        try {
          const prompt = `
            请根据以下健康记录信息，生成个性化的健康建议：

            记录类型：${getRecordTypeLabel(form.recordType)}
            记录标题：${form.title}
            记录描述：${form.description || '无'}
            记录数据：${JSON.stringify(recordData, null, 2)}

            要求：
            1. 针对具体的健康记录类型和数据给出专业建议
            2. 建议要实用、可行
            3. 语言温馨友好，不超过200字
            4. 如果是用药记录，重点提醒用药注意事项和安全性
            5. 如果是体征记录，分析数值是否正常并给出建议
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

            Alert.alert('成功', `${SUCCESS_MESSAGES.RECORD_SAVED}\n\nAI健康建议已自动生成。`, [
              {
                text: '查看详情',
                onPress: () => {
                  navigation.replace('ViewHealthRecord', { recordId: result.data!.id });
                },
              },
              {
                text: '返回列表',
                onPress: () => {
                  navigation.goBack();
                },
              },
            ]);
          } else {
            Alert.alert('成功', `${SUCCESS_MESSAGES.RECORD_SAVED}\n\n注意：AI建议生成失败，您可以稍后在详情页面重新生成。`, [
              {
                text: '查看详情',
                onPress: () => {
                  navigation.replace('ViewHealthRecord', { recordId: result.data!.id });
                },
              },
              {
                text: '返回列表',
                onPress: () => {
                  navigation.goBack();
                },
              },
            ]);
          }
        } catch (aiError) {
          console.error('Generate AI advice error:', aiError);
          Alert.alert('成功', `${SUCCESS_MESSAGES.RECORD_SAVED}\n\n注意：AI建议生成失败，您可以稍后在详情页面重新生成。`, [
            {
              text: '查看详情',
              onPress: () => {
                navigation.replace('ViewHealthRecord', { recordId: result.data!.id });
              },
            },
            {
              text: '返回列表',
              onPress: () => {
                navigation.goBack();
              },
            },
          ]);
        }
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

  const renderTypeSpecificFields = () => {
    switch (form.recordType) {
      case HealthRecordType.VITAL_SIGNS:
        return (
          <View style={styles.typeFieldsSection}>
            <Text style={styles.sectionTitle}>生命体征数据</Text>
            
            <View style={styles.row}>
              <Input
                label="收缩压 (mmHg)"
                placeholder="120"
                value={vitalSigns.systolic}
                onChangeText={(text) => setVitalSigns({ ...vitalSigns, systolic: text })}
                keyboardType="numeric"
                style={styles.halfInput}
              />
              <Input
                label="舒张压 (mmHg)"
                placeholder="80"
                value={vitalSigns.diastolic}
                onChangeText={(text) => setVitalSigns({ ...vitalSigns, diastolic: text })}
                keyboardType="numeric"
                style={styles.halfInput}
              />
            </View>

            <Input
              label="心率 (bpm)"
              placeholder="72"
              value={vitalSigns.heartRate}
              onChangeText={(text) => setVitalSigns({ ...vitalSigns, heartRate: text })}
              keyboardType="numeric"
            />

            <Input
              label="体温 (°C)"
              placeholder="36.5"
              value={vitalSigns.temperature}
              onChangeText={(text) => setVitalSigns({ ...vitalSigns, temperature: text })}
              keyboardType="numeric"
            />

            <Input
              label="体重 (kg)"
              placeholder="70"
              value={vitalSigns.weight}
              onChangeText={(text) => setVitalSigns({ ...vitalSigns, weight: text })}
              keyboardType="numeric"
            />
          </View>
        );

      case HealthRecordType.MEDICATION:
        return (
          <View style={styles.typeFieldsSection}>
            <Text style={styles.sectionTitle}>用药信息</Text>
            
            <Input
              label="药物名称"
              placeholder="输入药物名称"
              value={medication.name}
              onChangeText={(text) => setMedication({ ...medication, name: text })}
              required
            />

            <Input
              label="剂量"
              placeholder="例如：10mg"
              value={medication.dosage}
              onChangeText={(text) => setMedication({ ...medication, dosage: text })}
              required
            />

            <Input
              label="用药频率"
              placeholder="例如：每日3次"
              value={medication.frequency}
              onChangeText={(text) => setMedication({ ...medication, frequency: text })}
              required
            />

            <Input
              label="用药周期"
              placeholder="例如：7天"
              value={medication.duration}
              onChangeText={(text) => setMedication({ ...medication, duration: text })}
            />

            <Input
              label="用药说明"
              placeholder="饭前/饭后服用等特殊说明"
              value={medication.instructions}
              onChangeText={(text) => setMedication({ ...medication, instructions: text })}
              multiline
              numberOfLines={3}
            />
          </View>
        );

      case HealthRecordType.DIAGNOSIS:
        return (
          <View style={styles.typeFieldsSection}>
            <Text style={styles.sectionTitle}>诊断信息</Text>
            
            <Input
              label="诊断结果"
              placeholder="输入诊断结果"
              value={diagnosis.condition}
              onChangeText={(text) => setDiagnosis({ ...diagnosis, condition: text })}
              required
            />

            <Input
              label="严重程度"
              placeholder="轻度/中度/重度"
              value={diagnosis.severity}
              onChangeText={(text) => setDiagnosis({ ...diagnosis, severity: text })}
            />

            <Input
              label="医生姓名"
              placeholder="输入医生姓名"
              value={diagnosis.doctor}
              onChangeText={(text) => setDiagnosis({ ...diagnosis, doctor: text })}
            />

            <Input
              label="医院名称"
              placeholder="输入医院名称"
              value={diagnosis.hospital}
              onChangeText={(text) => setDiagnosis({ ...diagnosis, hospital: text })}
            />

            <Input
              label="备注"
              placeholder="其他相关信息"
              value={diagnosis.notes}
              onChangeText={(text) => setDiagnosis({ ...diagnosis, notes: text })}
              multiline
              numberOfLines={3}
            />
          </View>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本信息</Text>
          
          <Input
            label="档案标题"
            placeholder="输入健康档案标题"
            value={form.title}
            onChangeText={(text) => setForm({ ...form, title: text })}
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
                      form.recordType === type && styles.typeButtonSelected
                    ]}
                    onPress={() => setForm({ ...form, recordType: type })}
                  >
                    <Icon 
                      name={getRecordTypeIcon(type)}
                      size={20}
                      color={form.recordType === type ? COLORS.SURFACE : COLORS.TEXT_SECONDARY}
                    />
                    <Text style={[
                      styles.typeButtonText,
                      form.recordType === type && styles.typeButtonTextSelected
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
            value={form.description}
            onChangeText={(text) => setForm({ ...form, description: text })}
            multiline
            numberOfLines={3}
            style={{ height: 80 }}
          />
        </View>

        {renderTypeSpecificFields()}

        <View style={styles.infoSection}>
          <Icon name="information-circle-outline" size={20} color={COLORS.PRIMARY} />
          <Text style={styles.infoText}>
            创建档案后，AI将自动分析您的健康数据并生成个性化的健康建议。
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="取消"
          variant="outline"
          onPress={() => navigation.goBack()}
          style={styles.footerButton}
        />
        <Button
          title="创建档案"
          variant="primary"
          onPress={handleCreate}
          loading={isCreating}
          style={styles.footerButton}
        />
      </View>
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
  content: {
    flex: 1,
  },
  section: {
    padding: SPACING.LG,
    backgroundColor: COLORS.SURFACE,
    marginBottom: SPACING.SM,
  },
  sectionTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.MD,
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
    backgroundColor: COLORS.BACKGROUND,
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
  typeFieldsSection: {
    padding: SPACING.LG,
    backgroundColor: COLORS.SURFACE,
    marginBottom: SPACING.SM,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.MD,
  },
  halfInput: {
    flex: 1,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: SPACING.LG,
    backgroundColor: `${COLORS.PRIMARY}10`,
    marginBottom: SPACING.SM,
  },
  infoText: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 18,
    marginLeft: SPACING.SM,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.LG,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
  },
  footerButton: {
    flex: 1,
    marginHorizontal: SPACING.XS,
  },
});

export default AddHealthRecordScreen;