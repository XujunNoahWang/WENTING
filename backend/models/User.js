const { query } = require('../config/database');

class User {
    constructor(data) {
        this.id = data.id;
        this.app_user_id = data.app_user_id;
        this.username = data.username;
        this.display_name = data.display_name;
        this.email = data.email;
        this.phone = data.phone;
        this.gender = data.gender;
        this.birthday = data.birthday;
        this.avatar_color = data.avatar_color;
        this.timezone = data.timezone;
        this.device_id = data.device_id;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
        this.is_active = data.is_active;
    }

    // 创建新用户
    static async create(userData) {
        try {
            const {
                app_user_id,
                username,
                display_name,
                email,
                phone,
                gender,
                birthday,
                avatar_color = '#1d9bf0',
                timezone = 'Asia/Shanghai',
                device_id
            } = userData;

            if (!app_user_id) {
                throw new Error('注册用户ID不能为空');
            }

            // 设备ID现在是可选的，如果没有提供则使用默认值
            const finalDeviceId = device_id || 'default_device';
            if (!device_id) {
                console.log('⚠️ 设备ID未提供，使用默认值:', finalDeviceId);
            }

            // 检查同一注册用户和设备上用户名是否已存在
            const existingUser = await User.findByUsernameAndAppUserAndDevice(username, app_user_id, finalDeviceId);
            if (existingUser) {
                throw new Error('该用户名已存在');
            }

            // 检查邮箱是否已存在（如果提供了邮箱）
            if (email) {
                const existingEmail = await User.findByEmailAndAppUserAndDevice(email, app_user_id, finalDeviceId);
                if (existingEmail) {
                    throw new Error('该邮箱已被使用');
                }
            }

            const sql = `
                INSERT INTO users (app_user_id, username, display_name, email, phone, gender, birthday, avatar_color, timezone, device_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const result = await query(sql, [
                app_user_id, username, display_name, email, phone, gender, birthday, avatar_color, timezone, finalDeviceId
            ]);

            // 获取新创建的用户
            const newUser = await User.findById(result.insertId);
            
            // 创建默认设置
            await User.createDefaultSettings(result.insertId);
            
            return newUser;
        } catch (error) {
            console.error('创建用户失败:', error);
            throw error;
        }
    }

    // 根据ID查找用户
    static async findById(id) {
        const sql = 'SELECT * FROM users WHERE id = ? AND is_active = TRUE';
        const users = await query(sql, [id]);
        return users.length > 0 ? new User(users[0]) : null;
    }

    // 根据用户名查找用户（已废弃，使用findByUsernameAndDevice）
    static async findByUsername(username) {
        const sql = 'SELECT * FROM users WHERE username = ? AND is_active = TRUE';
        const users = await query(sql, [username]);
        return users.length > 0 ? new User(users[0]) : null;
    }

    // 根据用户名、注册用户ID和设备ID查找用户
    static async findByUsernameAndAppUserAndDevice(username, appUserId, deviceId) {
        const sql = 'SELECT * FROM users WHERE username = ? AND app_user_id = ? AND device_id = ? AND is_active = TRUE';
        const users = await query(sql, [username, appUserId, deviceId]);
        return users.length > 0 ? new User(users[0]) : null;
    }

    // 根据用户名和设备ID查找用户（兼容旧版）
    static async findByUsernameAndDevice(username, deviceId) {
        const sql = 'SELECT * FROM users WHERE username = ? AND device_id = ? AND is_active = TRUE';
        const users = await query(sql, [username, deviceId]);
        return users.length > 0 ? new User(users[0]) : null;
    }

    // 根据邮箱、注册用户ID和设备ID查找用户
    static async findByEmailAndAppUserAndDevice(email, appUserId, deviceId) {
        const sql = 'SELECT * FROM users WHERE email = ? AND app_user_id = ? AND device_id = ? AND is_active = TRUE';
        const users = await query(sql, [email, appUserId, deviceId]);
        return users.length > 0 ? new User(users[0]) : null;
    }

    // 根据邮箱和设备ID查找用户（兼容旧版）
    static async findByEmailAndDevice(email, deviceId) {
        const sql = 'SELECT * FROM users WHERE email = ? AND device_id = ? AND is_active = TRUE';
        const users = await query(sql, [email, deviceId]);
        return users.length > 0 ? new User(users[0]) : null;
    }

    // 根据邮箱查找用户（已废弃）
    static async findByEmail(email) {
        const sql = 'SELECT * FROM users WHERE email = ? AND is_active = TRUE';
        const users = await query(sql, [email]);
        return users.length > 0 ? new User(users[0]) : null;
    }

    // 获取所有活跃用户（已废弃）
    static async findAll() {
        const sql = 'SELECT * FROM users WHERE is_active = TRUE ORDER BY created_at DESC';
        const users = await query(sql);
        return users.map(user => new User(user));
    }

    // 根据注册用户ID获取所有活跃用户（推荐方法 - 跨设备访问）
    static async findAllByAppUser(appUserId) {
        const sql = 'SELECT * FROM users WHERE app_user_id = ? AND is_active = TRUE ORDER BY created_at DESC';
        const users = await query(sql, [appUserId]);
        return users.map(user => new User(user));
    }

    // 根据注册用户ID和设备ID获取所有活跃用户（兼容旧版，不推荐）
    static async findAllByAppUserAndDevice(appUserId, deviceId) {
        const sql = 'SELECT * FROM users WHERE app_user_id = ? AND device_id = ? AND is_active = TRUE ORDER BY created_at DESC';
        const users = await query(sql, [appUserId, deviceId]);
        return users.map(user => new User(user));
    }


    // 根据设备ID获取所有活跃用户（兼容旧版）
    static async findAllByDevice(deviceId) {
        const sql = 'SELECT * FROM users WHERE device_id = ? AND is_active = TRUE ORDER BY created_at DESC';
        const users = await query(sql, [deviceId]);
        return users.map(user => new User(user));
    }

    // 更新用户信息
    static async updateById(id, updateData) {
        try {
            const {
                username,
                display_name,
                email,
                phone,
                gender,
                birthday,
                avatar_color,
                timezone
            } = updateData;

            // 如果更新用户名，检查是否已存在
            if (username) {
                const existingUser = await User.findByUsername(username);
                if (existingUser && existingUser.id !== parseInt(id)) {
                    throw new Error('用户名已存在');
                }
            }

            // 如果更新邮箱，检查是否已存在
            if (email) {
                const existingEmail = await User.findByEmail(email);
                if (existingEmail && existingEmail.id !== parseInt(id)) {
                    throw new Error('邮箱已被使用');
                }
            }

            const fields = [];
            const values = [];

            if (username !== undefined) {
                fields.push('username = ?');
                values.push(username);
            }
            if (display_name !== undefined) {
                fields.push('display_name = ?');
                values.push(display_name);
            }
            if (email !== undefined) {
                fields.push('email = ?');
                values.push(email);
            }
            if (phone !== undefined) {
                fields.push('phone = ?');
                values.push(phone);
            }
            if (gender !== undefined) {
                fields.push('gender = ?');
                values.push(gender);
            }
            if (birthday !== undefined) {
                fields.push('birthday = ?');
                values.push(birthday);
            }
            if (avatar_color !== undefined) {
                fields.push('avatar_color = ?');
                values.push(avatar_color);
            }
            if (timezone !== undefined) {
                fields.push('timezone = ?');
                values.push(timezone);
            }

            if (fields.length === 0) {
                throw new Error('没有要更新的字段');
            }

            values.push(id);
            const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
            
            await query(sql, values);
            return await User.findById(id);
        } catch (error) {
            console.error('更新用户失败:', error);
            throw error;
        }
    }

    // 软删除用户
    static async deleteById(id) {
        const sql = 'UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        const result = await query(sql, [id]);
        return result.affectedRows > 0;
    }

    // 硬删除用户（慎用）
    static async hardDeleteById(id) {
        const sql = 'DELETE FROM users WHERE id = ?';
        const result = await query(sql, [id]);
        return result.affectedRows > 0;
    }

    // 创建默认用户设置
    static async createDefaultSettings(userId) {
        const sql = `
            INSERT INTO user_settings (user_id, notification_enabled, theme, language)
            VALUES (?, 1, 'light', 'zh-CN')
        `;
        await query(sql, [userId]);
    }

    // 获取用户设置
    static async getSettings(userId) {
        const sql = 'SELECT * FROM user_settings WHERE user_id = ?';
        const settings = await query(sql, [userId]);
        return settings.length > 0 ? settings[0] : null;
    }

    // 更新用户设置
    static async updateSettings(userId, settingsData) {
        const {
            notification_enabled,
            notification_time_advance,
            theme,
            language,
            week_start_day,
            settings_json
        } = settingsData;

        const fields = [];
        const values = [];

        if (notification_enabled !== undefined) {
            fields.push('notification_enabled = ?');
            values.push(notification_enabled);
        }
        if (notification_time_advance !== undefined) {
            fields.push('notification_time_advance = ?');
            values.push(notification_time_advance);
        }
        if (theme !== undefined) {
            fields.push('theme = ?');
            values.push(theme);
        }
        if (language !== undefined) {
            fields.push('language = ?');
            values.push(language);
        }
        if (week_start_day !== undefined) {
            fields.push('week_start_day = ?');
            values.push(week_start_day);
        }
        if (settings_json !== undefined) {
            fields.push('settings_json = ?');
            values.push(JSON.stringify(settings_json));
        }

        if (fields.length === 0) {
            throw new Error('没有要更新的设置');
        }

        values.push(userId);
        const sql = `UPDATE user_settings SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`;
        
        await query(sql, values);
        return await User.getSettings(userId);
    }

    // 验证用户数据（主入口）
    static validateUserData(userData, isUpdate = false) {
        const errors = [];

        // 基础字段验证
        this._validateRequiredFields(userData, isUpdate, errors);
        
        // 字段长度验证
        this._validateFieldLengths(userData, errors);
        
        // 格式验证
        this._validateFormats(userData, errors);
        
        // 枚举值和逻辑验证
        this._validateEnumsAndLogic(userData, errors);

        return errors;
    }

    // 验证必填字段
    static _validateRequiredFields(userData, isUpdate, errors) {
        if (!isUpdate && !userData.username) {
            errors.push('用户名不能为空');
        }

        if (!isUpdate && !userData.display_name) {
            errors.push('显示名称不能为空');
        }
    }

    // 验证字段长度
    static _validateFieldLengths(userData, errors) {
        if (userData.username && (userData.username.length < 2 || userData.username.length > 50)) {
            errors.push('用户名长度必须在2-50字符之间');
        }

        if (userData.display_name && (userData.display_name.length < 1 || userData.display_name.length > 100)) {
            errors.push('显示名称长度必须在1-100字符之间');
        }
    }

    // 验证格式
    static _validateFormats(userData, errors) {
        if (userData.email && userData.email.trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
            errors.push('邮箱格式不正确');
        }

        if (userData.phone && userData.phone.trim() !== '' && !/^1[3-9]\d{9}$/.test(userData.phone)) {
            errors.push('手机号格式不正确（应为11位数字，以1开头）');
        }

        if (userData.avatar_color && !/^#[0-9A-Fa-f]{6}$/.test(userData.avatar_color)) {
            errors.push('头像颜色格式不正确');
        }
    }

    // 验证枚举值和逻辑
    static _validateEnumsAndLogic(userData, errors) {
        if (userData.gender && !['male', 'female', 'other'].includes(userData.gender)) {
            errors.push('性别值不正确');
        }

        if (userData.birthday && new Date(userData.birthday) > new Date()) {
            errors.push('生日不能是未来日期');
        }
    }

    // 转换为安全的JSON对象（不包含敏感信息）
    toJSON() {
        return {
            id: this.id,
            username: this.username,
            display_name: this.display_name,
            email: this.email,
            phone: this.phone,
            gender: this.gender,
            birthday: this.birthday,
            avatar_color: this.avatar_color,
            timezone: this.timezone,
            created_at: this.created_at,
            updated_at: this.updated_at
        };
    }
}

module.exports = User;