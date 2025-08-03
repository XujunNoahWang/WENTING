const { query, transaction } = require('../config/database');

class Todo {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.title = data.title;
        this.description = data.description;
        this.reminder_time = data.reminder_time;
        this.reminder_type = data.reminder_type;
        this.priority = data.priority;
        this.category = data.category;
        this.repeat_pattern_id = data.repeat_pattern_id;
        this.start_date = data.start_date;
        this.due_date = data.due_date;
        this.estimated_duration = data.estimated_duration;
        this.emoji = data.emoji;
        this.color = data.color;
        this.is_template = data.is_template;
        this.sort_order = data.sort_order;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.is_deleted = data.is_deleted;
    }

    // 创建新TODO
    static async create(todoData) {
        try {
            const {
                user_id,
                title,
                description = '',
                reminder_time,
                reminder_type = 'all_day',
                priority = 'medium',
                category,
                repeat_pattern_id,
                start_date,
                due_date,
                estimated_duration,
                emoji,
                color,
                is_template = false,
                sort_order = 0
            } = todoData;

            const sql = `
                INSERT INTO todos (
                    user_id, title, description, reminder_time, reminder_type, 
                    priority, category, repeat_pattern_id, start_date, due_date,
                    estimated_duration, emoji, color, is_template, sort_order
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const result = await query(sql, [
                user_id, title, description, reminder_time, reminder_type,
                priority, category, repeat_pattern_id, start_date, due_date,
                estimated_duration, emoji, color, is_template, sort_order
            ]);

            return await Todo.findById(result.insertId);
        } catch (error) {
            console.error('创建TODO失败:', error);
            throw error;
        }
    }

    // 根据ID查找TODO
    static async findById(id) {
        const sql = `
            SELECT t.*, rp.pattern_type, rp.interval_value, rp.days_of_week, 
                   rp.days_of_month, rp.end_type, rp.end_after_count, rp.end_date
            FROM todos t
            LEFT JOIN repeat_patterns rp ON t.repeat_pattern_id = rp.id
            WHERE t.id = ? AND t.is_deleted = FALSE
        `;
        const todos = await query(sql, [id]);
        return todos.length > 0 ? new Todo(todos[0]) : null;
    }

    // 获取用户的所有TODO
    static async findByUserId(userId, options = {}) {
        const {
            date = null,
            category = null,
            priority = null,
            completed = null,
            limit = null,
            offset = 0
        } = options;

        let sql = `
            SELECT t.*, rp.pattern_type, rp.interval_value, rp.days_of_week, 
                   rp.days_of_month, rp.end_type, rp.end_after_count, rp.end_date,
                   tc.completion_date IS NOT NULL as is_completed_today
            FROM todos t
            LEFT JOIN repeat_patterns rp ON t.repeat_pattern_id = rp.id
            LEFT JOIN todo_completions tc ON t.id = tc.todo_id AND tc.completion_date = ?
            WHERE t.user_id = ? AND t.is_deleted = FALSE
        `;
        
        const params = [date || new Date().toISOString().split('T')[0], userId];

        if (date) {
            sql += ` AND (t.start_date <= ? AND (t.due_date IS NULL OR t.due_date >= ?))`;
            params.push(date, date);
        }

        if (category) {
            sql += ` AND t.category = ?`;
            params.push(category);
        }

        if (priority) {
            sql += ` AND t.priority = ?`;
            params.push(priority);
        }

        if (completed !== null) {
            if (completed) {
                sql += ` AND tc.completion_date IS NOT NULL`;
            } else {
                sql += ` AND tc.completion_date IS NULL`;
            }
        }

        sql += ` ORDER BY t.sort_order, t.reminder_time, t.created_at`;

        if (limit) {
            sql += ` LIMIT ? OFFSET ?`;
            params.push(limit, offset);
        }

        const todos = await query(sql, params);
        return todos.map(todo => new Todo(todo));
    }

    // 获取用户今日TODO
    static async getTodayTodos(userId, date = null) {
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        const sql = `
            SELECT t.*, rp.pattern_type, rp.interval_value, rp.days_of_week, 
                   rp.days_of_month, rp.end_type, rp.end_after_count, rp.end_date,
                   tc.completion_date IS NOT NULL as is_completed_today,
                   tc.completion_time, tc.notes as completion_notes, tc.mood
            FROM todos t
            LEFT JOIN repeat_patterns rp ON t.repeat_pattern_id = rp.id
            LEFT JOIN todo_completions tc ON t.id = tc.todo_id AND tc.completion_date = ?
            WHERE t.user_id = ? AND t.is_deleted = FALSE
            AND (
                (rp.pattern_type = 'none' AND t.start_date = ?) OR
                (rp.pattern_type = 'daily') OR
                (rp.pattern_type = 'weekly' AND DAYOFWEEK(?) - 1 IN (
                    SELECT value FROM JSON_TABLE(rp.days_of_week, '$[*]' COLUMNS (value INT PATH '$')) AS jt
                )) OR
                (rp.pattern_type = 'monthly' AND DAY(?) IN (
                    SELECT value FROM JSON_TABLE(rp.days_of_month, '$[*]' COLUMNS (value INT PATH '$')) AS jt
                )) OR
                (t.start_date <= ? AND (t.due_date IS NULL OR t.due_date >= ?))
            )
            ORDER BY t.sort_order, t.reminder_time, t.created_at
        `;
        
        const params = [targetDate, userId, targetDate, targetDate, targetDate, targetDate, targetDate];
        const todos = await query(sql, params);
        return todos.map(todo => new Todo(todo));
    }

    // 更新TODO
    static async updateById(id, updateData) {
        try {
            const {
                title,
                description,
                reminder_time,
                reminder_type,
                priority,
                category,
                repeat_pattern_id,
                start_date,
                due_date,
                estimated_duration,
                emoji,
                color,
                sort_order
            } = updateData;

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
            if (reminder_type !== undefined) {
                fields.push('reminder_type = ?');
                values.push(reminder_type);
            }
            if (priority !== undefined) {
                fields.push('priority = ?');
                values.push(priority);
            }
            if (category !== undefined) {
                fields.push('category = ?');
                values.push(category);
            }
            if (repeat_pattern_id !== undefined) {
                fields.push('repeat_pattern_id = ?');
                values.push(repeat_pattern_id);
            }
            if (start_date !== undefined) {
                fields.push('start_date = ?');
                values.push(start_date);
            }
            if (due_date !== undefined) {
                fields.push('due_date = ?');
                values.push(due_date);
            }
            if (estimated_duration !== undefined) {
                fields.push('estimated_duration = ?');
                values.push(estimated_duration);
            }
            if (emoji !== undefined) {
                fields.push('emoji = ?');
                values.push(emoji);
            }
            if (color !== undefined) {
                fields.push('color = ?');
                values.push(color);
            }
            if (sort_order !== undefined) {
                fields.push('sort_order = ?');
                values.push(sort_order);
            }

            if (fields.length === 0) {
                throw new Error('没有要更新的字段');
            }

            values.push(id);
            const sql = `UPDATE todos SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_deleted = FALSE`;
            
            await query(sql, values);
            return await Todo.findById(id);
        } catch (error) {
            console.error('更新TODO失败:', error);
            throw error;
        }
    }

    // 软删除TODO
    static async deleteById(id) {
        const sql = 'UPDATE todos SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        const result = await query(sql, [id]);
        return result.affectedRows > 0;
    }

    // 完成TODO
    static async completeTodo(todoId, userId, date = null, notes = '', mood = null) {
        try {
            const targetDate = date || new Date().toISOString().split('T')[0];
            
            const sql = `
                INSERT INTO todo_completions (todo_id, user_id, completion_date, notes, mood)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                completion_time = CURRENT_TIMESTAMP, notes = VALUES(notes), mood = VALUES(mood)
            `;
            
            await query(sql, [todoId, userId, targetDate, notes, mood]);
            return true;
        } catch (error) {
            console.error('完成TODO失败:', error);
            throw error;
        }
    }

    // 取消完成TODO
    static async uncompleteTodo(todoId, date = null) {
        try {
            const targetDate = date || new Date().toISOString().split('T')[0];
            
            const sql = 'DELETE FROM todo_completions WHERE todo_id = ? AND completion_date = ?';
            const result = await query(sql, [todoId, targetDate]);
            return result.affectedRows > 0;
        } catch (error) {
            console.error('取消完成TODO失败:', error);
            throw error;
        }
    }

    // 获取用户的完成统计
    static async getCompletionStats(userId, startDate = null, endDate = null) {
        const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = endDate || new Date().toISOString().split('T')[0];
        
        const sql = `
            SELECT 
                completion_date,
                COUNT(*) as completed_count,
                AVG(CASE WHEN mood = 'great' THEN 4 
                         WHEN mood = 'good' THEN 3 
                         WHEN mood = 'okay' THEN 2 
                         WHEN mood = 'bad' THEN 1 
                         ELSE NULL END) as avg_mood
            FROM todo_completions 
            WHERE user_id = ? AND completion_date BETWEEN ? AND ?
            GROUP BY completion_date
            ORDER BY completion_date DESC
        `;
        
        return await query(sql, [userId, start, end]);
    }

    // 批量更新排序
    static async updateSortOrder(todoOrders) {
        try {
            return await transaction(async (connection) => {
                for (const { id, sort_order } of todoOrders) {
                    await connection.execute(
                        'UPDATE todos SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [sort_order, id]
                    );
                }
                return true;
            });
        } catch (error) {
            console.error('更新排序失败:', error);
            throw error;
        }
    }

    // 验证TODO数据
    static validateTodoData(todoData, isUpdate = false) {
        const errors = [];

        if (!isUpdate && !todoData.user_id) {
            errors.push('用户ID不能为空');
        }

        if (!isUpdate && !todoData.title) {
            errors.push('TODO标题不能为空');
        }

        if (todoData.title && (todoData.title.length < 1 || todoData.title.length > 200)) {
            errors.push('TODO标题长度必须在1-200字符之间');
        }

        if (todoData.description && todoData.description.length > 1000) {
            errors.push('描述长度不能超过1000字符');
        }

        if (todoData.reminder_time && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(todoData.reminder_time)) {
            errors.push('提醒时间格式不正确(HH:MM)');
        }

        if (todoData.reminder_type && !['specific_time', 'all_day', 'before_meal', 'after_meal'].includes(todoData.reminder_type)) {
            errors.push('提醒类型不正确');
        }

        if (todoData.priority && !['low', 'medium', 'high'].includes(todoData.priority)) {
            errors.push('优先级不正确');
        }

        if (todoData.start_date && new Date(todoData.start_date) < new Date('1900-01-01')) {
            errors.push('开始日期不正确');
        }

        if (todoData.due_date && todoData.start_date && new Date(todoData.due_date) < new Date(todoData.start_date)) {
            errors.push('截止日期不能早于开始日期');
        }

        if (todoData.estimated_duration && (todoData.estimated_duration < 1 || todoData.estimated_duration > 1440)) {
            errors.push('预计用时必须在1-1440分钟之间');
        }

        if (todoData.color && !/^#[0-9A-Fa-f]{6}$/.test(todoData.color)) {
            errors.push('颜色格式不正确');
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
            reminder_type: this.reminder_type,
            priority: this.priority,
            category: this.category,
            repeat_pattern_id: this.repeat_pattern_id,
            start_date: this.start_date,
            due_date: this.due_date,
            estimated_duration: this.estimated_duration,
            emoji: this.emoji,
            color: this.color,
            is_template: this.is_template,
            sort_order: this.sort_order,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = Todo;