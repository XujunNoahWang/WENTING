import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';

// Mock Data Storage with Test Data
let mockUsers = [
  {
    id: 'user-dad-001',
    email: 'dad@test.com',
    fullName: '张爸爸',
    role: 'admin',
    householdId: 'household-001',
    avatarUrl: null,
    biometricEnabled: false,
    createdAt: '2025-06-01T10:00:00.000Z',
    updatedAt: '2025-06-01T10:00:00.000Z',
  },
  {
    id: 'user-mom-002',
    email: 'mom@test.com',
    fullName: '李妈妈',
    role: 'admin',
    householdId: 'household-001',
    avatarUrl: null,
    biometricEnabled: false,
    createdAt: '2025-06-01T10:01:00.000Z',
    updatedAt: '2025-06-01T10:01:00.000Z',
  },
  {
    id: 'user-child-003',
    email: 'child@test.com',
    fullName: '张小明',
    role: 'member',
    householdId: 'household-001',
    avatarUrl: null,
    biometricEnabled: false,
    createdAt: '2025-06-01T10:02:00.000Z',
    updatedAt: '2025-06-01T10:02:00.000Z',
  },
  {
    id: 'user-grandpa-004',
    email: 'grandpa@test.com',
    fullName: '张爷爷',
    role: 'member',
    householdId: 'household-001',
    avatarUrl: null,
    biometricEnabled: false,
    createdAt: '2025-06-01T10:03:00.000Z',
    updatedAt: '2025-06-01T10:03:00.000Z',
  },
  {
    id: 'user-grandma-005',
    email: 'grandma@test.com',
    fullName: '李奶奶',
    role: 'member',
    householdId: 'household-001',
    avatarUrl: null,
    biometricEnabled: false,
    createdAt: '2025-06-01T10:04:00.000Z',
    updatedAt: '2025-06-01T10:04:00.000Z',
  }
];

let mockHouseholds = [
  {
    id: 'household-001',
    name: '张家大院',
    description: '我们的温馨家庭',
    createdBy: 'user-dad-001',
    members: [
      { userId: 'user-dad-001', role: 'admin', joinedAt: '2025-06-01T10:00:00.000Z' },
      { userId: 'user-mom-002', role: 'admin', joinedAt: '2025-06-01T10:01:00.000Z' },
      { userId: 'user-child-003', role: 'member', joinedAt: '2025-06-01T10:02:00.000Z' },
      { userId: 'user-grandpa-004', role: 'member', joinedAt: '2025-06-01T10:03:00.000Z' },
      { userId: 'user-grandma-005', role: 'member', joinedAt: '2025-06-01T10:04:00.000Z' }
    ],
    createdAt: '2025-06-01T10:00:00.000Z',
    updatedAt: '2025-06-01T10:04:00.000Z',
  }
];

let mockHealthRecords = [
  // 张爸爸的健康档案
  {
    id: 'record-dad-001',
    userId: 'user-dad-001',
    householdId: 'household-001',
    title: '年度体检报告',
    description: '2024年公司组织的年度体检，各项指标正常',
    recordType: 'vital_signs',
    recordData: {
      vitals: {
        bloodPressure: { systolic: 125, diastolic: 82 },
        heartRate: 72,
        temperature: 36.8,
        weight: 75,
        height: 175
      }
    },
    aiAdvice: '💡 体检结果建议：\n• 定期进行体检以监测健康状态\n• 根据体检结果调整生活方式\n• 保持健康的饮食和运动习惯\n• 及时关注异常指标并咨询医生\n• 建立个人健康档案便于追踪\n\n🌟 记住：规律的生活作息是健康的基石',
    createdBy: 'user-dad-001',
    createdAt: '2025-06-03T09:00:00.000Z',
    updatedAt: '2025-06-03T09:00:00.000Z',
  },
  {
    id: 'record-dad-002',
    userId: 'user-dad-001',
    householdId: 'household-001',
    title: '感冒就诊记录',
    description: '季节性感冒，开了一些感冒药',
    recordType: 'diagnosis',
    recordData: {
      diagnosis: '普通感冒',
      symptoms: ['鼻塞', '轻微发热', '咳嗽'],
      treatment: '多休息，多喝水，按时服药'
    },
    aiAdvice: '💡 感冒康复建议：\n• 多休息，保证充足的睡眠\n• 多喝温水，保持身体水分\n• 可以用温盐水漱口缓解喉咙不适\n• 保持室内空气流通\n• 如症状加重或持续发热请及时就医\n\n🌟 提醒：保持积极乐观的心态对健康很重要',
    createdBy: 'user-mom-002',
    createdAt: '2025-06-05T14:30:00.000Z',
    updatedAt: '2025-06-05T14:30:00.000Z',
  },
  {
    id: 'record-dad-003',
    userId: 'user-dad-001',
    householdId: 'household-001',
    title: '维生素补充',
    description: '医生建议补充维生素D和B族维生素',
    recordType: 'medication',
    recordData: {
      medications: [
        { name: '维生素D3', dosage: '800IU', frequency: '每日一次' },
        { name: '复合维生素B', dosage: '1片', frequency: '每日一次' }
      ]
    },
    aiAdvice: '💡 维生素补充建议：\n• 最好在医生指导下补充维生素\n• 注意不要过量服用，过量也有害\n• 搭配均衡饮食，从天然食物获取营养\n• 选择信誉良好的品牌产品\n• 定期评估补充效果\n\n🌟 建议：与家人分享健康信息，互相监督和支持',
    createdBy: 'user-dad-001',
    createdAt: '2025-06-07T11:20:00.000Z',
    updatedAt: '2025-06-07T11:20:00.000Z',
  },
  
  // 李妈妈的健康档案
  {
    id: 'record-mom-001',
    userId: 'user-mom-002',
    householdId: 'household-001',
    title: '妇科检查',
    description: '常规妇科检查，一切正常',
    recordType: 'vital_signs',
    recordData: {
      vitals: {
        bloodPressure: { systolic: 118, diastolic: 75 },
        heartRate: 68,
        temperature: 36.5,
        weight: 58,
        height: 162
      }
    },
    aiAdvice: '💡 妇科健康建议：\n• 定期进行妇科检查，建议每年一次\n• 保持外阴清洁干燥，选择透气的内衣\n• 注意月经周期变化，异常时及时就医\n• 保持健康的生活方式，均衡饮食\n• 避免过度劳累，保证充足睡眠\n• 如有不适症状及时咨询专业医生\n\n🌟 温馨提示：女性健康需要细心呵护，定期检查是最好的保护',
    createdBy: 'user-mom-002',
    createdAt: '2025-06-10T10:15:00.000Z',
    updatedAt: '2025-06-10T10:15:00.000Z',
  },
  {
    id: 'record-mom-002',
    userId: 'user-mom-002',
    householdId: 'household-001',
    title: '贫血治疗',
    description: '轻度缺铁性贫血，需要补铁',
    recordType: 'diagnosis',
    recordData: {
      diagnosis: '轻度缺铁性贫血',
      symptoms: ['易疲劳', '面色苍白'],
      treatment: '补充铁剂，多吃含铁食物'
    },
    aiAdvice: '💡 贫血康复建议：\n• 多食用富含铁质的食物如菠菜、猪肝、红肉\n• 搭配维生素C丰富的食物促进铁吸收\n• 避免与茶、咖啡同时服用铁剂\n• 保证充足睡眠，避免过度劳累\n• 定期复查血常规监测恢复情况\n• 按医嘱规律服用铁剂，不可随意停药\n\n🌟 提醒：贫血恢复需要时间，坚持治疗很重要',
    createdBy: 'user-mom-002',
    createdAt: '2025-06-12T16:45:00.000Z',
    updatedAt: '2025-06-12T16:45:00.000Z',
  },
  {
    id: 'record-mom-003',
    userId: 'user-mom-002',
    householdId: 'household-001',
    title: '钙片补充',
    description: '预防骨质疏松，医生建议补钙',
    recordType: 'medication',
    recordData: {
      medications: [
        { name: '钙尔奇', dosage: '600mg', frequency: '每日两次' }
      ]
    },
    aiAdvice: '💡 补钙健康建议：\n• 钙片最好分次服用，提高吸收率\n• 饭后服用减少胃部不适\n• 同时补充维生素D促进钙吸收\n• 多食用含钙丰富的食物如牛奶、豆制品\n• 适当进行户外运动和日光浴\n• 避免与含草酸食物同时摄入\n\n🌟 温馨提示：骨骼健康需要长期维护，坚持补钙很重要',
    createdBy: 'user-dad-001',
    createdAt: '2025-06-15T08:30:00.000Z',
    updatedAt: '2025-06-15T08:30:00.000Z',
  },

  // 张小明的健康档案
  {
    id: 'record-child-001',
    userId: 'user-child-003',
    householdId: 'household-001',
    title: '儿童体检',
    description: '学校组织的儿童健康体检',
    recordType: 'vital_signs',
    recordData: {
      vitals: {
        bloodPressure: { systolic: 95, diastolic: 60 },
        heartRate: 85,
        temperature: 36.6,
        weight: 35,
        height: 130
      }
    },
    aiAdvice: '💡 儿童健康建议：\n• 保持均衡饮食，多吃蔬菜水果和蛋白质\n• 每天保证充足的睡眠时间\n• 积极参加体育运动和户外活动\n• 定期进行视力和听力检查\n• 注意口腔卫生，养成良好的刷牙习惯\n• 按时接种疫苗，预防疫苗可防疾病\n\n🌟 成长提醒：儿童期是身体发育的关键时期，营养和运动都很重要',
    createdBy: 'user-mom-002',
    createdAt: '2025-06-18T09:30:00.000Z',
    updatedAt: '2025-06-18T09:30:00.000Z',
  },
  {
    id: 'record-child-002',
    userId: 'user-child-003',
    householdId: 'household-001',
    title: '疫苗接种',
    description: 'HPV疫苗第一针接种',
    recordType: 'medication',
    recordData: {
      medications: [
        { name: 'HPV疫苗', dosage: '0.5ml', frequency: '单次接种' }
      ]
    },
    aiAdvice: '💡 疫苗接种建议：\n• 接种后观察30分钟，确认无不良反应\n• 接种部位保持清洁干燥，避免用力揉搓\n• 按时完成后续接种计划，确保免疫效果\n• 接种后如有发热等反应属正常现象\n• 记录接种信息，建立完整的免疫档案\n• 有不适症状及时联系医护人员\n\n🌟 预防提醒：预防接种是保护健康最有效的措施之一',
    createdBy: 'user-mom-002',
    createdAt: '2025-06-20T14:00:00.000Z',
    updatedAt: '2025-06-20T14:00:00.000Z',
  },
  {
    id: 'record-child-003',
    userId: 'user-child-003',
    householdId: 'household-001',
    title: '近视检查',
    description: '发现轻度近视，需要配眼镜',
    recordType: 'diagnosis',
    recordData: {
      diagnosis: '轻度近视',
      symptoms: ['看远处物体模糊'],
      treatment: '配戴眼镜，控制用眼时间'
    },
    aiAdvice: '💡 近视防控建议：\n• 严格控制电子设备使用时间\n• 保持正确的读写姿势，一尺一拳一寸\n• 每隔20分钟休息眼睛，看远处物体\n• 增加户外活动时间，每天至少2小时\n• 定期复查视力，监测度数变化\n• 按医嘱正确佩戴和护理眼镜\n\n🌟 视力提醒：保护视力从小做起，良好的用眼习惯是关键',
    createdBy: 'user-dad-001',
    createdAt: '2025-06-22T11:15:00.000Z',
    updatedAt: '2025-06-22T11:15:00.000Z',
  },

  // 张爷爷的健康档案
  {
    id: 'record-grandpa-001',
    userId: 'user-grandpa-004',
    householdId: 'household-001',
    title: '高血压复查',
    description: '高血压病情稳定，继续服药',
    recordType: 'vital_signs',
    recordData: {
      vitals: {
        bloodPressure: { systolic: 145, diastolic: 90 },
        heartRate: 70,
        temperature: 36.4,
        weight: 68,
        height: 170
      }
    },
    aiAdvice: '💡 高血压管理建议：\n• 严格按医嘱服用降压药，不可随意停药\n• 定期监测血压，记录血压变化\n• 控制食盐摄入，每日不超过6克\n• 保持适度运动，如散步、太极拳\n• 避免情绪激动，保持心情平和\n• 戒烟限酒，保持健康体重\n\n🌟 健康提醒：高血压需要终身管理，规律服药是关键',
    createdBy: 'user-dad-001',
    createdAt: '2025-06-25T10:45:00.000Z',
    updatedAt: '2025-06-25T10:45:00.000Z',
  },
  {
    id: 'record-grandpa-002',
    userId: 'user-grandpa-004',
    householdId: 'household-001',
    title: '糖尿病管理',
    description: '2型糖尿病，血糖控制良好',
    recordType: 'diagnosis',
    recordData: {
      diagnosis: '2型糖尿病',
      symptoms: ['血糖偏高'],
      treatment: '控制饮食，按时服药，定期检查'
    },
    aiAdvice: '💡 糖尿病管理建议：\n• 严格控制饮食，少吃高糖高脂食物\n• 按时服用降糖药物，不可随意停药\n• 定期监测血糖，记录血糖变化\n• 保持适度运动，有助于控制血糖\n• 定期检查并发症，如眼底、肾功能\n• 保持健康体重，控制腰围\n\n🌟 管理提醒：糖尿病可控可防，关键在于坚持良好的生活习惯',
    createdBy: 'user-grandpa-004',
    createdAt: '2025-06-27T15:20:00.000Z',
    updatedAt: '2025-06-27T15:20:00.000Z',
  },
  {
    id: 'record-grandpa-003',
    userId: 'user-grandpa-004',
    householdId: 'household-001',
    title: '降压药调整',
    description: '医生调整了降压药的剂量',
    recordType: 'medication',
    recordData: {
      medications: [
        { name: '氨氯地平', dosage: '5mg', frequency: '每日一次' },
        { name: '二甲双胍', dosage: '500mg', frequency: '每日两次' }
      ]
    },
    aiAdvice: '💡 药物调整建议：\n• 严格按新剂量服药，不可随意更改\n• 密切监测血压和血糖变化\n• 如有不适反应及时联系医生\n• 按时服药，尽量在固定时间服用\n• 不可突然停药，需要医生指导\n• 定期复查，评估药物效果\n\n🌟 用药提醒：药物调整期间需要更加谨慎观察身体反应',
    createdBy: 'user-mom-002',
    createdAt: '2025-06-28T09:10:00.000Z',
    updatedAt: '2025-06-28T09:10:00.000Z',
  },

  // 李奶奶的健康档案
  {
    id: 'record-grandma-001',
    userId: 'user-grandma-005',
    householdId: 'household-001',
    title: '骨密度检查',
    description: '轻度骨质疏松，需要补钙',
    recordType: 'vital_signs',
    recordData: {
      vitals: {
        bloodPressure: { systolic: 135, diastolic: 85 },
        heartRate: 75,
        temperature: 36.3,
        weight: 55,
        height: 158
      }
    },
    aiAdvice: '💡 骨质疏松预防建议：\n• 增加钙质和维生素D的摄入\n• 进行适度的负重运动如散步、爬楼梯\n• 避免过度饮酒和吸烟\n• 预防跌倒，注意居家安全\n• 定期进行骨密度检查\n• 在医生指导下考虑药物治疗\n\n🌟 骨骼提醒：骨骼健康需要终身维护，预防胜于治疗',
    createdBy: 'user-mom-002',
    createdAt: '2025-06-29T14:30:00.000Z',
    updatedAt: '2025-06-29T14:30:00.000Z',
  },
  {
    id: 'record-grandma-002',
    userId: 'user-grandma-005',
    householdId: 'household-001',
    title: '关节炎治疗',
    description: '膝关节轻度退行性病变',
    recordType: 'diagnosis',
    recordData: {
      diagnosis: '膝关节炎',
      symptoms: ['膝盖疼痛', '活动受限'],
      treatment: '理疗，适量运动，避免剧烈活动'
    },
    aiAdvice: '💡 关节炎健康建议：\n• 进行适量的低冲击性运动，如游泳或散步\n• 保持健康的体重减轻关节负担\n• 可以进行热敷缓解疼痛和僵硬\n• 避免长时间保持同一姿势\n• 建议定期复查和遵医嘱用药\n\n🌟 温馨提示：预防胜于治疗，定期体检很重要',
    createdBy: 'user-dad-001',
    createdAt: '2025-06-30T11:00:00.000Z',
    updatedAt: '2025-06-30T11:00:00.000Z',
  },
  {
    id: 'record-grandma-003',
    userId: 'user-grandma-005',
    householdId: 'household-001',
    title: '营养补充',
    description: '老年人营养补充剂',
    recordType: 'medication',
    recordData: {
      medications: [
        { name: '复合维生素', dosage: '1片', frequency: '每日一次' },
        { name: '鱼油胶囊', dosage: '1000mg', frequency: '每日一次' }
      ]
    },
    aiAdvice: '💡 老年营养补充建议：\n• 营养品不能替代均衡饮食\n• 选择适合老年人的营养配方\n• 注意营养品之间的相互作用\n• 饭后服用减少胃部不适\n• 定期评估营养状况和补充效果\n• 咨询医生或营养师的专业建议\n\n🌟 营养提醒：合理膳食是健康的基础，营养品只是辅助',
    createdBy: 'user-grandma-005',
    createdAt: '2025-07-01T16:15:00.000Z',
    updatedAt: '2025-07-01T16:15:00.000Z',
  }
];

let currentMockUser = mockUsers[0]; // 默认使用张爸爸作为当前用户

// 日期格式化工具函数
const formatDate = (dateString) => {
  if (!dateString) return '日期未知';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '日期格式错误';
    }
    return date.toLocaleDateString('zh-CN');
  } catch (error) {
    console.error('日期格式化错误:', error);
    return '日期错误';
  }
};

// AI建议文本安全处理函数
const renderAIAdviceText = (adviceText) => {
  if (!adviceText || typeof adviceText !== 'string') {
    console.warn('Invalid AI advice text:', adviceText);
    return null;
  }
  
  // 清理文本，移除多余的换行符和空格
  const cleanedText = adviceText
    .replace(/\n\n+/g, '\n') // 将多个连续换行符替换为单个
    .replace(/\s+$/g, '') // 移除末尾空格
    .replace(/^\s+/g, ''); // 移除开头空格
  
  const lines = cleanedText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line !== ''); // 更严格的过滤
  
  console.log('Processing AI advice lines:', lines.length, 'lines');
  
  return lines.map((line, index) => (
    <Text key={`advice-line-${index}`} style={styles.aiAdviceText}>
      {line}
    </Text>
  ));
};

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBQHUptHEKoJiu5XCA9ZGmmGuYkdGi7Ubk",
  authDomain: "wenting-health-app.firebaseapp.com",
  projectId: "wenting-health-app",
  storageBucket: "wenting-health-app.firebasestorage.app",
  messagingSenderId: "879987592871",
  appId: "1:879987592871:web:fd14b280de87c9769ad582",
  measurementId: "G-B3FPN0HZH2"
};

// Firebase instances
let firebaseApp = null;
let firestore = null;

// Initialize Firebase
const initializeFirebase = async () => {
  try {
    console.log('🔄 开始初始化Firebase...');
    if (!firebaseApp) {
      console.log('📦 导入Firebase模块...');
      const { initializeApp } = await import('firebase/app');
      const { getFirestore } = await import('firebase/firestore');
      
      console.log('⚙️ 初始化Firebase应用...');
      firebaseApp = initializeApp(firebaseConfig);
      
      console.log('📄 初始化Firestore...');
      firestore = getFirestore(firebaseApp);
      
      console.log('✅ Firebase初始化成功');
      return true;
    }
    console.log('✅ Firebase已初始化');
    return true;
  } catch (error) {
    console.error('❌ Firebase初始化失败:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);
    return false;
  }
};

// Gemini AI Service for Health Advice
const GeminiAIService = {
  genAI: null,
  model: null,
  
  async initialize() {
    try {
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
      if (!apiKey) {
        console.warn('Gemini API key not found, using fallback mode');
        return false;
      }
      
      // Dynamic import for web compatibility
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      console.log('✅ Gemini AI服务初始化成功');
      return true;
    } catch (error) {
      console.error('❌ Gemini AI初始化失败:', error);
      return false;
    }
  },

  async generateHealthAdvice(recordType, title, description) {
    try {
      // Initialize if not already done
      if (!this.model) {
        const initialized = await this.initialize();
        if (!initialized) {
          return this.getFallbackAdvice(recordType, title, description);
        }
      }

      const recordTypeMap = {
        'diagnosis': '诊断记录',
        'medication': '用药记录', 
        'vital_signs': '生命体征检查'
      };

      const prompt = `
        你是一个专业的医疗健康助手。请根据以下健康记录信息，为用户提供个性化的健康建议。

        记录类型：${recordTypeMap[recordType] || recordType}
        记录标题：${title}
        记录描述：${description}

        请按照以下格式提供建议：
        1. 以"💡 [相关建议标题]："开头
        2. 提供5-6条实用的健康管理建议，每条以"• "开头
        3. 最后添加一个励志性的健康提示，以"🌟 "开头

        要求：
        - 建议要专业、实用且易于理解
        - 使用简体中文
        - 针对具体的健康状况给出个性化建议
        - 避免诊断或替代医生建议
        - 强调预防和健康生活方式的重要性
        - 回复长度控制在200字以内

        请现在生成健康建议：
      `;

      console.log('🤖 正在向Gemini AI请求健康建议...');
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const advice = response.text().trim();

      console.log('✅ Gemini AI建议生成成功');
      return {
        success: true,
        advice: advice
      };

    } catch (error) {
      console.error('❌ Gemini AI请求失败:', error);
      // Fallback to predefined advice
      return this.getFallbackAdvice(recordType, title, description);
    }
  },

  // Fallback advice when API is not available
  getFallbackAdvice(recordType, title, description) {
    console.log('⚠️  使用备用建议模式');
    
    let advice = '';
    const keywords = (title + ' ' + description).toLowerCase();
    
    // Generate advice based on record type and keywords
    if (recordType === 'diagnosis') {
      if (keywords.includes('关节炎') || keywords.includes('关节')) {
        advice = '💡 关节炎健康建议：\n• 进行适量的低冲击性运动，如游泳或散步\n• 保持健康的体重减轻关节负担\n• 可以进行热敷缓解疼痛和僵硬\n• 避免长时间保持同一姿势\n• 建议定期复查和遵医嘱用药';
      } else if (keywords.includes('糖尿病') || keywords.includes('血糖')) {
        advice = '💡 糖尿病管理建议：\n• 定期监测血糖水平\n• 遵循低糖、高纤维的饮食计划\n• 保持规律的运动习惯\n• 按时服用药物，不要随意停药\n• 注意足部护理，预防并发症';
      } else if (keywords.includes('高血压') || keywords.includes('血压')) {
        advice = '💡 高血压管理建议：\n• 减少钠盐摄入，采用低盐饮食\n• 保持规律的有氧运动\n• 控制体重，维持健康BMI\n• 限制酒精摄入，戒烟\n• 学会管理压力，保证充足睡眠';
      } else {
        advice = '💡 健康管理建议：\n• 定期复查，密切关注病情变化\n• 遵医嘱用药，不要自行停药或改药\n• 保持健康的生活方式\n• 均衡饮食，适量运动\n• 如有不适及时就医';
      }
    } else if (recordType === 'medication') {
      if (keywords.includes('维生素')) {
        advice = '💡 维生素补充建议：\n• 最好在医生指导下补充维生素\n• 注意不要过量服用，过量也有害\n• 搭配均衡饮食，从天然食物获取营养\n• 选择信誉良好的品牌产品\n• 定期评估补充效果';
      } else {
        advice = '💡 用药安全建议：\n• 严格按照医嘱或说明书用药\n• 注意药物的储存条件\n• 观察用药后的反应和效果\n• 不要随意停药或与他人共用药物\n• 定期复查评估用药效果';
      }
    } else if (recordType === 'vital_signs') {
      if (keywords.includes('体检') || keywords.includes('检查')) {
        advice = '💡 体检结果建议：\n• 定期进行体检以监测健康状态\n• 根据体检结果调整生活方式\n• 保持健康的饮食和运动习惯\n• 及时关注异常指标并咨询医生\n• 建立个人健康档案便于追踪';
      } else {
        advice = '💡 健康监测建议：\n• 定期记录和监测各项生命体征\n• 保持健康的作息规律\n• 均衡饮食，适量运动\n• 注意异常变化及时就医\n• 建立长期的健康管理习惯';
      }
    }
    
    // Add general wellness tip
    const wellnessTips = [
      '🌟 记住：规律的生活作息是健康的基石',
      '🌟 提醒：保持积极乐观的心态对健康很重要',
      '🌟 建议：与家人分享健康信息，互相监督和支持',
      '🌟 提示：有问题及时咨询专业医生，不要自行诊断',
      '🌟 温馨提示：预防胜于治疗，定期体检很重要'
    ];
    
    const randomTip = wellnessTips[Math.floor(Math.random() * wellnessTips.length)];
    advice += '\n\n' + randomTip;
    
    return {
      success: true,
      advice: advice
    };
  }
};

// Real Firebase Service
const RealFirebaseService = {
  initialized: false,
  
  async initialize() {
    try {
      console.log('初始化Firebase服务...');
      
      // 初始化Firebase
      const success = await initializeFirebase();
      if (!success) {
        console.error('Firebase初始化失败，使用Mock数据模式');
        this.initialized = false;
        return false;
      }
      
      console.log('Firebase基础服务初始化成功');
      
      // 尝试初始化测试数据
      await this.initializeTestData();
      
      // 如果数据初始化失败，this.initialized会被设为false
      if (this.initialized) {
        console.log('✓ Firebase服务和数据初始化成功');
        return true;
      } else {
        console.log('⚠️  Firebase连接成功但数据初始化失败，使用Mock数据模式');
        return false;
      }
    } catch (error) {
      console.error('Firebase服务初始化失败:', error);
      console.log('⚠️  使用Mock数据模式');
      this.initialized = false;
      return false;
    }
  },
  
  async initializeTestData() {
    try {
      console.log('开始初始化测试数据到Firebase...');
      
      if (!firestore) {
        console.error('Firestore未初始化，使用Mock数据模式');
        this.initialized = false;
        return;
      }

      const { doc, setDoc, collection, getDocs, query, where } = await import('firebase/firestore');
      
      // 检查是否已存在测试数据
      try {
        const householdsRef = collection(firestore, 'households');
        const existingSnapshot = await getDocs(query(householdsRef, where('createdBy', '==', 'user-dad-001')));
        
        if (!existingSnapshot.empty) {
          console.log('测试数据已存在，跳过初始化');
          this.initialized = true;
          return;
        }
      } catch (checkError) {
        console.log('无法检查现有数据，继续初始化:', checkError.message);
      }
      
      // 1. 创建测试用户
      console.log('创建测试用户...');
      for (const user of mockUsers) {
        try {
          const userRef = doc(firestore, 'users', user.id);
          await setDoc(userRef, {
            ...user,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`✓ 创建用户: ${user.fullName}`);
        } catch (error) {
          console.error(`✗ 创建用户失败 ${user.fullName}:`, error);
        }
      }
      
      // 2. 创建测试家庭
      console.log('创建测试家庭...');
      for (const household of mockHouseholds) {
        try {
          // 创建家庭
          const householdRef = doc(firestore, 'households', household.id);
          await setDoc(householdRef, {
            ...household,
            createdAt: new Date(),
            updatedAt: new Date()
          });
          console.log(`✓ 创建家庭: ${household.name}`);
          
          // 添加家庭成员
          for (const member of household.members) {
            const memberRef = doc(firestore, 'household_members', `${household.id}_${member.userId}`);
            await setDoc(memberRef, {
              id: `${household.id}_${member.userId}`,
              householdId: household.id,
              userId: member.userId,
              role: member.role === 'admin' ? 'ADMIN' : 'MEMBER',
              joinedAt: new Date(member.joinedAt)
            });
            console.log(`  ✓ 添加成员: ${member.userId}`);
          }
        } catch (error) {
          console.error(`✗ 创建家庭失败 ${household.name}:`, error);
        }
      }
      
      // 3. 创建测试健康记录
      console.log('创建测试健康记录...');
      for (const record of mockHealthRecords) {
        try {
          const recordRef = doc(firestore, 'health_records', record.id);
          await setDoc(recordRef, {
            ...record,
            // 简化：不加密数据，直接存储
            recordData: JSON.stringify(record.recordData),
            createdAt: new Date(record.createdAt),
            updatedAt: new Date(record.updatedAt)
          });
          console.log(`✓ 创建健康记录: ${record.title}`);
        } catch (error) {
          console.error(`✗ 创建健康记录失败 ${record.title}:`, error);
        }
      }
      
      console.log('✅ 测试数据初始化完成!');
      this.initialized = true;
    } catch (error) {
      console.error('初始化测试数据失败:', error);
      // 数据初始化失败不影响Firebase连接状态
      console.log('⚠️  测试数据初始化失败，但Firebase连接正常');
      console.log('错误详情:', error.message);
      // 不修改this.initialized，让Firebase连接状态保持为true
      return;
    }
  },
  
  // 家庭管理  
  async getUserHouseholds(userId) {
    if (!this.initialized || !firestore) {
      // 回退到Mock数据
      console.log('使用Mock数据 - getUserHouseholds');
      const user = mockUsers.find(u => u.id === userId);
      if (user && user.householdId) {
        return mockHouseholds.filter(h => h.id === user.householdId);
      }
      return mockHouseholds.filter(h => h.createdBy === userId);
    }
    
    try {
      const { collection, query, where, getDocs, doc, getDoc } = await import('firebase/firestore');
      
      // 查询用户的家庭成员关系
      const membersRef = collection(firestore, 'household_members');
      const memberQuery = query(membersRef, where('userId', '==', userId));
      const memberSnapshot = await getDocs(memberQuery);
      
      const households = [];
      for (const memberDoc of memberSnapshot.docs) {
        const memberData = memberDoc.data();
        // 获取家庭详情
        const householdRef = doc(firestore, 'households', memberData.householdId);
        const householdDoc = await getDoc(householdRef);
        if (householdDoc.exists()) {
          const householdData = householdDoc.data();
          households.push({
            id: householdDoc.id,
            ...householdData,
            createdAt: householdData.createdAt?.toISOString?.() || householdData.createdAt
          });
        }
      }
      
      return households;
    } catch (error) {
      console.error('获取用户家庭失败:', error);
      return [];
    }
  },
  
  async getHouseholdMembers(householdId) {
    if (!this.initialized || !firestore) {
      // 回退到Mock数据
      console.log('使用Mock数据 - getHouseholdMembers');
      const household = mockHouseholds.find(h => h.id === householdId);
      if (!household) return [];
      
      return household.members.map(member => {
        const user = mockUsers.find(u => u.id === member.userId);
        return {
          ...user,
          householdRole: member.role,
          joinedAt: member.joinedAt
        };
      });
    }
    
    try {
      const { collection, query, where, getDocs, doc, getDoc } = await import('firebase/firestore');
      
      // 查询家庭成员
      const membersRef = collection(firestore, 'household_members');
      const memberQuery = query(membersRef, where('householdId', '==', householdId));
      const memberSnapshot = await getDocs(memberQuery);
      
      const members = [];
      for (const memberDoc of memberSnapshot.docs) {
        const memberData = memberDoc.data();
        // 获取用户详情
        const userRef = doc(firestore, 'users', memberData.userId);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          members.push({
            ...userData,
            householdRole: memberData.role.toLowerCase(),
            joinedAt: memberData.joinedAt?.toISOString?.() || memberData.joinedAt
          });
        }
      }
      
      return members;
    } catch (error) {
      console.error('获取家庭成员失败:', error);
      return [];
    }
  },
  
  async createHousehold(household) {
    if (!this.initialized || !firestore) throw new Error('Firebase未初始化');
    
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      
      // 创建家庭
      const householdRef = doc(firestore, 'households', household.id);
      await setDoc(householdRef, {
        ...household,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // 添加创建者为管理员
      const memberRef = doc(firestore, 'household_members', `${household.id}_${household.createdBy}`);
      await setDoc(memberRef, {
        id: `${household.id}_${household.createdBy}`,
        householdId: household.id,
        userId: household.createdBy,
        role: 'ADMIN',
        joinedAt: new Date()
      });
      
      console.log('✓ 创建家庭成功:', household.name);
      return household;
    } catch (error) {
      console.error('创建家庭失败:', error);
      throw error;
    }
  },
  
  // 健康记录管理
  async getHealthRecords(householdId, userId, memberType, encryptionKey) {
    if (!this.initialized || !firestore) {
      // 回退到Mock数据
      console.log('使用Mock数据 - getHealthRecords');
      let records = [...mockHealthRecords];
      
      // 过滤家庭记录
      records = records.filter(r => r.householdId === householdId);
      
      // 普通成员只能看自己的记录
      if (memberType === 'member') {
        records = records.filter(r => r.userId === userId);
      }
      
      // 按创建时间排序
      records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return records;
    }
    
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      const recordsRef = collection(firestore, 'health_records');
      let recordQuery = query(recordsRef, where('householdId', '==', householdId));
      
      // 普通成员只能看自己的记录
      if (memberType === 'member') {
        recordQuery = query(recordsRef, 
          where('householdId', '==', householdId),
          where('userId', '==', userId)
        );
      }
      
      const snapshot = await getDocs(recordQuery);
      const records = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        records.push({
          id: doc.id,
          ...data,
          recordData: typeof data.recordData === 'string' ? JSON.parse(data.recordData) : data.recordData,
          createdAt: data.createdAt?.toISOString?.() || data.createdAt,
          updatedAt: data.updatedAt?.toISOString?.() || data.updatedAt
        });
      });
      
      // 按创建时间排序
      records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return records;
    } catch (error) {
      console.error('获取健康记录失败:', error);
      // 权限错误时回退到Mock数据
      if (error.message?.includes('permissions')) {
        console.log('⚠️  Firebase权限不足，使用Mock数据 - getHealthRecords');
        let records = [...mockHealthRecords];
        records = records.filter(r => r.householdId === householdId);
        if (memberType === 'member') {
          records = records.filter(r => r.userId === userId);
        }
        records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return records;
      }
      return [];
    }
  },
  
  async createHealthRecord(record, encryptionKey) {
    if (!this.initialized || !firestore) {
      // 回退到Mock数据模式 - 只在内存中添加
      console.log('使用Mock数据模式 - createHealthRecord');
      const newRecord = {
        ...record,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockHealthRecords.push(newRecord);
      console.log('✓ Mock模式创建健康记录成功:', record.title);
      return newRecord;
    }
    
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      
      const recordRef = doc(firestore, 'health_records', record.id);
      await setDoc(recordRef, {
        ...record,
        recordData: JSON.stringify(record.recordData),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('✓ 创建健康记录成功:', record.title);
      // 返回带有正确日期格式的记录
      return {
        ...record,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('创建健康记录失败:', error);
      if (error.message?.includes('permissions')) {
        console.log('⚠️  Firebase权限不足，使用Mock数据模式 - createHealthRecord');
        const newRecord = {
          ...record,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        mockHealthRecords.push(newRecord);
        console.log('✓ Mock模式创建健康记录成功:', record.title);
        return newRecord;
      }
      throw error;
    }
  },
  
  async updateHealthRecord(recordId, updates, encryptionKey) {
    if (!this.initialized || !firestore) {
      // 回退到Mock数据模式 - 只在内存中更新
      console.log('使用Mock数据模式 - updateHealthRecord');
      const recordIndex = mockHealthRecords.findIndex(r => r.id === recordId);
      if (recordIndex !== -1) {
        mockHealthRecords[recordIndex] = {
          ...mockHealthRecords[recordIndex],
          ...updates,
          updatedAt: new Date().toISOString()
        };
        console.log('✓ Mock模式更新健康记录成功:', recordId);
        return mockHealthRecords[recordIndex];
      }
      throw new Error('记录不存在');
    }
    
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      
      const updateData = {
        ...updates,
        updatedAt: new Date()
      };
      
      if (updates.recordData) {
        updateData.recordData = JSON.stringify(updates.recordData);
      }
      
      const recordRef = doc(firestore, 'health_records', recordId);
      await updateDoc(recordRef, updateData);
      
      console.log('✓ 更新健康记录成功:', recordId);
      return { ...updates, id: recordId };
    } catch (error) {
      console.error('更新健康记录失败:', error);
      if (error.message?.includes('permissions')) {
        console.log('⚠️  Firebase权限不足，使用Mock数据模式 - updateHealthRecord');
        const recordIndex = mockHealthRecords.findIndex(r => r.id === recordId);
        if (recordIndex !== -1) {
          mockHealthRecords[recordIndex] = {
            ...mockHealthRecords[recordIndex],
            ...updates,
            updatedAt: new Date().toISOString()
          };
          console.log('✓ Mock模式更新健康记录成功:', recordId);
          return mockHealthRecords[recordIndex];
        }
      }
      throw error;
    }
  },
  
  async deleteHealthRecord(recordId) {
    if (!this.initialized || !firestore) {
      // 回退到Mock数据模式 - 只在内存中删除
      console.log('使用Mock数据模式 - deleteHealthRecord');
      const recordIndex = mockHealthRecords.findIndex(r => r.id === recordId);
      if (recordIndex !== -1) {
        mockHealthRecords.splice(recordIndex, 1);
        console.log('✓ Mock模式删除健康记录成功:', recordId);
        return true;
      }
      throw new Error('记录不存在');
    }
    
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      
      const recordRef = doc(firestore, 'health_records', recordId);
      await deleteDoc(recordRef);
      
      console.log('✓ 删除健康记录成功:', recordId);
      return true;
    } catch (error) {
      console.error('删除健康记录失败:', error);
      if (error.message?.includes('permissions')) {
        console.log('⚠️  Firebase权限不足，使用Mock数据模式 - deleteHealthRecord');
        const recordIndex = mockHealthRecords.findIndex(r => r.id === recordId);
        if (recordIndex !== -1) {
          mockHealthRecords.splice(recordIndex, 1);
          console.log('✓ Mock模式删除健康记录成功:', recordId);
          return true;
        }
      }
      throw error;
    }
  },
  
  // 用户管理
  async createUser(user) {
    if (!this.initialized || !firestore) throw new Error('Firebase未初始化');
    
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      
      const userRef = doc(firestore, 'users', user.id);
      await setDoc(userRef, {
        ...user,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      return user;
    } catch (error) {
      console.error('创建用户失败:', error);
      throw error;
    }
  },
  
  async getUserById(id) {
    if (!this.initialized || !firestore) {
      // 回退到Mock数据
      console.log('使用Mock数据 - getUserById');
      return mockUsers.find(u => u.id === id) || null;
    }
    
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      
      const userRef = doc(firestore, 'users', id);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          id: userDoc.id,
          ...data,
          createdAt: data.createdAt?.toISOString?.() || data.createdAt,
          updatedAt: data.updatedAt?.toISOString?.() || data.updatedAt
        };
      }
      
      return null;
    } catch (error) {
      console.error('获取用户失败:', error);
      if (error.message?.includes('permissions')) {
        console.log('⚠️  Firebase权限不足，使用Mock数据 - getUserById');
        return mockUsers.find(u => u.id === id) || null;
      }
      return null;
    }
  },
  
  async getUserByEmail(email) {
    if (!this.initialized || !firestore) throw new Error('Firebase未初始化');
    
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      
      const usersRef = collection(firestore, 'users');
      const userQuery = query(usersRef, where('email', '==', email));
      const snapshot = await getDocs(userQuery);
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toISOString?.() || data.createdAt,
          updatedAt: data.updatedAt?.toISOString?.() || data.updatedAt
        };
      }
      
      return null;
    } catch (error) {
      console.error('根据邮箱获取用户失败:', error);
      return null;
    }
  },
};

const RealAuthService = {
  async initialize() {
    console.log('Real Auth initialized');
  },
  async signInWithGoogle() {
    try {
      return await firebaseAuthService.signInWithGoogle();
    } catch (error) {
      return {
        success: false,
        error: 'Google登录失败: ' + error.message
      };
    }
  },
  async getCurrentUser() {
    // 返回测试用户作为当前用户
    const testUser = await RealFirebaseService.getUserById('user-dad-001');
    return testUser || currentMockUser;
  }
};

// Constants
const COLORS = {
  PRIMARY: '#007AFF',
  SECONDARY: '#5AC8FA',
  SUCCESS: '#34C759',
  WARNING: '#FF9500',
  ERROR: '#FF3B30',
  BACKGROUND: '#F2F2F7',
  SURFACE: '#FFFFFF',
  TEXT_PRIMARY: '#000000',
  TEXT_SECONDARY: '#8E8E93',
  BORDER: '#C6C6C8',
  DISABLED: '#8E8E93',
};

const FONTS = {
  SIZES: {
    SMALL: 12,
    MEDIUM: 16,
    LARGE: 20,
    XLARGE: 24,
  },
};

const SPACING = {
  XS: 4,
  SM: 8,
  MD: 16,
  LG: 24,
  XL: 32,
  XXL: 48,
};

// Simple Health Records Screen Component
interface HealthRecordsProps {
  onBack: () => void;
  currentUser: any;
  households: any[];
  householdMembers: any[];
  healthRecords: any[];
  dataLoaded: boolean;
  onDataUpdate: (user: any) => Promise<void>;
}

const SimpleHealthRecordsScreen: React.FC<HealthRecordsProps> = ({ 
  onBack, 
  currentUser, 
  households, 
  householdMembers, 
  healthRecords,
  dataLoaded,
  onDataUpdate 
}) => {
  const [records, setRecords] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    recordType: 'vital_signs',
    targetUserId: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  // 初始化数据
  useEffect(() => {
    if (dataLoaded && householdMembers.length > 0) {
      // 设置默认选中成员
      const defaultMember = householdMembers.find(m => m.id === currentUser?.id) || householdMembers[0];
      setSelectedMember(defaultMember);
      
      // 使用传入的健康记录数据
      setRecords(healthRecords);
      
      console.log('✓ 健康记录页面数据初始化完成');
    }
  }, [dataLoaded, householdMembers, healthRecords, currentUser]);

  const loadRecordsForMember = async (householdId, memberId) => {
    if (!memberId || households.length === 0) return;
    
    try {
      console.log('📈 加载成员记录:', memberId);
      const recordsResult = await RealFirebaseService.getHealthRecords(
        householdId,
        memberId,
        'member',
        'test-key'
      );
      setRecords(recordsResult);
      console.log('✓ 成员记录加载完成:', recordsResult.length, '条记录');
    } catch (error) {
      console.error('Load member records error:', error);
    }
  };

  const handleMemberChange = async (member) => {
    setSelectedMember(member);
    if (households.length > 0) {
      await loadRecordsForMember(households[0].id, member.id);
    }
  };

  const handleCreateHealthRecord = async () => {
    if (!createForm.title.trim()) {
      alert('请输入健康档案标题');
      return;
    }

    if (!currentUser || households.length === 0) {
      alert('用户或家庭信息获取失败');
      return;
    }

    const targetUserId = createForm.targetUserId || selectedMember?.id;
    if (!targetUserId) {
      alert('请选择家庭成员');
      return;
    }

    try {
      setIsCreating(true);
      
      let recordData = {};
      
      // Generate appropriate data based on record type
      if (createForm.recordType === 'vital_signs') {
        recordData = {
          vitals: {
            bloodPressure: { systolic: 120, diastolic: 80 },
            heartRate: 75,
            temperature: 36.5,
            weight: 70,
          }
        };
      } else if (createForm.recordType === 'medication') {
        recordData = {
          medications: [
            { name: '示例药物', dosage: '1片', frequency: '每日一次' }
          ]
        };
      } else if (createForm.recordType === 'diagnosis') {
        recordData = {
          diagnosis: '示例诊断',
          symptoms: ['示例症状'],
          treatment: '示例治疗方案'
        };
      }
      
      const now = new Date();
      
      // Generate AI advice for the new record
      console.log('🤖 生成AI健康建议...');
      const aiResult = await GeminiAIService.generateHealthAdvice(
        createForm.recordType,
        createForm.title,
        createForm.description
      );
      
      const record = {
        id: `health_record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: targetUserId,
        householdId: households[0].id,
        title: createForm.title,
        description: createForm.description,
        recordType: createForm.recordType,
        recordData: recordData,
        aiAdvice: aiResult.advice, // Add AI-generated advice
        createdBy: currentUser.id,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      
      await RealFirebaseService.createHealthRecord(record, 'test-key');
      
      alert('健康档案保存成功');
      setShowCreateModal(false);
      setCreateForm({ title: '', description: '', recordType: 'vital_signs', targetUserId: '' });
      
      // 局部更新：直接添加新记录到本地状态
      const newRecordWithFormattedDate = {
        ...record,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      console.log('📅 新记录日期:', now.toISOString(), '格式化后:', formatDate(now.toISOString()));
      setRecords(prevRecords => [newRecordWithFormattedDate, ...prevRecords]);
      console.log('✓ 新记录已添加到本地状态');
    } catch (error) {
      console.error('Create health record error:', error);
      alert('健康档案创建失败: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditRecord = (record) => {
    setEditingRecord(record);
    setCreateForm({
      title: record.title,
      description: record.description,
      recordType: record.recordType,
      targetUserId: record.userId,
    });
    setShowEditModal(true);
  };

  const handleUpdateRecord = async () => {
    if (!editingRecord) return;

    try {
      setIsCreating(true);
      
      const updates = {
        title: createForm.title,
        description: createForm.description,
        recordType: createForm.recordType,
      };
      
      await RealFirebaseService.updateHealthRecord(editingRecord.id, updates, 'test-key');
      
      alert('健康档案更新成功');
      setShowEditModal(false);
      setEditingRecord(null);
      setCreateForm({ title: '', description: '', recordType: 'vital_signs', targetUserId: '' });
      
      // 局部更新：更新本地状态中的记录
      setRecords(prevRecords => 
        prevRecords.map(r => 
          r.id === editingRecord.id 
            ? { ...r, ...updates, updatedAt: new Date().toISOString() }
            : r
        )
      );
      console.log('✓ 记录已在本地状态中更新');
    } catch (error) {
      console.error('Update health record error:', error);
      alert('健康档案更新失败: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRecord = async (recordId) => {
    // Use native browser confirm for better web compatibility
    const confirmed = window.confirm('确定要删除这条健康档案吗？');
    
    if (confirmed) {
      try {
        await RealFirebaseService.deleteHealthRecord(recordId);
        alert('健康档案已删除');
        
        // 局部更新：从本地状态中移除记录
        setRecords(prevRecords => prevRecords.filter(r => r.id !== recordId));
        console.log('✓ 记录已从本地状态中移除');
      } catch (error) {
        console.error('Delete health record error:', error);
        alert('删除失败: ' + error.message);
      }
    }
  };


  // 显示加载状态
  if (!dataLoaded) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.title}>健康档案</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>健康档案</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* 家庭成员选择器 */}
      {householdMembers.length > 0 && (
        <View style={styles.memberSelector}>
          <Text style={styles.selectorLabel}>查看成员:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberScrollView}>
            {householdMembers.map((member) => (
              <TouchableOpacity
                key={member.id}
                style={[
                  styles.memberChip,
                  selectedMember?.id === member.id && styles.memberChipSelected
                ]}
                onPress={() => handleMemberChange(member)}
              >
                <Text style={[
                  styles.memberChipText,
                  selectedMember?.id === member.id && styles.memberChipTextSelected
                ]}>
                  {member.fullName}
                  {member.householdRole === 'admin' && ' 👑'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView style={styles.content}>
        {records.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {selectedMember ? `${selectedMember.fullName}暂无健康档案` : '暂无健康档案'}
            </Text>
            <Text style={styles.emptyDescription}>
              创建第一个健康档案，开始记录和管理健康数据
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.createButtonText}>创建档案</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.recordsList}>
            {records.map((record, index) => (
              <View key={index} style={styles.recordCard}>
                <View style={styles.recordHeader}>
                  <Text style={styles.recordTitle}>{record.title}</Text>
                  <View style={styles.recordActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEditRecord(record)}
                    >
                      <Text style={styles.actionButtonText}>编辑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton, { marginLeft: SPACING.SM }]}
                      onPress={() => handleDeleteRecord(record.id)}
                    >
                      <Text style={[styles.actionButtonText, styles.deleteButtonText]}>删除</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.recordMeta}>
                  <Text style={styles.recordType}>{record.recordType}</Text>
                  <Text style={styles.recordDate}>
                    {formatDate(record.createdAt)}
                  </Text>
                </View>
                
                {record.description && (
                  <Text style={styles.recordDescription}>{record.description}</Text>
                )}
                
                {/* AI健康建议区域 */}
                {record.aiAdvice && (
                  <View style={styles.aiAdviceContainer}>
                    <Text style={styles.aiAdviceTitle}>🤖 AI健康助手</Text>
                    <View>
                      {renderAIAdviceText(record.aiAdvice)}
                    </View>
                  </View>
                )}
                
                <View style={styles.recordFooter}>
                  <Text style={styles.recordCreator}>
                    由 {mockUsers.find(u => u.id === record.createdBy)?.fullName || '未知'} 创建
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {showCreateModal && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>创建健康档案</Text>
            
            <Text style={styles.inputLabel}>选择家庭成员</Text>
            <select
              style={styles.select}
              value={createForm.targetUserId}
              onChange={(e) => setCreateForm({ ...createForm, targetUserId: e.target.value })}
            >
              <option value="">选择成员</option>
              {householdMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName} {member.householdRole === 'admin' ? '(管理员)' : ''}
                </option>
              ))}
            </select>
            
            <Text style={styles.inputLabel}>档案类型</Text>
            <select
              style={styles.select}
              value={createForm.recordType}
              onChange={(e) => setCreateForm({ ...createForm, recordType: e.target.value })}
            >
              <option value="vital_signs">生命体征</option>
              <option value="medication">用药记录</option>
              <option value="diagnosis">诊断记录</option>
            </select>
            
            <Text style={styles.inputLabel}>档案标题</Text>
            <input
              style={styles.input}
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              placeholder="输入健康档案标题"
            />
            
            <Text style={styles.inputLabel}>档案描述</Text>
            <textarea
              style={styles.textarea}
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="输入健康档案描述（可选）"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createModalButton}
                onPress={handleCreateHealthRecord}
                disabled={isCreating}
              >
                <Text style={styles.createModalButtonText}>
                  {isCreating ? '创建中...' : '创建'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {showEditModal && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>编辑健康档案</Text>
            
            <Text style={styles.inputLabel}>档案类型</Text>
            <select
              style={styles.select}
              value={createForm.recordType}
              onChange={(e) => setCreateForm({ ...createForm, recordType: e.target.value })}
            >
              <option value="vital_signs">生命体征</option>
              <option value="medication">用药记录</option>
              <option value="diagnosis">诊断记录</option>
            </select>
            
            <Text style={styles.inputLabel}>档案标题</Text>
            <input
              style={styles.input}
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              placeholder="输入健康档案标题"
            />
            
            <Text style={styles.inputLabel}>档案描述</Text>
            <textarea
              style={styles.textarea}
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="输入健康档案描述（可选）"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowEditModal(false);
                  setEditingRecord(null);
                  setCreateForm({ title: '', description: '', recordType: 'vital_signs', targetUserId: '' });
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createModalButton}
                onPress={handleUpdateRecord}
                disabled={isCreating}
              >
                <Text style={styles.createModalButtonText}>
                  {isCreating ? '更新中...' : '更新'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

// Simple Household Screen Component
interface HouseholdScreenProps {
  onBack: () => void;
  currentUser: any;
  households: any[];
  householdMembers: any[];
  dataLoaded: boolean;
  onDataUpdate: (user: any) => Promise<void>;
}

const SimpleHouseholdScreen: React.FC<HouseholdScreenProps> = ({ 
  onBack, 
  currentUser, 
  households, 
  householdMembers,
  dataLoaded,
  onDataUpdate 
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (dataLoaded) {
      console.log('✓ 家庭页面数据初始化完成');
    }
  }, [dataLoaded]);

  const handleCreateHousehold = async () => {
    if (!createForm.name.trim()) {
      alert('请输入家庭名称');
      return;
    }

    if (!currentUser) {
      alert('用户信息获取失败');
      return;
    }

    try {
      setIsCreating(true);
      
      const now = new Date();
      const household = {
        id: `household_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: createForm.name.trim(),
        description: createForm.description?.trim(),
        createdBy: currentUser.id,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      
      await RealFirebaseService.createHousehold(household);
      
      alert('家庭创建成功');
      setShowCreateModal(false);
      setCreateForm({ name: '', description: '' });
      
      // 为了简化，对于家庭创建仍然刷新所有数据（因为涉及复杂的成员关系）
      await onDataUpdate(currentUser);
    } catch (error) {
      console.error('Create household error:', error);
      alert('家庭创建失败');
    } finally {
      setIsCreating(false);
    }
  };

  // 显示加载状态
  if (!dataLoaded) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.title}>我的家庭</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>我的家庭</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {households.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>暂无家庭</Text>
            <Text style={styles.emptyDescription}>
              创建您的第一个家庭，开始管理家庭健康档案
            </Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Text style={styles.createButtonText}>创建家庭</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.householdList}>
            {households.map((household, index) => (
              <View key={index} style={styles.householdCard}>
                <Text style={styles.householdName}>{household.name}</Text>
                {household.description && (
                  <Text style={styles.householdDescription}>{household.description}</Text>
                )}
                
                <Text style={styles.membersSectionTitle}>家庭成员 ({householdMembers.length}人)</Text>
                <View style={styles.membersList}>
                  {householdMembers.map((member, memberIndex) => (
                    <View key={memberIndex} style={styles.memberItem}>
                      <Text style={styles.memberName}>
                        {member.fullName}
                        {member.householdRole === 'admin' && (
                          <Text style={styles.adminBadge}> 👑 管理员</Text>
                        )}
                      </Text>
                      <Text style={styles.memberInfo}>
                        加入于 {formatDate(member.joinedAt)}
                      </Text>
                    </View>
                  ))}
                </View>
                
                <Text style={styles.householdDate}>
                  创建于 {formatDate(household.createdAt)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {showCreateModal && (
        <View style={styles.modal}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>创建新家庭</Text>
            
            <Text style={styles.inputLabel}>家庭名称</Text>
            <input
              style={styles.input}
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="输入家庭名称"
            />
            
            <Text style={styles.inputLabel}>家庭描述</Text>
            <textarea
              style={styles.textarea}
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="输入家庭描述（可选）"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createModalButton}
                onPress={handleCreateHousehold}
                disabled={isCreating}
              >
                <Text style={styles.createModalButtonText}>
                  {isCreating ? '创建中...' : '创建'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

// Main App Component
const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  
  // 共享数据状态
  const [appData, setAppData] = useState({
    households: [],
    householdMembers: [],
    healthRecords: [],
    dataLoaded: false
  });

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setLoading(true);
      console.log('🚀 开始初始化应用...');
      
      // Initialize services
      await RealAuthService.initialize();
      const firebaseInitialized = await RealFirebaseService.initialize();
      
      // Initialize Gemini AI service
      const geminiInitialized = await GeminiAIService.initialize();
      if (geminiInitialized) {
        console.log('✅ Gemini AI服务已启用 - 将使用真实AI建议');
      } else {
        console.log('⚠️  Gemini AI未启用 - 将使用备用建议模式');
      }
      
      setFirebaseConnected(firebaseInitialized);
      if (firebaseInitialized) {
        console.log('✓ Firebase服务初始化成功 - 数据将保存到云端');
      } else {
        console.log('⚠️  Firebase连接失败 - 使用Mock数据模式');
      }
      
      // Check if user is already authenticated
      const user = await RealAuthService.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        setIsLoggedIn(true);
        console.log('✓ 用户已登录:', user.fullName);
        
        // 加载所有数据
        await loadAllAppData(user);
      } else {
        // Auto-create a test user for demo
        console.log('创建测试用户...');
        await createTestUser();
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      console.log('⚠️  初始化遇到问题，使用离线模式');
      await createTestUser();
    } finally {
      setLoading(false);
    }
  };

  // 加载所有应用数据
  const loadAllAppData = async (user) => {
    try {
      console.log('📊 开始加载应用数据...');
      
      // 加载家庭信息
      console.log('🏠 加载家庭信息...');
      const households = await RealFirebaseService.getUserHouseholds(user.id);
      console.log('✓ 家庭加载完成:', households.length, '个家庭');
      
      let members = [];
      let records = [];
      
      if (households.length > 0) {
        const household = households[0];
        
        // 加载家庭成员
        console.log('👥 加载家庭成员...');
        members = await RealFirebaseService.getHouseholdMembers(household.id);
        console.log('✓ 成员加载完成:', members.length, '个成员');
        
        // 加载健康记录——获取第一个成员的记录
        if (members.length > 0) {
          console.log('📈 加载健康记录...');
          const defaultMember = members.find(m => m.id === user.id) || members[0];
          records = await RealFirebaseService.getHealthRecords(
            household.id,
            defaultMember.id,
            'member',
            'test-key'
          );
          console.log('✓ 健康记录加载完成:', records.length, '条记录');
        }
      }
      
      // 更新全局数据状态
      setAppData({
        households,
        householdMembers: members,
        healthRecords: records,
        dataLoaded: true
      });
      
      console.log('✅ 所有数据加载完成!');
    } catch (error) {
      console.error('加载应用数据失败:', error);
      // 即使失败也标记为已加载，避免无限加载
      setAppData(prev => ({ ...prev, dataLoaded: true }));
    }
  };

  const createTestUser = async () => {
    try {
      // Try Google sign-in first
      const result = await RealAuthService.signInWithGoogle();
      if (result.success && result.data) {
        setCurrentUser(result.data);
        setIsLoggedIn(true);
        await loadAllAppData(result.data);
        return;
      }
    } catch (error) {
      console.log('Google sign-in not available, creating mock user');
    }

    // Create a mock user for testing
    const mockUser = {
      id: 'test-user-' + Date.now(),
      email: 'test@example.com',
      fullName: 'Test User',
      biometricEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    currentMockUser = mockUser;
    setCurrentUser(mockUser);
    setIsLoggedIn(true);
    
    // 加载测试用户的数据
    await loadAllAppData(mockUser);
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const result = await RealAuthService.signInWithGoogle();
      if (result.success && result.data) {
        setCurrentUser(result.data);
        setIsLoggedIn(true);
        alert('Google登录成功！');
      } else {
        alert(result.error || 'Google登录失败');
      }
    } catch (error) {
      console.error('Google login error:', error);
      alert('Google登录失败');
    } finally {
      setLoading(false);
    }
  };

  const renderScreen = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      );
    }

    if (!isLoggedIn) {
      return (
        <View style={styles.loginContainer}>
          <Text style={styles.appTitle}>WENTING</Text>
          <Text style={styles.appSubtitle}>家庭健康管理应用</Text>
          
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
          >
            <Text style={styles.googleButtonText}>🔍 使用 Google 登录</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.demoButton}
            onPress={() => setIsLoggedIn(true)}
          >
            <Text style={styles.demoButtonText}>演示模式</Text>
          </TouchableOpacity>
        </View>
      );
    }

    switch (currentScreen) {
      case 'health':
        return (
          <SimpleHealthRecordsScreen 
            onBack={() => setCurrentScreen('home')}
            currentUser={currentUser}
            households={appData.households}
            householdMembers={appData.householdMembers}
            healthRecords={appData.healthRecords}
            dataLoaded={appData.dataLoaded}
            onDataUpdate={loadAllAppData}
          />
        );
      case 'family':
        return (
          <SimpleHouseholdScreen 
            onBack={() => setCurrentScreen('home')}
            currentUser={currentUser}
            households={appData.households}
            householdMembers={appData.householdMembers}
            dataLoaded={appData.dataLoaded}
            onDataUpdate={loadAllAppData}
          />
        );
      default:
        return (
          <ScrollView style={styles.container}>
            <View style={styles.homeHeader}>
              <Text style={styles.title}>WENTING 健康管理</Text>
              <Text style={styles.subtitle}>家庭健康监督助手</Text>
              {currentUser && (
                <Text style={styles.userInfo}>欢迎，{currentUser.fullName}！</Text>
              )}
              <View style={styles.statusIndicator}>
                <Text style={[styles.statusText, firebaseConnected ? styles.statusConnected : styles.statusOffline]}>
                  {firebaseConnected ? '✓ 云端连接' : '⚠️  离线模式'}
                </Text>
              </View>
            </View>
            
            <View style={styles.menuContainer}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setCurrentScreen('health')}
              >
                <Text style={styles.menuTitle}>健康记录</Text>
                <Text style={styles.menuSubtitle}>查看和管理健康数据</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => setCurrentScreen('family')}
              >
                <Text style={styles.menuTitle}>家庭成员</Text>
                <Text style={styles.menuSubtitle}>管理家庭成员信息</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => alert('日历功能开发中...')}
              >
                <Text style={styles.menuTitle}>日历提醒</Text>
                <Text style={styles.menuSubtitle}>设置健康提醒</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => alert('设置功能开发中...')}
              >
                <Text style={styles.menuTitle}>设置</Text>
                <Text style={styles.menuSubtitle}>应用设置和偏好</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        );
    }
  };

  return (
    <View style={styles.container}>
      {renderScreen()}
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
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.LG,
    backgroundColor: COLORS.BACKGROUND,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
    marginBottom: 8,
  },
  appSubtitle: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: 40,
  },
  googleButton: {
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
    maxWidth: 300,
  },
  googleButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
  },
  demoButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 300,
  },
  demoButtonText: {
    color: COLORS.SURFACE,
    fontSize: 16,
    fontWeight: '600',
  },
  homeHeader: {
    padding: 20,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
  },
  userInfo: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 8,
  },
  statusIndicator: {
    marginTop: 8,
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusConnected: {
    color: '#28a745',
  },
  statusOffline: {
    color: '#ffc107',
  },
  menuContainer: {
    paddingHorizontal: 20,
  },
  menuItem: {
    backgroundColor: COLORS.SURFACE,
    padding: 20,
    marginBottom: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 5,
  },
  menuSubtitle: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.LG,
    paddingBottom: SPACING.MD,
    backgroundColor: COLORS.SURFACE,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.PRIMARY,
    fontWeight: '600',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 20,
    color: COLORS.SURFACE,
    fontWeight: 'bold',
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
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.LG,
    marginBottom: SPACING.SM,
  },
  emptyDescription: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.LG,
  },
  createButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: SPACING.MD,
  },
  createButtonText: {
    color: COLORS.SURFACE,
    fontSize: 16,
    fontWeight: '600',
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
    fontWeight: 'bold',
    color: COLORS.PRIMARY,
  },
  statLabel: {
    fontSize: FONTS.SIZES.SMALL,
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
  recordTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.XS,
  },
  recordType: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.SM,
  },
  recordDescription: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
    marginBottom: SPACING.SM,
  },
  recordDate: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT_SECONDARY,
  },
  householdList: {
    paddingHorizontal: SPACING.LG,
  },
  householdCard: {
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
  householdName: {
    fontSize: FONTS.SIZES.LARGE,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.XS,
  },
  householdDescription: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
    marginBottom: SPACING.SM,
  },
  householdDate: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT_SECONDARY,
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.LG,
  },
  modalContent: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    padding: SPACING.LG,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontWeight: 'bold',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.LG,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SM,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: COLORS.BACKGROUND,
    marginBottom: SPACING.MD,
  },
  textarea: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: COLORS.BACKGROUND,
    marginBottom: SPACING.MD,
    minHeight: 80,
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.MD,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginRight: SPACING.SM,
  },
  cancelButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '600',
  },
  createModalButton: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginLeft: SPACING.SM,
  },
  createModalButtonText: {
    color: COLORS.SURFACE,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Member selector styles
  memberSelector: {
    backgroundColor: COLORS.SURFACE,
    paddingVertical: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  selectorLabel: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SM,
    fontWeight: '600',
  },
  memberScrollView: {
    flexDirection: 'row',
  },
  memberChip: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 20,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    marginRight: SPACING.SM,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  memberChipSelected: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  memberChipText: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '500',
  },
  memberChipTextSelected: {
    color: COLORS.SURFACE,
  },
  
  // Record card styles
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.SM,
  },
  recordActions: {
    flexDirection: 'row',
  },
  actionButton: {
    backgroundColor: COLORS.SECONDARY,
    borderRadius: 6,
    paddingHorizontal: SPACING.SM,
    paddingVertical: 4,
  },
  deleteButton: {
    backgroundColor: COLORS.ERROR,
  },
  actionButtonText: {
    color: COLORS.SURFACE,
    fontSize: FONTS.SIZES.SMALL,
    fontWeight: '600',
  },
  deleteButtonText: {
    color: COLORS.SURFACE,
  },
  recordMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  recordFooter: {
    marginTop: SPACING.SM,
    paddingTop: SPACING.SM,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  recordCreator: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT_SECONDARY,
    fontStyle: 'italic',
  },
  
  // Household member styles
  membersSectionTitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '600',
    marginTop: SPACING.MD,
    marginBottom: SPACING.SM,
  },
  membersList: {
    backgroundColor: COLORS.BACKGROUND,
    borderRadius: 8,
    padding: SPACING.MD,
    marginBottom: SPACING.MD,
  },
  memberItem: {
    paddingVertical: SPACING.SM,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  memberName: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '500',
    marginBottom: 2,
  },
  adminBadge: {
    color: COLORS.WARNING,
    fontSize: FONTS.SIZES.SMALL,
  },
  memberInfo: {
    fontSize: FONTS.SIZES.SMALL,
    color: COLORS.TEXT_SECONDARY,
  },
  
  // Select dropdown style
  select: {
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: COLORS.BACKGROUND,
    marginBottom: SPACING.MD,
    fontFamily: 'inherit',
  },
  
  // AI Advice styles
  aiAdviceContainer: {
    backgroundColor: '#f8f9ff',
    borderRadius: 8,
    padding: SPACING.MD,
    marginTop: SPACING.SM,
    marginBottom: SPACING.SM,
    borderLeftWidth: 4,
    borderLeftColor: '#4285f4',
  },
  aiAdviceTitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontWeight: '600',
    color: '#4285f4',
    marginBottom: SPACING.SM,
  },
  aiAdviceText: {
    fontSize: FONTS.SIZES.SMALL,
    color: '#2c3e50',
    lineHeight: 18,
  },
});

export default App;