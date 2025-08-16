// TODO模型 - 完全重写版本
const { query } = require('../config/sqlite');

class Todo {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.title = data.title;
        this.description = data.description || '';
        this.reminder_time = data.reminder_time || 'all_day';
        this.priority = data.priority || 'medium';
        this.repeat_type = data.repeat_type || 'none';
        this.repeat_interval = data.repeat_interval || 1;
        this.start_date = data.start_date;
        this.end_date = data.end_date || null;
        this.cycle_type = data.cycle_type || 'long_term';
        this.cycle_duration = data.cycle_duration || null;
        this.cycle_unit = data.cycle_unit || 'days';
        this.is_active = data.is_active !== false;
        this.sort_order = data.sort_order || 0;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    // 创建新TODO
    static async create(todoData) {
        try {
            const {
                user_id,
                title,
                description = '',
                reminder_time = 'all_day',
                priority = 'medium',
                repeat_type = 'none',
                repeat_interval = 1,
                start_date = new Date().toISOString().split('T')[0],
                cycle_type = 'long_term',
                cycle_duration = null,
                cycle_unit = 'days'
            } = todoData;

            console.log('📥 后端接收的TODO数据:', todoData);
            console.log('📋 重复周期数据调试:');
            console.log('  cycle_type:', cycle_type);
            console.log('  cycle_duration:', cycle_duration);
            console.log('  cycle_unit:', cycle_unit);

            // 验证数据
            const validationErrors = Todo.validateTodoData(todoData);
            if (validationErrors.length > 0) {
                throw new Error('数据验证失败: ' + validationErrors.join(', '));
            }

            const sql = `
                INSERT INTO todos (user_id, title, description, reminder_time, priority, repeat_type, repeat_interval, start_date, cycle_type, cycle_duration, cycle_unit)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const result = await query(sql, [
                user_id, title, description, reminder_time, priority, repeat_type, repeat_interval, start_date, cycle_type, cycle_duration, cycle_unit
            ]);

            // 获取新创建的TODO
            const newTodo = await Todo.findById(result.insertId);
            console.log('✅ TODO创建成功:', newTodo.title);
            return newTodo;
        } catch (error) {
            console.error('创建TODO失败:', error);
            throw error;
        }
    }

    // 根据ID查找TODO
    static async findById(id) {
        const sql = 'SELECT * FROM todos WHERE id = ? AND is_active = 1';
        const todos = await query(sql, [id]);
        return todos.length > 0 ? new Todo(todos[0]) : null;
    }

    // 获取用户的所有活跃TODO
    static async findByUserId(userId) {
        const sql = 'SELECT * FROM todos WHERE user_id = ? AND is_active = 1 ORDER BY sort_order ASC, created_at ASC';
        const todos = await query(sql, [userId]);
        return todos.map(todo => new Todo(todo));
    }

    // 获取用户指定日期的TODO（考虑重复规则）- 性能优化版本
    static async findByUserIdAndDate(userId, targetDate) {
        const startTime = Date.now();
        try {
            console.log(`🔍 [性能优化] 获取用户${userId}在${targetDate}的TODO...`);
            const targetDateStr = new Date(targetDate).toISOString().split('T')[0];
            
            // 第一步：快速查询基础TODO数据（简化查询）
            const basicSql = `
                SELECT t.*, 
                       tc.completion_date IS NOT NULL as is_completed_today,
                       td.deletion_type
                FROM todos t
                LEFT JOIN todo_completions tc ON t.id = tc.todo_id AND tc.completion_date = ?
                LEFT JOIN todo_deletions td ON t.id = td.todo_id AND td.deletion_date = ?
                WHERE t.user_id = ? 
                    AND t.is_active = 1
                    AND t.start_date <= ?
                    AND (t.end_date IS NULL OR t.end_date >= ?)
                ORDER BY t.sort_order ASC, t.created_at ASC
                LIMIT 500
            `;
            
            const allTodos = await query(basicSql, [targetDateStr, targetDateStr, userId, targetDateStr, targetDateStr]);
            const queryTime = Date.now() - startTime;
            console.log(`📊 [${queryTime}ms] 数据库返回${allTodos.length}条TODO记录`);
            
            if (allTodos.length === 0) {
                console.log(`✅ [${Date.now() - startTime}ms] 用户${userId}在${targetDateStr}没有TODO`);
                return [];
            }
            
            const todosForDate = [];
            const filterStartTime = Date.now();
            
            // 使用同步的重复规则判断（避免async/await的性能损耗）
            for (const todoData of allTodos) {
                // 如果有删除记录，跳过
                if (todoData.deletion_type) {
                    continue;
                }
                
                const todo = new Todo(todoData);
                
                // 使用优化的同步重复规则判断
                if (Todo.shouldShowOnDateSync(todo, targetDate)) {
                    todo.is_completed_today = Boolean(todoData.is_completed_today);
                    todosForDate.push(todo);
                }
            }
            
            const filterTime = Date.now() - filterStartTime;
            const totalTime = Date.now() - startTime;
            
            console.log(`✅ [查询:${queryTime}ms 过滤:${filterTime}ms 总计:${totalTime}ms] 返回${todosForDate.length}条TODO`);
            
            // 按时间排序
            return Todo.sortByTime(todosForDate);
        } catch (error) {
            const totalTime = Date.now() - startTime;
            console.error(`❌ [${totalTime}ms] 获取用户日期TODO失败:`, error);
            throw error;
        }
    }

    // 判断TODO是否应该在指定日期显示（同步版本 - 最高性能）
    static shouldShowOnDateSync(todo, targetDate) {
        const dateContext = this._createDateContext(todo, targetDate);
        
        if (!this._isTargetDateValid(dateContext)) {
            return false;
        }

        if (!this._isWithinEndDateRange(todo, dateContext)) {
            return false;
        }

        if (!this._isWithinCycleRange(todo, dateContext)) {
            return false;
        }

        return this._checkRepeatPattern(todo, dateContext);
    }

    // 创建日期上下文
    static _createDateContext(todo, targetDate) {
        const startDate = new Date(todo.start_date);
        const target = new Date(targetDate);
        const daysDiff = Math.floor((target - startDate) / (1000 * 60 * 60 * 24));
        
        return { startDate, target, daysDiff };
    }

    // 检查目标日期是否有效
    static _isTargetDateValid(dateContext) {
        return dateContext.target >= dateContext.startDate;
    }

    // 检查是否在结束日期范围内
    static _isWithinEndDateRange(todo, dateContext) {
        if (!todo.end_date) return true;
        
        const endDate = new Date(todo.end_date);
        return dateContext.target <= endDate;
    }

    // 检查是否在周期范围内
    static _isWithinCycleRange(todo, dateContext) {
        if (todo.cycle_type !== 'custom' || !todo.cycle_duration) {
            return true;
        }
        
        const cycleEndDate = Todo.calculateCycleEndDate(
            dateContext.startDate, 
            todo.cycle_duration, 
            todo.cycle_unit
        );
        return dateContext.target <= cycleEndDate;
    }

    // 检查重复模式
    static _checkRepeatPattern(todo, dateContext) {
        const { target, startDate, daysDiff } = dateContext;
        
        switch (todo.repeat_type) {
            case 'none':
                return daysDiff === 0;
            case 'daily':
                return true;
            case 'every_other_day':
                return daysDiff % 2 === 0;
            case 'weekly':
                return daysDiff % 7 === 0;
            case 'monthly':
                return target.getDate() === startDate.getDate();
            case 'yearly':
                return this._checkYearlyPattern(target, startDate);
            case 'custom':
                return this._checkCustomPattern(todo, daysDiff);
            default:
                return false;
        }
    }

    // 检查年度重复模式
    static _checkYearlyPattern(target, startDate) {
        return target.getDate() === startDate.getDate() && 
               target.getMonth() === startDate.getMonth();
    }

    // 检查自定义重复模式
    static _checkCustomPattern(todo, daysDiff) {
        const interval = todo.repeat_interval || 1;
        return daysDiff % interval === 0;
    }

    // 判断TODO是否应该在指定日期显示（优化版本 - 无数据库查询）
    static async shouldShowOnDateOptimized(todo, targetDate) {
        return this._performOptimizedDateCheck(todo, targetDate);
    }

    // 执行优化的日期检查
    static _performOptimizedDateCheck(todo, targetDate) {
        const dateContext = this._createDateContext(todo, targetDate);
        
        if (!this._validateDateConstraints(todo, dateContext)) {
            return false;
        }

        return this._checkRepeatPattern(todo, dateContext);
    }

    // 验证日期约束条件
    static _validateDateConstraints(todo, dateContext) {
        return this._isTargetDateValid(dateContext) &&
               this._isWithinEndDateRange(todo, dateContext) &&
               this._isWithinCycleRange(todo, dateContext);
    }

    // 判断TODO是否应该在指定日期显示
    static async shouldShowOnDate(todo, targetDate) {
        const dateContext = this._prepareDateContext(todo, targetDate);
        
        if (!this._isDateInValidRange(todo, dateContext)) {
            return false;
        }

        if (!await this._isDateNotDeleted(todo.id, dateContext.targetDateStr)) {
            return false;
        }

        return this._checkRepeatPattern(todo, dateContext);
    }

    // 准备日期上下文
    static _prepareDateContext(todo, targetDate) {
        const startDate = new Date(todo.start_date);
        const target = new Date(targetDate);
        const targetDateStr = target.toISOString().split('T')[0];
        const daysDiff = Math.floor((target - startDate) / (1000 * 60 * 60 * 24));
        
        return {
            startDate,
            target,
            targetDateStr,
            daysDiff
        };
    }

    // 检查日期是否在有效范围内
    static _isDateInValidRange(todo, dateContext) {
        const { startDate, target, targetDateStr } = dateContext;
        
        // 如果目标日期早于开始日期，不显示
        if (target < startDate) {
            return false;
        }

        // 检查结束日期限制
        if (!this._isWithinEndDate(todo, target, targetDateStr)) {
            return false;
        }

        // 检查重复周期限制
        if (!this._isWithinCycleDuration(todo, startDate, target, targetDateStr)) {
            return false;
        }

        return true;
    }

    // 检查是否在结束日期范围内
    static _isWithinEndDate(todo, target, targetDateStr) {
        if (todo.end_date) {
            const endDate = new Date(todo.end_date);
            console.log(`📅 检查结束日期: TODO ${todo.id}, 结束日期: ${todo.end_date}, 目标日期: ${targetDateStr}, 目标日期 > 结束日期: ${target > endDate}`);
            if (target > endDate) {
                console.log(`❌ TODO ${todo.id} 在 ${targetDateStr} 不显示，因为超过了结束日期 ${todo.end_date}`);
                return false;
            }
        }
        return true;
    }

    // 检查是否在重复周期范围内
    static _isWithinCycleDuration(todo, startDate, target, targetDateStr) {
        if (todo.cycle_type === 'custom' && todo.cycle_duration) {
            const cycleEndDate = Todo.calculateCycleEndDate(startDate, todo.cycle_duration, todo.cycle_unit);
            console.log(`📅 检查重复周期: TODO ${todo.id}, 周期结束日期: ${cycleEndDate.toISOString().split('T')[0]}, 目标日期: ${targetDateStr}`);
            if (target > cycleEndDate) {
                console.log(`❌ TODO ${todo.id} 在 ${targetDateStr} 不显示，因为超过了重复周期`);
                return false;
            }
        }
        return true;
    }

    // 检查日期是否未被删除
    static async _isDateNotDeleted(todoId, targetDateStr) {
        const deletionRecord = await query(`
            SELECT deletion_type FROM todo_deletions 
            WHERE todo_id = ? AND deletion_date = ?
        `, [todoId, targetDateStr]);
        
        return deletionRecord.length === 0;
    }


    // 检查TODO在指定日期是否已完成
    static async isCompletedOnDate(todoId, date) {
        const sql = 'SELECT COUNT(*) as count FROM todo_completions WHERE todo_id = ? AND completion_date = ?';
        const result = await query(sql, [todoId, date]);
        return result[0].count > 0;
    }

    // 标记TODO为完成
    static async markCompleted(todoId, userId, date, notes = '') {
        try {
            const sql = `
                INSERT OR REPLACE INTO todo_completions (todo_id, user_id, completion_date, notes)
                VALUES (?, ?, ?, ?)
            `;
            await query(sql, [todoId, userId, date, notes]);
            console.log('✅ TODO标记为完成');
            return true;
        } catch (error) {
            console.error('标记TODO完成失败:', error);
            throw error;
        }
    }

    // 取消TODO完成状态
    static async markUncompleted(todoId, date) {
        try {
            const sql = 'DELETE FROM todo_completions WHERE todo_id = ? AND completion_date = ?';
            const result = await query(sql, [todoId, date]);
            console.log('✅ TODO取消完成状态');
            return result.affectedRows > 0;
        } catch (error) {
            console.error('取消TODO完成状态失败:', error);
            throw error;
        }
    }

    // 更新TODO
    static async updateById(id, updateData) {
        try {
            const {
                title,
                description,
                reminder_time,
                priority,
                repeat_type,
                repeat_interval,
                cycle_type,
                cycle_duration,
                cycle_unit,
                start_date,
                sort_order
            } = updateData;

            // 验证数据
            const validationErrors = Todo.validateTodoData(updateData, true);
            if (validationErrors.length > 0) {
                throw new Error('数据验证失败: ' + validationErrors.join(', '));
            }

            const fields = [];
            const values = [];

            if (title !== undefined) {
                fields.push('title = ?');
                values.push(title);
            }
            if (description !== undefined) {
                fields.push('description = ?');
                values.push(description);
            }
            if (reminder_time !== undefined) {
                fields.push('reminder_time = ?');
                values.push(reminder_time);
            }
            if (priority !== undefined) {
                fields.push('priority = ?');
                values.push(priority);
            }
            if (repeat_type !== undefined) {
                fields.push('repeat_type = ?');
                values.push(repeat_type);
            }
            if (repeat_interval !== undefined) {
                fields.push('repeat_interval = ?');
                values.push(repeat_interval);
            }
            if (cycle_type !== undefined) {
                fields.push('cycle_type = ?');
                values.push(cycle_type);
            }
            if (cycle_duration !== undefined) {
                fields.push('cycle_duration = ?');
                values.push(cycle_duration);
            }
            if (cycle_unit !== undefined) {
                fields.push('cycle_unit = ?');
                values.push(cycle_unit);
            }
            if (start_date !== undefined) {
                fields.push('start_date = ?');
                values.push(start_date);
            }
            if (sort_order !== undefined) {
                fields.push('sort_order = ?');
                values.push(sort_order);
            }

            if (fields.length === 0) {
                throw new Error('没有要更新的字段');
            }

            values.push(id);
            const sql = `UPDATE todos SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
            
            await query(sql, values);
            console.log('✅ TODO更新成功');
            return await Todo.findById(id);
        } catch (error) {
            console.error('更新TODO失败:', error);
            throw error;
        }
    }

    // 智能删除TODO - 支持重复任务的不同删除模式
    static async deleteById(id, deletionType = 'all', deletionDate = null) {
        try {
            const todo = await Todo.findById(id);
            if (!todo) {
                throw new Error('TODO不存在');
            }

            switch (deletionType) {
                case 'single':
                    // 只删除特定日期的实例
                    if (!deletionDate) {
                        throw new Error('删除单个实例时必须提供日期');
                    }
                    await query(`
                        INSERT OR REPLACE INTO todo_deletions (todo_id, deletion_date, deletion_type)
                        VALUES (?, ?, 'single')
                    `, [id, deletionDate]);
                    console.log('✅ TODO单个实例删除成功');
                    return true;

                case 'from_date': {
                    // 删除从某日期开始的所有实例
                    if (!deletionDate) {
                        throw new Error('删除从某日期开始的实例时必须提供日期');
                    }
                    const sql = 'UPDATE todos SET end_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
                    const endDate = new Date(deletionDate);
                    endDate.setDate(endDate.getDate() - 1); // 结束日期是删除日期的前一天
                    await query(sql, [endDate.toISOString().split('T')[0], id]);
                    console.log('✅ TODO从指定日期开始删除成功');
                    return true;
                }

                case 'all':
                default: {
                    // 删除整个TODO（包括所有重复实例）
                    const result = await query('UPDATE todos SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
                    console.log('✅ TODO完全删除成功');
                    return result.affectedRows > 0;
                }
            }
        } catch (error) {
            console.error('删除TODO失败:', error);
            throw error;
        }
    }

    // 软删除TODO（保持向后兼容）
    static async softDeleteById(id) {
        return await Todo.deleteById(id, 'all');
    }

    // 硬删除TODO（慎用）
    static async hardDeleteById(id) {
        try {
            // 先删除完成记录
            await query('DELETE FROM todo_completions WHERE todo_id = ?', [id]);
            // 再删除TODO
            const sql = 'DELETE FROM todos WHERE id = ?';
            const result = await query(sql, [id]);
            console.log('✅ TODO硬删除成功');
            return result.affectedRows > 0;
        } catch (error) {
            console.error('硬删除TODO失败:', error);
            throw error;
        }
    }

    // 按时间排序TODO列表
    static sortByTime(todos) {
        return todos.sort((a, b) => {
            // 将时间转换为可比较的数值
            const getTimeValue = (todo) => {
                if (!todo.reminder_time || todo.reminder_time === 'all_day') {
                    return 9999; // 全天的项目排在最后
                }
                
                // 将时间字符串转换为分钟数 (如 "08:30" -> 8*60+30 = 510)
                const [hours, minutes] = todo.reminder_time.split(':').map(Number);
                return hours * 60 + (minutes || 0);
            };
            
            const timeA = getTimeValue(a);
            const timeB = getTimeValue(b);
            
            // 如果时间相同，按优先级排序（高优先级在前）
            if (timeA === timeB) {
                const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
                const priorityA = priorityOrder[a.priority] || 1;
                const priorityB = priorityOrder[b.priority] || 1;
                
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }
                
                // 如果时间和优先级都相同，按创建时间排序
                return new Date(a.created_at) - new Date(b.created_at);
            }
            
            return timeA - timeB;
        });
    }

    // 计算重复周期的结束日期
    static calculateCycleEndDate(startDate, cycleDuration, cycleUnit) {
        const endDate = new Date(startDate);
        
        switch (cycleUnit) {
            case 'days':
                // 减1是因为开始日期本身算作第1天
                endDate.setDate(endDate.getDate() + cycleDuration - 1);
                break;
            case 'weeks':
                // 减1是因为开始日期本身算作第1周的第1天
                endDate.setDate(endDate.getDate() + (cycleDuration * 7) - 1);
                break;
            case 'months':
                // 对于月份，我们设置到该月的最后一天
                endDate.setMonth(endDate.getMonth() + cycleDuration);
                endDate.setDate(endDate.getDate() - 1);
                break;
            default:
                endDate.setDate(endDate.getDate() + cycleDuration - 1);
        }
        
        return endDate;
    }

    // 获取重复类型的显示文本
    static getRepeatTypeText(repeatType, repeatInterval = 1) {
        switch (repeatType) {
            case 'none':
                return '一次性';
            case 'daily':
                return '每天';
            case 'every_other_day':
                return '隔天';
            case 'weekly':
                return '每周';
            case 'monthly':
                return '每月';
            case 'yearly':
                return '每年';
            case 'custom':
                return `每${repeatInterval}天`;
            default:
                return '一次性';
        }
    }

    // 获取重复周期的显示文本
    static getCycleText(cycleType, cycleDuration, cycleUnit) {
        if (cycleType === 'long_term') {
            return '长期';
        } else if (cycleType === 'custom' && cycleDuration) {
            const unitText = {
                'days': '天',
                'weeks': '周',
                'months': '月'
            };
            return `${cycleDuration}${unitText[cycleUnit] || '天'}`;
        }
        return '长期';
    }

    // 验证TODO数据
    static validateTodoData(todoData, isUpdate = false) {
        const errors = [];

        // 基础字段验证
        this._validateBasicFields(todoData, isUpdate, errors);
        
        // 内容字段验证
        this._validateContentFields(todoData, errors);
        
        // 重复设置验证
        this._validateRepeatSettings(todoData, errors);
        
        // 时间设置验证
        this._validateTimeSettings(todoData, errors);
        
        // 周期设置验证
        this._validateCycleSettings(todoData, errors);

        return errors;
    }

    // 验证基础字段
    static _validateBasicFields(todoData, isUpdate, errors) {
        if (!isUpdate && !todoData.user_id) {
            errors.push('用户ID不能为空');
        }

        if (!isUpdate && !todoData.title) {
            errors.push('标题不能为空');
        }
    }

    // 验证内容字段
    static _validateContentFields(todoData, errors) {
        if (todoData.title && (todoData.title.length < 1 || todoData.title.length > 200)) {
            errors.push('标题长度必须在1-200字符之间');
        }

        if (todoData.description && todoData.description.length > 1000) {
            errors.push('描述长度不能超过1000字符');
        }

        if (todoData.priority && !this._isValidPriority(todoData.priority)) {
            errors.push('优先级值不正确');
        }
    }

    // 验证重复设置
    static _validateRepeatSettings(todoData, errors) {
        if (todoData.repeat_type && !this._isValidRepeatType(todoData.repeat_type)) {
            errors.push('重复类型值不正确');
        }

        if (todoData.repeat_interval && !this._isValidInterval(todoData.repeat_interval)) {
            errors.push('重复间隔必须在1-365之间');
        }
    }

    // 验证时间设置
    static _validateTimeSettings(todoData, errors) {
        if (todoData.reminder_time && !this._isValidReminderTime(todoData.reminder_time)) {
            errors.push('提醒时间格式不正确');
        }
    }

    // 验证周期设置
    static _validateCycleSettings(todoData, errors) {
        if (todoData.cycle_type && !this._isValidCycleType(todoData.cycle_type)) {
            errors.push('重复周期类型值不正确');
        }

        if (todoData.cycle_type === 'custom') {
            this._validateCustomCycle(todoData, errors);
        }
    }

    // 验证自定义周期
    static _validateCustomCycle(todoData, errors) {
        if (!todoData.cycle_duration || !this._isValidInterval(todoData.cycle_duration)) {
            errors.push('重复周期时长必须在1-365之间');
        }
        
        if (todoData.cycle_unit && !this._isValidCycleUnit(todoData.cycle_unit)) {
            errors.push('重复周期单位值不正确');
        }
    }

    // 辅助验证方法
    static _isValidPriority(priority) {
        return ['low', 'medium', 'high'].includes(priority);
    }

    static _isValidRepeatType(repeatType) {
        return ['none', 'daily', 'every_other_day', 'weekly', 'monthly', 'yearly', 'custom'].includes(repeatType);
    }

    static _isValidInterval(interval) {
        return interval >= 1 && interval <= 365;
    }

    static _isValidReminderTime(reminderTime) {
        return reminderTime === 'all_day' || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(reminderTime);
    }

    static _isValidCycleType(cycleType) {
        return ['long_term', 'custom'].includes(cycleType);
    }

    static _isValidCycleUnit(cycleUnit) {
        return ['days', 'weeks', 'months'].includes(cycleUnit);
    }

    // 转换为JSON对象
    toJSON() {
        return {
            id: this.id,
            user_id: this.user_id,
            title: this.title,
            description: this.description,
            reminder_time: this.reminder_time,
            priority: this.priority,
            repeat_type: this.repeat_type,
            repeat_interval: this.repeat_interval,
            start_date: this.start_date,
            end_date: this.end_date,
            cycle_type: this.cycle_type,
            cycle_duration: this.cycle_duration,
            cycle_unit: this.cycle_unit,
            is_active: this.is_active,
            sort_order: this.sort_order,
            created_at: this.created_at,
            updated_at: this.updated_at,
            // 包含完成状态（如果存在的话）
            is_completed_today: this.is_completed_today
        };
    }
}

module.exports = Todo;