// Note模型 - 健康笔记管理
const { query } = require('../config/sqlite');

class Note {
    constructor(data) {
        this.id = data.id;
        this.user_id = data.user_id;
        this.title = data.title; // 健康状况标题，如"关节炎"、"血压高"等
        this.description = data.description || ''; // 备注描述
        this.precautions = data.precautions || ''; // 注意事项/医嘱
        this.ai_suggestions = data.ai_suggestions || ''; // AI建议
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    // 创建新Note
    static async create(noteData) {
        try {
            const {
                user_id,
                title,
                description = '',
                precautions = '',
                ai_suggestions = ''
            } = noteData;

            // 数据验证
            if (!user_id || !title) {
                throw new Error('数据验证失败：用户ID和标题不能为空');
            }

            if (title.length > 100) {
                throw new Error('数据验证失败：标题长度不能超过100个字符');
            }

            const now = new Date().toISOString();
            
            const result = await query(`
                INSERT INTO notes (
                    user_id, title, description, precautions, ai_suggestions, 
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [user_id, title, description, precautions, ai_suggestions, now, now]);

            if (result.insertId) {
                return await Note.findById(result.insertId);
            } else {
                throw new Error('创建Note失败：无法获取新建记录ID');
            }
        } catch (error) {
            console.error('创建Note失败:', error);
            throw error;
        }
    }

    // 根据ID查找Note
    static async findById(id) {
        try {
            const result = await query('SELECT * FROM notes WHERE id = ?', [id]);
            return result.length > 0 ? new Note(result[0]) : null;
        } catch (error) {
            console.error('查找Note失败:', error);
            throw error;
        }
    }

    // 根据用户ID查找所有Notes
    static async findByUserId(userId) {
        try {
            const result = await query(`
                SELECT * FROM notes 
                WHERE user_id = ? 
                ORDER BY updated_at DESC, created_at DESC
            `, [userId]);
            
            return result.map(note => new Note(note));
        } catch (error) {
            console.error('查找用户Notes失败:', error);
            throw error;
        }
    }

    // 更新Note
    static async updateById(id, updateData) {
        try {
            const existingNote = await Note.findById(id);
            if (!existingNote) {
                return null;
            }

            const {
                title,
                description,
                precautions,
                ai_suggestions
            } = updateData;

            // 数据验证
            if (title && title.length > 100) {
                throw new Error('数据验证失败：标题长度不能超过100个字符');
            }

            const now = new Date().toISOString();
            
            await query(`
                UPDATE notes 
                SET title = COALESCE(?, title),
                    description = COALESCE(?, description),
                    precautions = COALESCE(?, precautions),
                    ai_suggestions = COALESCE(?, ai_suggestions),
                    updated_at = ?
                WHERE id = ?
            `, [title, description, precautions, ai_suggestions, now, id]);

            return await Note.findById(id);
        } catch (error) {
            console.error('更新Note失败:', error);
            throw error;
        }
    }

    // 删除Note
    static async deleteById(id) {
        try {
            const existingNote = await Note.findById(id);
            if (!existingNote) {
                return false;
            }

            await query('DELETE FROM notes WHERE id = ?', [id]);
            return true;
        } catch (error) {
            console.error('删除Note失败:', error);
            throw error;
        }
    }

    // 获取所有Notes
    static async findAll() {
        try {
            const result = await query(`
                SELECT * FROM notes 
                ORDER BY updated_at DESC, created_at DESC
            `);
            
            return result.map(note => new Note(note));
        } catch (error) {
            console.error('获取所有Notes失败:', error);
            throw error;
        }
    }

    // 搜索Notes
    static async search(searchTerm, userId = null) {
        try {
            let sql = `
                SELECT * FROM notes 
                WHERE (title LIKE ? OR description LIKE ? OR precautions LIKE ?)
            `;
            let params = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];

            if (userId) {
                sql += ' AND user_id = ?';
                params.push(userId);
            }

            sql += ' ORDER BY updated_at DESC, created_at DESC';

            const result = await query(sql, params);
            return result.map(note => new Note(note));
        } catch (error) {
            console.error('搜索Notes失败:', error);
            throw error;
        }
    }
}

module.exports = Note;