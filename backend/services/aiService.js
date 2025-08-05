const { GoogleGenerativeAI } = require('@google/generative-ai');

// 加载环境变量
require('dotenv').config();

// 配置Gemini API
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GEMINI_MODEL;

if (!API_KEY || !MODEL_NAME) {
    console.error('❌ Gemini API配置缺失，请检查.env文件中的GEMINI_API_KEY和GEMINI_MODEL');
    throw new Error('Gemini API配置缺失');
}

class AIService {
    constructor() {
        this.genAI = new GoogleGenerativeAI(API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: MODEL_NAME });
        console.log(`🤖 AI服务初始化完成，使用模型: ${MODEL_NAME}`);
    }

    /**
     * 为健康笔记生成AI建议（完全依赖AI获取真实天气）
     * @param {Object} noteData - 笔记数据
     * @param {Object} userLocation - 用户位置信息
     * @returns {Promise<string>} AI建议内容
     */
    async generateHealthSuggestions(noteData, userLocation = null) {
        try {
            const { title, description, precautions } = noteData;

            console.log('🤖 让AI获取用户真实位置的天气数据并生成建议');
            console.log('📍 用户位置信息:', userLocation);

            const prompt = this.buildRealWeatherPrompt(title, description, precautions, userLocation);

            console.log('🔄 正在生成AI建议（AI自获取真实天气）...');
            console.log('📄 提示词长度:', prompt.length);

            // 调用Gemini API
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            console.log('✅ AI建议生成成功');
            console.log('📝 生成内容长度:', text.length);
            console.log('📝 生成内容预览:', text.substring(0, 200) + '...');

            return text;

        } catch (error) {
            console.error('❌ 生成AI建议失败:', error);

            // 根据错误类型返回不同的错误信息
            if (error.message.includes('API_KEY')) {
                throw new Error('AI服务配置错误，请检查API密钥');
            } else if (error.message.includes('quota')) {
                throw new Error('AI服务配额不足，请稍后再试');
            } else if (error.message.includes('network') || error.message.includes('fetch')) {
                throw new Error('网络连接错误，请检查网络连接');
            } else {
                throw new Error('AI服务暂时不可用，请稍后再试');
            }
        }
    }

    /**
     * 构建让AI获取真实天气的提示词
     * @param {string} title - 标题
     * @param {string} description - 描述  
     * @param {string} precautions - 注意事项
     * @param {Object} userLocation - 用户位置信息
     * @returns {string} 构建的提示词
     */
    buildRealWeatherPrompt(title, description, precautions, userLocation = null) {
        // 获取当前日期
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();

        // 构建位置信息
        let locationInfo = '';
        if (userLocation) {
            if (userLocation.latitude && userLocation.longitude) {
                locationInfo = `用户当前精确位置：纬度${userLocation.latitude}，经度${userLocation.longitude}`;
                if (userLocation.city) {
                    locationInfo += `（${userLocation.city}）`;
                }
            } else if (userLocation.city) {
                locationInfo = `用户当前城市：${userLocation.city}`;
            } else if (typeof userLocation === 'string') {
                locationInfo = `用户位置：${userLocation}`;
            }
        }

        let prompt = `【严格要求】你必须获取用户实际位置的实时天气数据来生成健康建议

【用户健康信息】
健康状况：${title}`;

        if (description) {
            prompt += `\n详细描述：${description}`;
        }

        if (precautions) {
            prompt += `\n医嘱/注意事项：${precautions}`;
        }

        prompt += `

【今日日期】${month}月${day}日
${locationInfo ? `【用户位置】${locationInfo}` : '【位置要求】请获取用户当前实际位置'}

【关键任务】
1. 必须使用上面提供的用户位置坐标获取今日实时天气数据（温度、湿度、天气状况、风力等）
2. 你可以使用Open-Meteo API或其他天气服务来获取准确的天气数据
3. 如果无法获取天气数据，请明确说明"无法获取天气数据"，不要编造虚假信息
4. 必须以真实的天气数据开头，格式："今天[具体城市名]的天气是[实际天气状况]，温度[实际温度]，湿度[实际湿度]，风力[实际风力]"
5. 基于真实天气数据分析对用户健康状况的影响
6. 给出针对性的实用建议

【绝对禁止】
- 不能使用虚假或编造的天气数据
- 不能说"天气信息暂不可用"然后继续给建议
- 不能使用模糊的天气描述
- 如果获取不到天气数据，必须明确说明失败原因

【建议重点】
- 关节疾病：温湿度变化、保暖防潮措施
- 外伤骨折：防水保护、活动限制、环境安全  
- 心理疾病：天气对情绪影响、室内活动建议
- 呼吸疾病：空气质量、温差变化

【输出要求】
- 必须以实际天气数据开头
- 语言自然流畅，中文回答
- 建议具体可操作
- 如果无法获取天气，直接说明原因

请现在获取实时天气数据并生成建议：`;

        return prompt;
    }

    /**
     * 测试AI服务连接
     * @returns {Promise<boolean>} 连接是否成功
     */
    async testConnection() {
        try {
            const result = await this.model.generateContent('测试连接，请回复"连接成功"');
            const response = await result.response;
            const text = response.text();

            console.log('🧪 AI服务连接测试成功:', text);
            return true;
        } catch (error) {
            console.error('❌ AI服务连接测试失败:', error);
            return false;
        }
    }
}

// 创建单例实例
const aiService = new AIService();

module.exports = aiService;