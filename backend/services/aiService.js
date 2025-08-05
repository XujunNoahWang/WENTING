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
     * 为健康笔记生成AI建议（使用真实天气数据）
     * @param {Object} noteData - 笔记数据
     * @param {Object} weatherData - 真实天气数据
     * @param {Object} userLocation - 用户位置信息
     * @returns {Promise<string>} AI建议内容
     */
    async generateHealthSuggestions(noteData, weatherData = null, userLocation = null) {
        try {
            const { title, description, precautions } = noteData;

            console.log('🤖 使用真实天气数据生成AI健康建议');
            console.log('🌤️ 天气数据:', weatherData);
            console.log('📍 用户位置信息:', userLocation);

            const prompt = this.buildWeatherBasedPrompt(title, description, precautions, weatherData, userLocation);

            console.log('🔄 正在生成AI建议（使用真实天气数据）...');
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
     * 构建基于真实天气数据的提示词
     * @param {string} title - 标题
     * @param {string} description - 描述  
     * @param {string} precautions - 注意事项
     * @param {Object} weatherData - 真实天气数据
     * @param {Object} userLocation - 用户位置信息
     * @returns {string} 构建的提示词
     */
    buildWeatherBasedPrompt(title, description, precautions, weatherData, userLocation = null) {
        // 获取完整的日期和时间信息
        const now = new Date();
        const dateInfo = this.buildDetailedDateInfo(now);
        
        // 构建详细的位置信息
        const locationInfo = this.buildDetailedLocationInfo(userLocation);

        console.log('📅 构建的日期信息:', dateInfo);
        console.log('📍 构建的位置信息:', locationInfo);
        console.log('🌤️ 使用的天气数据:', weatherData);

        // 构建优化的提示词
        let prompt = `【健康建议生成任务】基于真实天气数据的个性化健康建议

【用户健康信息】
健康状况：${title}`;

        if (description) {
            prompt += `\n详细描述：${description}`;
        }

        if (precautions) {
            prompt += `\n医嘱/注意事项：${precautions}`;
        }

        // 添加详细的时间信息
        prompt += `

【当前时间信息】
完整日期：${dateInfo.dateWithWeekday}
当前季节：${dateInfo.season}
时间段：${dateInfo.timeOfDay}`;

        // 添加详细的位置信息
        if (locationInfo.hasLocation) {
            prompt += `

【用户位置信息】
具体位置：${locationInfo.formattedLocation}`;
            
            if (locationInfo.climate) {
                prompt += `\n气候特征：${locationInfo.climate}`;
            }
        }

        // 添加真实天气数据
        if (weatherData && !weatherData.isError) {
            prompt += `

【实时天气数据】
位置：${weatherData.location || '当前位置'}
天气状况：${weatherData.condition}
温度：${weatherData.temperature}
湿度：${weatherData.humidity.value}
风力：${weatherData.wind.level}
数据更新时间：${weatherData.lastUpdated ? new Date(weatherData.lastUpdated).toLocaleString('zh-CN') : '刚刚'}`;
        } else {
            prompt += `

【天气信息】
抱歉，当前无法获取准确的天气数据。请基于${locationInfo.climate || '当地气候'}和${dateInfo.season}季节特点给出通用建议。`;
        }

        prompt += `

【个性化分析要求】
1. 🎯 **天气影响分析**
   - 结合当前天气状况分析对健康的具体影响
   - 考虑${dateInfo.season}季节和${dateInfo.timeOfDay}时段特点
   - 基于${locationInfo.climate || '当地气候'}特征评估风险

2. 📊 **疾病特定关注点**`;

        // 根据疾病类型添加特定关注点
        if (title.includes('关节') || title.includes('骨折') || title.includes('风湿')) {
            prompt += `
   - 关节疾病重点：温湿度变化、气压影响、保暖防潮措施`;
        }
        if (title.includes('呼吸') || title.includes('咳嗽') || title.includes('哮喘')) {
            prompt += `
   - 呼吸疾病重点：空气质量、温差变化、湿度影响`;
        }
        if (title.includes('心血管') || title.includes('高血压') || title.includes('心脏')) {
            prompt += `
   - 心血管疾病重点：气压变化、温度波动、运动建议`;
        }
        if (title.includes('皮肤') || title.includes('湿疹') || title.includes('过敏')) {
            prompt += `
   - 皮肤疾病重点：湿度影响、紫外线防护、${dateInfo.season}季护理`;
        }

        prompt += `

【健康建议格式】
请按以下格式提供3-5个具体可行的建议：

🌡️ **天气适应建议**
- 根据当前${weatherData?.temperature || '温度'}和${weatherData?.condition || '天气状况'}的具体建议

💧 **湿度风力应对**
- 针对${weatherData?.humidity?.value || '当前湿度'}和${weatherData?.wind?.level || '风力条件'}的措施

🏠 **日常生活调整**
- 结合${dateInfo.timeOfDay}时段和健康状况的生活建议

⚠️ **特别注意事项**
- 基于病情和天气的重要提醒

📋 **监测要点**
- 需要特别关注的身体指标和症状变化

【输出要求】
✅ 语言自然专业，易于理解
✅ 建议具体可行，有实际指导意义
✅ 充分结合天气数据和健康状况
✅ 避免过于宽泛的通用建议

请立即生成个性化健康建议：`;

        return prompt;
    },

    /**
     * 构建让AI获取真实天气的提示词（备用方法）
     * @param {string} title - 标题
     * @param {string} description - 描述  
     * @param {string} precautions - 注意事项
     * @param {Object} userLocation - 用户位置信息
     * @returns {string} 构建的提示词
     */
    buildRealWeatherPrompt(title, description, precautions, userLocation = null) {
        // 获取完整的日期和时间信息
        const now = new Date();
        const dateInfo = this.buildDetailedDateInfo(now);
        
        // 构建详细的位置信息
        const locationInfo = this.buildDetailedLocationInfo(userLocation);

        console.log('📅 构建的日期信息:', dateInfo);
        console.log('📍 构建的位置信息:', locationInfo);

        // 构建优化的提示词
        let prompt = `【健康建议生成任务】基于用户真实位置和时间的个性化健康建议

【用户健康信息】
健康状况：${title}`;

        if (description) {
            prompt += `\n详细描述：${description}`;
        }

        if (precautions) {
            prompt += `\n医嘱/注意事项：${precautions}`;
        }

        // 添加详细的时间信息
        prompt += `

【当前时间信息】
完整日期：${dateInfo.dateWithWeekday}
当前季节：${dateInfo.season}
时间段：${dateInfo.timeOfDay}`;

        // 添加详细的位置信息
        if (locationInfo.hasLocation) {
            prompt += `

【用户位置信息】
具体位置：${locationInfo.formattedLocation}`;
            
            if (locationInfo.climate) {
                prompt += `\n气候特征：${locationInfo.climate}`;
            }
            
            if (locationInfo.coordinates) {
                prompt += `\n精确坐标：纬度${locationInfo.coordinates.latitude}°，经度${locationInfo.coordinates.longitude}°`;
            }
        } else {
            prompt += `

【位置信息】${locationInfo.message}`;
        }

        prompt += `

【核心任务要求】
1. 🌤️ **获取实时天气数据**
   - 使用上述精确位置坐标获取当前实时天气
   - 包含：温度、湿度、天气状况、风力、气压、能见度等
   - 可使用Open-Meteo API或其他可靠天气服务

2. 📊 **天气数据格式要求**
   - 必须以此格式开头："【${dateInfo.fullDate} ${locationInfo.city || '当前位置'}天气实况】"
   - 然后详细列出：温度XX°C，湿度XX%，天气状况XXX，风力X级，等等

3. 🎯 **个性化分析要求**
   - 结合${dateInfo.season}季节特点分析天气影响
   - 考虑${dateInfo.timeOfDay}时段的特殊需求
   - 基于${locationInfo.climate || '当地气候'}特征给出建议

【健康建议重点】（根据疾病类型重点关注）
- 关节疾病：温湿度变化、气压变化、${dateInfo.season}季保暖防潮
- 外伤骨折：防水保护、活动限制、${dateInfo.timeOfDay}环境安全
- 心理疾病：天气对情绪影响、${dateInfo.season}季节性情绪调节
- 呼吸疾病：空气质量、温差变化、湿度影响
- 心血管疾病：气压变化、温度波动影响
- 皮肤疾病：湿度、紫外线、${dateInfo.season}季护理

【严格禁止】
❌ 编造虚假天气数据
❌ 使用模糊表述如"天气适宜"
❌ 忽略位置和时间信息
❌ 给出不具体的建议

【输出格式要求】
✅ 必须以实时天气数据开头
✅ 分点列出3-5个具体可行的建议
✅ 结合季节、时段、位置特点
✅ 语言自然流畅，专业但易懂
✅ 如无法获取天气数据，明确说明原因

请立即获取实时天气数据并生成个性化健康建议：`;

        return prompt;
    }

    /**
     * 构建详细的日期信息
     * @param {Date} date - 日期对象
     * @returns {Object} 详细的日期信息
     */
    buildDetailedDateInfo(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hour = date.getHours();
        
        // 获取星期
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
        const weekday = weekdays[date.getDay()];
        
        // 获取季节
        const season = this.getSeason(month);
        
        // 获取时段
        const timeOfDay = this.getTimeOfDay(hour);
        
        return {
            year,
            month,
            day,
            weekday,
            season,
            timeOfDay,
            fullDate: `${year}年${month}月${day}日`,
            dateWithWeekday: `${year}年${month}月${day}日 ${weekday}`
        };
    }

    /**
     * 构建详细的位置信息
     * @param {Object} userLocation - 用户位置信息
     * @returns {Object} 详细的位置信息
     */
    buildDetailedLocationInfo(userLocation) {
        if (!userLocation) {
            return {
                hasLocation: false,
                message: '未提供位置信息'
            };
        }

        const info = {
            hasLocation: true,
            coordinates: null,
            city: null,
            formattedLocation: '',
            climate: null
        };

        // 处理坐标信息
        if (userLocation.latitude && userLocation.longitude) {
            info.coordinates = {
                latitude: parseFloat(userLocation.latitude).toFixed(4),
                longitude: parseFloat(userLocation.longitude).toFixed(4)
            };
            
            // 推断气候区域
            info.climate = this.inferClimateZone(userLocation.latitude, userLocation.longitude);
        }

        // 处理城市信息
        if (userLocation.city) {
            info.city = userLocation.city;
        } else if (typeof userLocation === 'string') {
            info.city = userLocation;
        }

        // 构建格式化的位置描述
        if (info.coordinates && info.city) {
            info.formattedLocation = `${info.city}（纬度${info.coordinates.latitude}°，经度${info.coordinates.longitude}°）`;
        } else if (info.coordinates) {
            info.formattedLocation = `纬度${info.coordinates.latitude}°，经度${info.coordinates.longitude}°`;
        } else if (info.city) {
            info.formattedLocation = info.city;
        }

        return info;
    }

    /**
     * 根据月份获取季节
     * @param {number} month - 月份 (1-12)
     * @returns {string} 季节
     */
    getSeason(month) {
        if (month >= 3 && month <= 5) return '春季';
        if (month >= 6 && month <= 8) return '夏季';
        if (month >= 9 && month <= 11) return '秋季';
        return '冬季';
    }

    /**
     * 根据小时获取时段
     * @param {number} hour - 小时 (0-23)
     * @returns {string} 时段
     */
    getTimeOfDay(hour) {
        if (hour >= 6 && hour < 9) return '早晨';
        if (hour >= 9 && hour < 12) return '上午';
        if (hour >= 12 && hour < 14) return '中午';
        if (hour >= 14 && hour < 18) return '下午';
        if (hour >= 18 && hour < 22) return '晚上';
        return '深夜';
    }

    /**
     * 根据经纬度推断气候区域
     * @param {number} lat - 纬度
     * @param {number} lon - 经度
     * @returns {string} 气候特征
     */
    inferClimateZone(lat, lon) {
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lon);
        
        // 简单的气候区域推断
        if (Math.abs(latitude) <= 23.5) {
            return '热带气候';
        } else if (Math.abs(latitude) <= 40) {
            return '亚热带气候';
        } else if (Math.abs(latitude) <= 60) {
            return '温带气候';
        } else {
            return '寒带气候';
        }
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