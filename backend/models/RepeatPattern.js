const { query } = require('../config/database');

class RepeatPattern {
    constructor(data) {
        this.id = data.id;
        this.pattern_type = data.pattern_type;
        this.interval_value = data.interval_value;
        this.days_of_week = data.days_of_week;
        this.days_of_month = data.days_of_month;
        this.end_type = data.end_type;
        this.end_after_count = data.end_after_count;
        this.end_date = data.end_date;
        this.created_at = data.created_at;
    }

    // 创建新的重复模式
    static async create(patternData) {
        try {
            const {
                pattern_type,
                interval_value = 1,
                days_of_week = null,
                days_of_month = null,
                end_type = 'never',
                end_after_count = null,
                end_date = null
            } = patternData;

            const sql = `
                INSERT INTO repeat_patterns (pattern_type, interval_value, days_of_week, days_of_month, end_type, end_after_count, end_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            const result = await query(sql, [
                pattern_type,
                interval_value,
                days_of_week ? JSON.stringify(days_of_week) : null,
                days_of_month ? JSON.stringify(days_of_month) : null,
                end_type,
                end_after_count,
                end_date
            ]);

            return await RepeatPattern.findById(result.insertId);
        } catch (error) {
            console.error('创建重复模式失败:', error);
            throw error;
        }
    }

    // 根据ID查找重复模式
    static async findById(id) {
        const sql = 'SELECT * FROM repeat_patterns WHERE id = ?';
        const patterns = await query(sql, [id]);
        if (patterns.length > 0) {
            const pattern = patterns[0];
            // 解析JSON字段
            if (pattern.days_of_week) {
                pattern.days_of_week = JSON.parse(pattern.days_of_week);
            }
            if (pattern.days_of_month) {
                pattern.days_of_month = JSON.parse(pattern.days_of_month);
            }
            return new RepeatPattern(pattern);
        }
        return null;
    }

    // 获取所有重复模式
    static async findAll() {
        const sql = 'SELECT * FROM repeat_patterns ORDER BY created_at DESC';
        const patterns = await query(sql);
        return patterns.map(pattern => {
            // 解析JSON字段
            if (pattern.days_of_week) {
                pattern.days_of_week = JSON.parse(pattern.days_of_week);
            }
            if (pattern.days_of_month) {
                pattern.days_of_month = JSON.parse(pattern.days_of_month);
            }
            return new RepeatPattern(pattern);
        });
    }

    // 获取预定义的重复模式
    static async getPresetPatterns() {
        const presets = [
            {
                name: '不重复',
                pattern_type: 'none',
                interval_value: 1,
                description: '仅执行一次'
            },
            {
                name: '每天',
                pattern_type: 'daily',
                interval_value: 1,
                description: '每天重复'
            },
            {
                name: '每2天',
                pattern_type: 'daily',
                interval_value: 2,
                description: '每隔一天重复'
            },
            {
                name: '每周',
                pattern_type: 'weekly',
                interval_value: 1,
                description: '每周重复'
            },
            {
                name: '工作日',
                pattern_type: 'weekly',
                interval_value: 1,
                days_of_week: [1, 2, 3, 4, 5], // 周一到周五
                description: '仅在工作日重复'
            },
            {
                name: '周末',
                pattern_type: 'weekly',
                interval_value: 1,
                days_of_week: [0, 6], // 周日和周六
                description: '仅在周末重复'
            },
            {
                name: '每月',
                pattern_type: 'monthly',
                interval_value: 1,
                description: '每月重复'
            }
        ];

        return presets;
    }

    // 创建预设的重复模式
    static async createPresetPattern(presetName) {
        const presets = await RepeatPattern.getPresetPatterns();
        const preset = presets.find(p => p.name === presetName);
        
        if (!preset) {
            throw new Error('未找到指定的预设模式');
        }

        return await RepeatPattern.create(preset);
    }

    // 检查日期是否匹配重复模式
    static isDateMatch(pattern, targetDate, startDate) {
        const target = new Date(targetDate);
        const start = new Date(startDate);
        
        // 如果目标日期早于开始日期，不匹配
        if (target < start) {
            return false;
        }

        // 检查结束条件
        if (pattern.end_type === 'on_date' && pattern.end_date) {
            if (target > new Date(pattern.end_date)) {
                return false;
            }
        }

        switch (pattern.pattern_type) {
            case 'none':
                return target.toDateString() === start.toDateString();
                
            case 'daily':
                const daysDiff = Math.floor((target - start) / (1000 * 60 * 60 * 24));
                return daysDiff >= 0 && daysDiff % pattern.interval_value === 0;
                
            case 'weekly':
                const weeksDiff = Math.floor((target - start) / (1000 * 60 * 60 * 24 * 7));
                if (weeksDiff % pattern.interval_value !== 0) {
                    return false;
                }
                
                if (pattern.days_of_week && pattern.days_of_week.length > 0) {
                    const dayOfWeek = target.getDay();
                    return pattern.days_of_week.includes(dayOfWeek);
                }
                return target.getDay() === start.getDay();
                
            case 'monthly':
                const targetMonth = target.getFullYear() * 12 + target.getMonth();
                const startMonth = start.getFullYear() * 12 + start.getMonth();
                const monthsDiff = targetMonth - startMonth;
                
                if (monthsDiff < 0 || monthsDiff % pattern.interval_value !== 0) {
                    return false;
                }
                
                if (pattern.days_of_month && pattern.days_of_month.length > 0) {
                    return pattern.days_of_month.includes(target.getDate());
                }
                return target.getDate() === start.getDate();
                
            default:
                return false;
        }
    }

    // 获取下一个匹配的日期
    static getNextMatchDate(pattern, currentDate, startDate) {
        const current = new Date(currentDate);
        const start = new Date(startDate);
        
        // 从明天开始寻找
        let nextDate = new Date(current);
        nextDate.setDate(nextDate.getDate() + 1);
        
        // 最多检查365天
        for (let i = 0; i < 365; i++) {
            if (RepeatPattern.isDateMatch(pattern, nextDate, start)) {
                return nextDate.toISOString().split('T')[0];
            }
            nextDate.setDate(nextDate.getDate() + 1);
        }
        
        return null;
    }

    // 获取指定时间范围内的所有匹配日期
    static getMatchDatesInRange(pattern, startDate, rangeStart, rangeEnd) {
        const dates = [];
        const start = new Date(startDate);
        const rangeStartDate = new Date(rangeStart);
        const rangeEndDate = new Date(rangeEnd);
        
        let currentDate = new Date(Math.max(start, rangeStartDate));
        
        while (currentDate <= rangeEndDate) {
            if (RepeatPattern.isDateMatch(pattern, currentDate, start)) {
                dates.push(currentDate.toISOString().split('T')[0]);
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return dates;
    }

    // 验证重复模式数据
    static validatePatternData(patternData) {
        const errors = [];

        if (!patternData.pattern_type) {
            errors.push('重复类型不能为空');
        }

        if (!['none', 'daily', 'weekly', 'monthly', 'custom'].includes(patternData.pattern_type)) {
            errors.push('重复类型不正确');
        }

        if (patternData.interval_value && (patternData.interval_value < 1 || patternData.interval_value > 365)) {
            errors.push('间隔值必须在1-365之间');
        }

        if (patternData.days_of_week && !Array.isArray(patternData.days_of_week)) {
            errors.push('周几必须是数组格式');
        }

        if (patternData.days_of_week) {
            for (const day of patternData.days_of_week) {
                if (day < 0 || day > 6) {
                    errors.push('周几的值必须在0-6之间');
                    break;
                }
            }
        }

        if (patternData.days_of_month && !Array.isArray(patternData.days_of_month)) {
            errors.push('每月第几天必须是数组格式');
        }

        if (patternData.days_of_month) {
            for (const day of patternData.days_of_month) {
                if (day < 1 || day > 31) {
                    errors.push('每月第几天的值必须在1-31之间');
                    break;
                }
            }
        }

        if (patternData.end_type && !['never', 'after', 'on_date'].includes(patternData.end_type)) {
            errors.push('结束类型不正确');
        }

        if (patternData.end_type === 'after' && (!patternData.end_after_count || patternData.end_after_count < 1)) {
            errors.push('结束次数必须大于0');
        }

        if (patternData.end_type === 'on_date' && !patternData.end_date) {
            errors.push('结束日期不能为空');
        }

        if (patternData.end_date && new Date(patternData.end_date) <= new Date()) {
            errors.push('结束日期必须是未来日期');
        }

        return errors;
    }

    // 转换为JSON对象
    toJSON() {
        return {
            id: this.id,
            pattern_type: this.pattern_type,
            interval_value: this.interval_value,
            days_of_week: this.days_of_week,
            days_of_month: this.days_of_month,
            end_type: this.end_type,
            end_after_count: this.end_after_count,
            end_date: this.end_date,
            created_at: this.created_at
        };
    }
}

module.exports = RepeatPattern;