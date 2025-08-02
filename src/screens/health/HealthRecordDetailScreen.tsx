import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  StyleSheet 
} from 'react-native';
import GeminiService from '../../services/gemini/GeminiService';
import FirebaseDatabaseService from '../../services/database/FirebaseDatabaseService';
import { COLORS } from '../../constants/colors';
import { FirebaseUser, LocalHealthRecord, HealthRecordType } from '../../types/appTypes';

interface HealthRecordDetailScreenProps {
  user: FirebaseUser;
  onNavigate: (screen: string) => void;
  selectedRecord?: LocalHealthRecord;
}

const HealthRecordDetailScreen: React.FC<HealthRecordDetailScreenProps> = ({ 
  user, 
  onNavigate, 
  selectedRecord 
}) => {
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(selectedRecord?.recordData?.aiAdvice || null);

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

  const generateAIAdvice = async () => {
    if (!selectedRecord) return;

    setGeneratingAI(true);
    try {
      // 构造健康建议的提示文本
      const prompt = `
        请基于以下健康记录信息，生成专业的健康建议：

        健康记录标题：${selectedRecord.title}
        详细描述：${selectedRecord.description || '无'}
        记录类型：${getRecordTypeLabel(selectedRecord.recordType)}
        记录数据：${JSON.stringify(selectedRecord.recordData, null, 2)}

        要求：
        1. 提供专业、实用的健康建议
        2. 针对具体的健康问题给出建议
        3. 包含预防、治疗、生活方式建议
        4. 语言通俗易懂，不超过300字
        5. 强调必要时应咨询专业医生
        6. 避免给出具体的医疗诊断或处方

        请直接返回健康建议内容：
      `;

      const result = await GeminiService.generateHealthAdvice(prompt);

      if (result.success && result.data) {
        setAiAdvice(result.data);
        
        // 保存AI建议到数据库
        try {
          const updatedRecordData = {
            ...selectedRecord.recordData,
            aiAdvice: result.data
          };
          
          await FirebaseDatabaseService.updateDocument('health_records', selectedRecord.id, {
            recordData: updatedRecordData,
            updatedAt: new Date().toISOString()
          });
          
          console.log('AI建议已保存到数据库');
          Alert.alert('成功', 'AI建议生成并保存完成！');
        } catch (saveError) {
          console.error('保存AI建议失败:', saveError);
          Alert.alert('部分成功', 'AI建议生成成功，但保存失败。建议将截图保存。');
        }
      } else {
        Alert.alert('错误', result.error || '生成AI建议失败，请稍后重试');
      }
    } catch (error) {
      console.error('生成AI建议失败:', error);
      Alert.alert('错误', '生成AI建议失败，请稍后重试');
    } finally {
      setGeneratingAI(false);
    }
  };

  if (!selectedRecord) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => onNavigate('health')}
        >
          <Text style={styles.backButtonText}>← 返回</Text>
        </TouchableOpacity>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>未找到健康记录</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => onNavigate('health')}
      >
        <Text style={styles.backButtonText}>← 返回</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>{selectedRecord.title}</Text>
        <Text style={styles.memberName}>成员: {selectedRecord.memberName}</Text>
        <Text style={styles.date}>
          记录时间: {new Date(selectedRecord.createdAt).toLocaleString('zh-CN')}
        </Text>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>记录详情</Text>
          {selectedRecord.description && (
            <Text style={styles.description}>{selectedRecord.description}</Text>
          )}
          
          {/* 显示记录数据 */}
          {Object.keys(selectedRecord.recordData).length > 0 && (
            <View style={styles.dataSection}>
              <Text style={styles.dataTitle}>详细数据:</Text>
              {Object.entries(selectedRecord.recordData).map(([key, value]) => {
                if (key === 'aiAdvice') return null;
                return (
                  <View key={key} style={styles.dataItem}>
                    <Text style={styles.dataKey}>{key}:</Text>
                    <Text style={styles.dataValue}>{String(value)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* AI建议部分 */}
        <View style={styles.section}>
          <View style={styles.aiSectionHeader}>
            <Text style={styles.sectionTitle}>AI健康建议</Text>
            <TouchableOpacity
              style={[styles.generateButton, generatingAI && styles.disabledButton]}
              onPress={generateAIAdvice}
              disabled={generatingAI}
            >
              <Text style={styles.generateButtonText}>
                {generatingAI ? '生成中...' : '生成建议'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {aiAdvice ? (
            <View style={styles.aiAdviceContainer}>
              <Text style={styles.aiAdviceText}>{aiAdvice}</Text>
            </View>
          ) : (
            <View style={styles.noAdviceContainer}>
              <Text style={styles.noAdviceText}>
                点击"生成建议"按钮，让AI为您分析这条健康记录并提供个性化建议。
              </Text>
            </View>
          )}
        </View>
      </View>
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
  header: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  memberName: {
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  content: {
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: 12,
  },
  dataSection: {
    marginTop: 12,
  },
  dataTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 8,
  },
  dataItem: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dataKey: {
    fontSize: 12,
    color: COLORS.textSecondary,
    width: 80,
    fontWeight: '500',
  },
  dataValue: {
    fontSize: 12,
    color: COLORS.text,
    flex: 1,
  },
  aiSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  generateButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  generateButtonText: {
    color: COLORS.background,
    fontSize: 12,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.6,
  },
  aiAdviceContainer: {
    backgroundColor: COLORS.light,
    borderRadius: 6,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  aiAdviceText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  noAdviceContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noAdviceText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});

export default HealthRecordDetailScreen;