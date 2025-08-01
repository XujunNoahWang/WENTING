import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  HealthDocumentAnalysis,
  WeatherData,
  ApiResponse,
  MedicationData,
  DiagnosisData,
  HealthRecord,
} from '@types/index';
import { API_ENDPOINTS, ERROR_MESSAGES } from '@constants/index';

export class GeminiService {
  private static instance: GeminiService;
  private genAI: GoogleGenerativeAI;
  private model: any;

  private constructor() {
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('Gemini API key not configured, health analysis features will be limited');
      // Create a mock instance to prevent crashes
      this.genAI = null as any;
      this.model = {
        generateContent: () => Promise.reject(new Error('Gemini API not configured'))
      };
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
  }

  static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  /**
   * Analyze health document image and extract structured data
   */
  async analyzeHealthDocument(imageBase64: string): Promise<ApiResponse<HealthDocumentAnalysis>> {
    try {
      if (!this.genAI) {
        return {
          success: false,
          error: 'Gemini API not configured'
        };
      }
      
      const visionModel = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

      const prompt = `
        请仔细分析这份医疗文档，提取以下信息并以JSON格式返回。请确保信息准确，如果无法确定某些信息，请标注为null。

        返回格式：
        {
          "patientName": "患者姓名",
          "diagnosis": ["诊断结果数组"],
          "medications": [
            {
              "name": "药物名称",
              "dosage": "剂量",
              "frequency": "用药频率",
              "duration": "用药周期",
              "instructions": "特殊说明"
            }
          ],
          "doctorRecommendations": ["医生建议数组"],
          "followUpDate": "复查时间",
          "notes": ["其他注意事项"],
          "confidence": 0.95
        }

        重要提示：
        1. 只返回JSON格式，不要包含其他文字
        2. 如果信息不清楚或不存在，设为null
        3. confidence字段表示识别准确度(0-1)
        4. 药物信息要尽可能详细和准确
      `;

      const result = await visionModel.generateContent([
        prompt,
        { inlineData: { data: imageBase64, mimeType: "image/jpeg" } }
      ]);

      const response = result.response;
      const text = response.text();

      // Parse JSON response
      const analysisData = JSON.parse(text);

      // Validate and structure the response
      const analysis: HealthDocumentAnalysis = {
        patientName: analysisData.patientName || null,
        diagnosis: Array.isArray(analysisData.diagnosis) ? analysisData.diagnosis : [],
        medications: this.validateMedications(analysisData.medications || []),
        doctorRecommendations: Array.isArray(analysisData.doctorRecommendations) 
          ? analysisData.doctorRecommendations : [],
        followUpDate: analysisData.followUpDate || null,
        notes: Array.isArray(analysisData.notes) ? analysisData.notes : [],
        confidence: typeof analysisData.confidence === 'number' 
          ? Math.min(Math.max(analysisData.confidence, 0), 1) : 0.5,
      };

      return {
        success: true,
        data: analysis,
        message: 'AI分析完成'
      };

    } catch (error: any) {
      console.error('Gemini document analysis error:', error);
      
      let errorMessage = '文档分析失败';
      if (error.message?.includes('API key')) {
        errorMessage = 'AI服务配置错误';
      } else if (error.message?.includes('quota')) {
        errorMessage = 'AI服务配额不足';
      } else if (error.message?.includes('JSON')) {
        errorMessage = 'AI响应格式错误，请重试';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Generate personalized health tips based on user conditions and weather
   */
  async generateHealthTip(
    userConditions: string[], 
    weatherData: WeatherData,
    userAge?: number,
    allergies?: string[]
  ): Promise<ApiResponse<string>> {
    try {
      const prompt = `
        请根据以下信息生成一条个性化的健康建议：

        用户健康状况：${userConditions.join(', ')}
        ${userAge ? `年龄：${userAge}岁` : ''}
        ${allergies && allergies.length > 0 ? `过敏史：${allergies.join(', ')}` : ''}
        
        当前天气状况：
        - 温度：${weatherData.temperature}°C
        - 湿度：${weatherData.humidity}%
        - 天气：${weatherData.description}
        ${weatherData.uvIndex ? `- 紫外线指数：${weatherData.uvIndex}` : ''}
        ${weatherData.airQuality ? `- 空气质量：${weatherData.airQuality}` : ''}

        要求：
        1. 针对性强，考虑用户的具体健康状况
        2. 结合天气情况给出实用建议
        3. 语言温馨友好，不超过100字
        4. 如果是特殊天气（如高温、低温、高湿度等），重点提醒
        5. 考虑用户的过敏史，给出相应预防建议
        6. 直接返回建议内容，不要包含前缀文字

        示例格式：
        "今日温度偏低，有关节炎的您要注意保暖，建议穿着厚衣物并进行适量室内运动。湿度较高，请保持室内通风，避免关节僵硬。"
      `;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const healthTip = response.text().trim();

      // Validate response length
      if (healthTip.length > 150) {
        return {
          success: false,
          error: 'AI响应过长，请重试'
        };
      }

      return {
        success: true,
        data: healthTip,
        message: '健康建议生成成功'
      };

    } catch (error: any) {
      console.error('Gemini health tip generation error:', error);
      return {
        success: false,
        error: error.message || '生成健康建议失败'
      };
    }
  }

  /**
   * Generate medication reminder text
   */
  async generateMedicationReminder(
    medicationData: MedicationData,
    userName: string,
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
  ): Promise<ApiResponse<string>> {
    try {
      const timeMap = {
        morning: '早上',
        afternoon: '下午',
        evening: '晚上',
        night: '夜间'
      };

      const prompt = `
        请为用户生成一条温馨的用药提醒消息：

        用户姓名：${userName}
        药物信息：
        - 药物名称：${medicationData.name}
        - 剂量：${medicationData.dosage}
        - 用药说明：${medicationData.instructions || '按医嘱服用'}
        - 时间：${timeMap[timeOfDay]}

        要求：
        1. 语气温馨友好，像家人般关怀
        2. 包含具体的药物名称和剂量
        3. 如果有特殊说明，要重点提醒
        4. 不超过80字
        5. 直接返回提醒内容

        示例：
        "${userName}，${timeMap[timeOfDay]}好！该服用${medicationData.name}了，剂量${medicationData.dosage}。请记得${medicationData.instructions || '按时服药'}，关爱健康从每一次按时用药开始！"
      `;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const reminderText = response.text().trim();

      return {
        success: true,
        data: reminderText,
        message: '用药提醒生成成功'
      };

    } catch (error: any) {
      console.error('Gemini medication reminder generation error:', error);
      return {
        success: false,
        error: error.message || '生成用药提醒失败'
      };
    }
  }

  /**
   * Generate health advice based on health records
   */
  async generateHealthAdvice(prompt: string): Promise<ApiResponse<string>> {
    try {
      if (!this.genAI) {
        return {
          success: false,
          error: 'Gemini API not configured'
        };
      }

      console.log('正在调用Gemini API生成健康建议...');
      
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const advice = response.text().trim();

      console.log('Gemini API响应成功');

      return {
        success: true,
        data: advice,
        message: '健康建议生成成功'
      };

    } catch (error: any) {
      console.error('Gemini health advice generation error:', error);
      
      // 提供更友好的错误信息
      let errorMessage = '生成健康建议失败';
      if (error.message?.includes('404')) {
        errorMessage = 'Gemini模型不可用，请检查API配置';
      } else if (error.message?.includes('403')) {
        errorMessage = 'API密钥无权限访问Gemini服务';
      } else if (error.message?.includes('400')) {
        errorMessage = '请求格式错误';
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Analyze health trends and generate insights
   */
  async generateHealthInsights(healthRecords: HealthRecord[]): Promise<ApiResponse<string[]>> {
    try {
      // Anonymize health data for analysis
      const anonymizedData = healthRecords.map(record => ({
        type: record.recordType,
        data: record.recordData,
        verified: record.verified,
        createdAt: record.createdAt,
      }));

      const prompt = `
        请分析以下健康档案数据，生成有价值的健康洞察：

        健康档案数据（匿名）：
        ${JSON.stringify(anonymizedData, null, 2)}

        要求：
        1. 分析健康趋势和模式
        2. 识别潜在的健康风险或改善点
        3. 提供可行的健康建议
        4. 每条洞察不超过60字
        5. 返回3-5条最重要的洞察
        6. 以JSON数组格式返回，例如：["洞察1", "洞察2", "洞察3"]
        7. 不要暴露具体的个人信息

        重点关注：
        - 用药依从性
        - 健康数据的变化趋势
        - 多种疾病之间的关联
        - 预防保健建议
      `;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      // Parse JSON response
      const insights = JSON.parse(text);

      if (!Array.isArray(insights)) {
        return {
          success: false,
          error: 'AI响应格式错误'
        };
      }

      return {
        success: true,
        data: insights,
        message: '健康洞察生成成功'
      };

    } catch (error: any) {
      console.error('Gemini health insights generation error:', error);
      return {
        success: false,
        error: error.message || '生成健康洞察失败'
      };
    }
  }

  /**
   * Generate emergency health advice (for urgent situations)
   */
  async generateEmergencyAdvice(
    symptoms: string[],
    userAge?: number,
    existingConditions?: string[]
  ): Promise<ApiResponse<string>> {
    try {
      const prompt = `
        用户报告以下症状，请提供紧急健康建议：

        症状：${symptoms.join(', ')}
        ${userAge ? `年龄：${userAge}岁` : ''}
        ${existingConditions && existingConditions.length > 0 
          ? `已知疾病：${existingConditions.join(', ')}` : ''}

        重要要求：
        1. 如果症状严重，强烈建议立即就医
        2. 提供紧急处理建议
        3. 明确声明这不能替代专业医疗诊断
        4. 语言简洁明了，不超过150字
        5. 重点突出安全和及时就医的重要性

        注意：绝不能提供具体的医疗诊断或处方建议
      `;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const advice = response.text().trim();

      return {
        success: true,
        data: advice,
        message: '紧急健康建议生成成功'
      };

    } catch (error: any) {
      console.error('Gemini emergency advice generation error:', error);
      return {
        success: false,
        error: error.message || '生成紧急建议失败'
      };
    }
  }

  /**
   * Validate and extract medication information
   */
  private validateMedications(medications: any[]): MedicationData[] {
    if (!Array.isArray(medications)) return [];

    return medications.map(med => ({
      name: med.name || '',
      dosage: med.dosage || '',
      frequency: med.frequency || '',
      duration: med.duration || undefined,
      instructions: med.instructions || undefined,
      sideEffects: Array.isArray(med.sideEffects) ? med.sideEffects : undefined,
    })).filter(med => med.name && med.dosage);
  }

  /**
   * Get weather-based health recommendations
   */
  async getWeatherHealthRecommendations(
    weatherData: WeatherData,
    userConditions: string[] = []
  ): Promise<ApiResponse<string[]>> {
    try {
      const prompt = `
        根据当前天气状况和用户健康状况，生成相关的健康建议：

        天气状况：
        - 温度：${weatherData.temperature}°C
        - 湿度：${weatherData.humidity}%
        - 天气描述：${weatherData.description}
        ${weatherData.uvIndex ? `- 紫外线指数：${weatherData.uvIndex}` : ''}
        ${weatherData.windSpeed ? `- 风速：${weatherData.windSpeed} km/h` : ''}

        用户健康状况：${userConditions.length > 0 ? userConditions.join(', ') : '一般健康'}

        请生成3-5条针对性的健康建议，格式要求：
        1. 每条建议不超过50字
        2. 针对当前天气特点
        3. 考虑用户的健康状况
        4. 实用且可行
        5. 以JSON数组格式返回

        示例：["建议1", "建议2", "建议3"]
      `;

      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();

      const recommendations = JSON.parse(text);

      if (!Array.isArray(recommendations)) {
        return {
          success: false,
          error: 'AI响应格式错误'
        };
      }

      return {
        success: true,
        data: recommendations,
        message: '天气健康建议生成成功'
      };

    } catch (error: any) {
      console.error('Gemini weather health recommendations error:', error);
      return {
        success: false,
        error: error.message || '生成天气健康建议失败'
      };
    }
  }

  /**
   * Check if the service is available
   */
  async healthCheck(): Promise<ApiResponse<boolean>> {
    try {
      const testPrompt = "请回复'AI服务正常'";
      const result = await this.model.generateContent(testPrompt);
      const response = result.response.text();

      if (response.includes('AI服务正常') || response.includes('正常')) {
        return {
          success: true,
          data: true,
          message: 'Gemini AI服务正常'
        };
      }

      return {
        success: false,
        error: 'AI服务响应异常'
      };

    } catch (error: any) {
      console.error('Gemini health check error:', error);
      return {
        success: false,
        error: error.message || 'AI服务不可用'
      };
    }
  }
}

export default GeminiService.getInstance();