const express = require('express');
const bcrypt = require('bcrypt');
const { query } = require('../config/sqlite');
const router = express.Router();

// 密码加密的盐值轮数
const SALT_ROUNDS = 12;

// 用户名验证函数
function validateUsername(username) {
    if (!username || typeof username !== 'string') {
        return '用户名不能为空';
    }
    
    // 检查格式：只允许小写字母和数字
    const regex = /^[a-z0-9]+$/;
    if (!regex.test(username)) {
        return '用户名只能包含小写字母和数字';
    }
    
    // 检查长度
    if (username.length === 0) {
        return '用户名不能为空';
    }
    
    if (username.length > 10) {
        return '用户名不能超过10个字符';
    }
    
    return null;
}

// 密码验证函数
function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return '密码不能为空';
    }
    
    if (password.length < 6) {
        return '密码至少需要6个字符';
    }
    
    if (password.length > 100) {
        return '密码不能超过100个字符';
    }
    
    return null;
}

// 注册路由
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('📝 注册请求:', { username: username ? `${username.substring(0, 3)}***` : 'undefined' });
        
        // 验证用户名格式
        const usernameError = validateUsername(username);
        if (usernameError) {
            return res.status(400).json({
                success: false,
                message: usernameError
            });
        }
        
        // 验证密码
        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({
                success: false,
                message: passwordError
            });
        }
        
        // 转换为小写
        const normalizedUsername = username.toLowerCase().trim();
        
        // 检查用户名是否已存在
        const existingUser = await query(
            'SELECT username FROM app_users WHERE username = ?',
            [normalizedUsername]
        );
        
        if (existingUser.length > 0) {
            return res.status(409).json({
                success: false,
                message: '用户名已存在，请选择其他用户名'
            });
        }
        
        // 加密密码
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        
        // 创建新用户
        await query(
            'INSERT INTO app_users (username, password_hash) VALUES (?, ?)',
            [normalizedUsername, passwordHash]
        );
        
        console.log('✅ 用户注册成功:', normalizedUsername);
        
        res.status(201).json({
            success: true,
            message: '注册成功',
            data: {
                username: normalizedUsername,
                created_at: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ 注册失败:', error);
        
        // 检查是否是数据库约束错误
        if (error.message && error.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({
                success: false,
                message: '用户名已存在，请选择其他用户名'
            });
        }
        
        res.status(500).json({
            success: false,
            message: '服务器内部错误，请稍后再试'
        });
    }
});

// 登录路由
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        console.log('🔐 登录请求:', { username: username ? `${username.substring(0, 3)}***` : 'undefined' });
        
        // 验证输入
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名和密码不能为空'
            });
        }
        
        // 转换为小写
        const normalizedUsername = username.toLowerCase().trim();
        
        // 查找用户
        const users = await query(
            'SELECT username, password_hash, created_at FROM app_users WHERE username = ?',
            [normalizedUsername]
        );
        
        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }
        
        const user = users[0];
        
        // 验证密码
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }
        
        console.log('✅ 用户登录成功:', normalizedUsername);
        
        res.json({
            success: true,
            message: '登录成功',
            data: {
                username: user.username,
                created_at: user.created_at
            }
        });
        
    } catch (error) {
        console.error('❌ 登录失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误，请稍后再试'
        });
    }
});

// 验证登录状态路由
router.get('/verify', async (req, res) => {
    try {
        const { username } = req.query;
        
        if (!username) {
            return res.status(400).json({
                success: false,
                message: '缺少用户名参数'
            });
        }
        
        // 查找用户
        const users = await query(
            'SELECT username, created_at FROM app_users WHERE username = ?',
            [username.toLowerCase().trim()]
        );
        
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        res.json({
            success: true,
            data: {
                username: users[0].username,
                created_at: users[0].created_at
            }
        });
        
    } catch (error) {
        console.error('❌ 验证用户状态失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

// 获取用户信息路由（用于Profile页面）
router.get('/profile/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        if (!username) {
            return res.status(400).json({
                success: false,
                message: '用户名不能为空'
            });
        }
        
        // 查找用户
        const users = await query(
            'SELECT username, created_at FROM app_users WHERE username = ?',
            [username.toLowerCase().trim()]
        );
        
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        const user = users[0];
        
        // 获取管理的用户详细信息
        const managedUsers = await query(`
            SELECT id, username, display_name, is_active, supervised_app_user, is_linked
            FROM users 
            WHERE app_user_id = ? AND is_active = 1
            ORDER BY created_at ASC
        `, [user.username]);
        
        // 获取每个用户的笔记数量
        const userNotesCounts = await query(`
            SELECT u.id, u.display_name, COUNT(n.id) as notes_count
            FROM users u 
            LEFT JOIN notes n ON u.id = n.user_id 
            WHERE u.app_user_id = ? AND u.is_active = 1
            GROUP BY u.id, u.display_name
            ORDER BY u.created_at ASC
        `, [user.username]);
        
        // 获取任务统计（简化版）
        const activeTodoCount = await query(`
            SELECT COUNT(*) as count 
            FROM todos t 
            JOIN users u ON t.user_id = u.id 
            WHERE u.app_user_id = ? AND t.is_active = 1
        `, [user.username]);
        
        const deletedTodoCount = await query(`
            SELECT COUNT(*) as count 
            FROM todos t 
            JOIN users u ON t.user_id = u.id 
            WHERE u.app_user_id = ? AND t.is_active = 0
        `, [user.username]);
        
        const totalTodoCount = await query(`
            SELECT COUNT(*) as count 
            FROM todos t 
            JOIN users u ON t.user_id = u.id 
            WHERE u.app_user_id = ?
        `, [user.username]);
        
        const repeatTodoCount = await query(`
            SELECT COUNT(*) as count 
            FROM todos t 
            JOIN users u ON t.user_id = u.id 
            WHERE u.app_user_id = ? AND t.is_active = 1 AND t.repeat_type != 'none'
        `, [user.username]);
        
        const oneTimeTodoCount = await query(`
            SELECT COUNT(*) as count 
            FROM todos t 
            JOIN users u ON t.user_id = u.id 
            WHERE u.app_user_id = ? AND t.is_active = 1 AND t.repeat_type = 'none'
        `, [user.username]);
        
        // 计算总笔记数
        const totalNotesCount = userNotesCounts.reduce((sum, user) => sum + user.notes_count, 0);
        
        res.json({
            success: true,
            data: {
                username: user.username,
                created_at: user.created_at,
                // 管理的用户列表
                managed_users: managedUsers,
                // 用户笔记统计
                user_notes: userNotesCounts,
                // 简化的统计数据
                stats: {
                    // 任务统计
                    active_todos: activeTodoCount[0].count,
                    deleted_todos: deletedTodoCount[0].count,
                    total_todos: totalTodoCount[0].count,
                    repeat_todos: repeatTodoCount[0].count,
                    onetime_todos: oneTimeTodoCount[0].count,
                    
                    // 笔记统计
                    total_notes: totalNotesCount
                }
            }
        });
        
    } catch (error) {
        console.error('❌ 获取用户信息失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

// 获取用户的设备信息（用于设备ID同步）
router.get('/device-info/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        if (!username) {
            return res.status(400).json({
                success: false,
                message: '用户名不能为空'
            });
        }
        
        // 从users表中获取该注册用户的设备ID（取任意一个被管理用户的设备ID）
        const users = await query(
            'SELECT device_id FROM users WHERE app_user_id = ? AND is_active = TRUE LIMIT 1',
            [username.toLowerCase().trim()]
        );
        
        if (users.length > 0) {
            res.json({
                success: true,
                data: {
                    device_id: users[0].device_id
                }
            });
        } else {
            // 如果没有被管理用户，返回null
            res.json({
                success: true,
                data: {
                    device_id: null
                }
            });
        }
        
    } catch (error) {
        console.error('❌ 获取用户设备信息失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

// 更新用户的设备ID（用于设备ID同步）
router.post('/update-device-id', async (req, res) => {
    try {
        const { app_user_id, device_id } = req.body;
        
        if (!app_user_id || !device_id) {
            return res.status(400).json({
                success: false,
                message: '注册用户ID和设备ID不能为空'
            });
        }
        
        // 更新该注册用户下所有被管理用户的设备ID
        const result = await query(
            'UPDATE users SET device_id = ? WHERE app_user_id = ?',
            [device_id, app_user_id.toLowerCase().trim()]
        );
        
        console.log(`✅ 已更新用户 ${app_user_id} 的设备ID为 ${device_id}，影响 ${result.affectedRows} 条记录`);
        
        res.json({
            success: true,
            message: '设备ID更新成功',
            data: {
                affected_rows: result.affectedRows
            }
        });
        
    } catch (error) {
        console.error('❌ 更新设备ID失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

module.exports = router;