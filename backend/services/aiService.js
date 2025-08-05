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
     * 为健康笔记生成AI建议（让AI自己获取天气）
     * @param {Object} noteData - 笔记数据
     * @param {Object} weatherData - 天气数据（备用）
     * @returns {Promise<string>} AI建议内容
     */
    async generateHealthSuggestions(noteData, weatherData = null) {
        try {
            const { title, description, precautions } = noteData;

            console.log('🤖 让AI自己获取天气数据并生成今日建议');
            
            // 尝试两种方案：先让AI自己获取天气，如果失败则使用我们的数据
            let prompt = this.buildHealthPromptWithAIWeather(title, description, precautions);
            
            console.log('🔄 正在生成AI今日建议（AI自获取天气）...');
            console.log('📄 提示词长度:', prompt.length);

            // 调用Gemini API
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            console.log('✅ AI今日建议生成成功');
            console.log('📝 生成内容长度:', text.length);
            console.log('📝 生成内容预览:', text.substring(0, 200) + '...');

            // 检查AI是否成功获取了天气信息
            if (text.includes('无法获取天气') || text.includes('天气信息不可用')) {
                console.log('🔄 AI无法获取天气，使用备用方案...');
                const backupPrompt = this.buildHealthPromptWithProvidedWeather(title, description, precautions, weatherData);
                const backupResult = await this.model.generateContent(backupPrompt);
                const backupResponse = await backupResult.response;
                return backupResponse.text();
            }

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
     * 构建让AI自己获取天气的提示词
     * @param {string} title - 标题
     * @param {string} description - 描述  
     * @param {string} precautions - 注意事项
     * @returns {string} 构建的提示词
     */
    buildHealthPromptWithAIWeather(title, description, precautions) {
        // 获取当前日期
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();

        let prompt = `【重要任务】请为用户生成今日健康建议

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

【任务要求】
1. 请先获取上海市今天的实时天气信息（温度、湿度、天气状况、风力等）
2. 以具体的天气数据开头，格式如："今天上海的天气是晴朗，温度25°C，湿度60%，风力3级"
3. 然后分析这种天气对用户健康状况的具体影响
4. 最后给出针对性的实用建议

【建议重点】
- 关节疾病：重点关注温湿度变化、空调环境、保暖防潮措施
- 外伤骨折：重点关注防水保护、活动限制、环境安全  
- 心理疾病：重点关注天气对情绪的影响、室内活动建议
- 呼吸疾病：重点关注空气质量、温差变化、人群密集度

【格式要求】
- 直接给出建议内容，无需标题
- 语言自然流畅，中文回答
- 建议要具体可操作

请现在获取天气信息并生成建议：`;

        return prompt;
    }

    /**
     * 构建使用提供天气数据的提示词（备用方案）
     * @param {string} title - 标题
     * @param {string} description - 描述  
     * @param {string} precautions - 注意事项
     * @param {Object} weatherData - 天气数据
     * @returns {string} 构建的提示词
     */
    buildHealthPromptWithProvidedWeather(title, description, precautions, weatherData) {
        // 获取当前日期
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();

        // 格式化天气信息
        let weatherInfo = '天气数据不可用';
        if (weatherData) {
            weatherInfo = `今天${weatherData.location}的天气是${weatherData.condition}，温度${weatherData.temperature}，湿度${weatherData.humidity?.value}，风力${weatherData.wind?.level}`;
        }

        let prompt = `【备用方案】使用提供的天气数据生成建议

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
【天气信息】${weatherInfo}

【任务要求】
1. 必须以上面的天气信息开头
2. 分析这种天气对用户健康状况的影响
3. 给出具体的应对建议

【建议重点】
- 关节疾病：温湿度变化、保暖措施
- 外伤骨折：防水保护、活动限制
- 心理疾病：天气对情绪影响
- 呼吸疾病：空气质量、温差变化

请生成建议：`;

        return prompt;
    }

    /**
     * 原有的构建方法（保留兼容性）
     */
    buildHealthPrompt(title, description, precautions, weatherData) {
        return this.buildHealthPromptWithProvidedWeather(title, description, precautions, weatherData);
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