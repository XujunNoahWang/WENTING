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
                start_date = new Date().toISOString().split('T')[0]
            } = todoData;

            // 验证数据
            const validationErrors = Todo.validateTodoData(todoData);
            if (validationErrors.length > 0) {
                throw new Error('数据验证失败: ' + validationErrors.join(', '));
            }

            const sql = `
                INSERT INTO todos (user_id, title, description, reminder_time, priority, repeat_type, repeat_interval, start_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const result = await query(sql, [
                user_id, title, description, reminder_time, priority, repeat_type, repeat_interval, start_date
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

    // 获取用户指定日期的TODO（考虑重复规则）
    static async findByUserIdAndDate(userId, targetDate) {
        try {
            const allTodos = await Todo.findByUserId(userId);
            const todosForDate = [];

            for (const todo of allTodos) {
                if (await Todo.shouldShowOnDate(todo, targetDate)) {
                    // 检查是否已完成
                    const isCompleted = await Todo.isCompletedOnDate(todo.id, targetDate);
                    const todoWithCompletion = { ...todo, is_completed_today: isCompleted };
                    todosForDate.push(todoWithCompletion);
                }
            }

            // 按时间排序
            return Todo.sortByTime(todosForDate);
        } catch (error) {
            console.error('获取用户日期TODO失败:', error);
            throw error;
        }
    }

    // 判断TODO是否应该在指定日期显示
    static async shouldShowOnDate(todo, targetDate) {
        const startDate = new Date(todo.start_date);
        const target = new Date(targetDate);
        const targetDateStr = target.toISOString().split('T')[0];
        
        // 如果目标日期早于开始日期，不显示
        if (target < startDate) {
            return false;
        }

        // 如果有结束日期且目标日期晚于结束日期，不显示
        if (todo.end_date) {
            const endDate = new Date(todo.end_date);
            console.log(`📅 检查结束日期: TODO ${todo.id}, 结束日期: ${todo.end_date}, 目标日期: ${targetDateStr}, 目标日期 > 结束日期: ${target > endDate}`);
            if (target > endDate) {
                console.log(`❌ TODO ${todo.id} 在 ${targetDateStr} 不显示，因为超过了结束日期 ${todo.end_date}`);
                return false;
            }
        }

        // 检查是否有针对这个日期的删除记录
        const deletionRecord = await query(`
            SELECT deletion_type FROM todo_deletions 
            WHERE todo_id = ? AND deletion_date = ?
        `, [todo.id, targetDateStr]);
        
        if (deletionRecord.length > 0) {
            // 如果有删除记录，不显示
            return false;
        }

        // 计算天数差
        const daysDiff = Math.floor((target - startDate) / (1000 * 60 * 60 * 24));

        switch (todo.repeat_type) {
            case 'none':
                // 一次性任务，只在开始日期显示
                return daysDiff === 0;
                
            case 'daily':
                return true; // 每天都显示
                
            case 'every_other_day':
                return daysDiff % 2 === 0; // 隔天显示
                
            case 'weekly':
                return daysDiff % 7 === 0; // 每周显示
                
            case 'monthly':
                // 每月同一天显示
                return target.getDate() === startDate.getDate();
                
            case 'yearly':
                // 每年同一天显示
                return target.getDate() === startDate.getDate() && 
                       target.getMonth() === startDate.getMonth();
                       
            case 'custom':
                const interval = todo.repeat_interval || 1;
                return daysDiff % interval === 0;
                
            default:
                return false;
        }
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

                case 'from_date':
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

                case 'all':
                default:
                    // 删除整个TODO（包括所有重复实例）
                    const result = await query('UPDATE todos SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
                    console.log('✅ TODO完全删除成功');
                    return result.affectedRows > 0;
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

    // 验证TODO数据
    static validateTodoData(todoData, isUpdate = false) {
        const errors = [];

        if (!isUpdate && !todoData.user_id) {
            errors.push('用户ID不能为空');
        }

        if (!isUpdate && !todoData.title) {
            errors.push('标题不能为空');
        }

        if (todoData.title && (todoData.title.length < 1 || todoData.title.length > 200)) {
            errors.push('标题长度必须在1-200字符之间');
        }

        if (todoData.description && todoData.description.length > 1000) {
            errors.push('描述长度不能超过1000字符');
        }

        if (todoData.priority && !['low', 'medium', 'high'].includes(todoData.priority)) {
            errors.push('优先级值不正确');
        }

        if (todoData.repeat_type && !['none', 'daily', 'every_other_day', 'weekly', 'monthly', 'yearly', 'custom'].includes(todoData.repeat_type)) {
            errors.push('重复类型值不正确');
        }

        if (todoData.repeat_interval && (todoData.repeat_interval < 1 || todoData.repeat_interval > 365)) {
            errors.push('重复间隔必须在1-365之间');
        }

        if (todoData.reminder_time && todoData.reminder_time !== 'all_day' && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(todoData.reminder_time)) {
            errors.push('提醒时间格式不正确');
        }

        return errors;
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
            is_active: this.is_active,
            sort_order: this.sort_order,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = Todo;