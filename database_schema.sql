-- 文婷1.0 数据库设计
-- 创建数据库
CREATE DATABASE IF NOT EXISTS wenting_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE wenting_db;

-- 用户表
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名（支持中文）',
    display_name VARCHAR(100) NOT NULL COMMENT '显示名称',
    email VARCHAR(100) UNIQUE COMMENT '邮箱',
    phone VARCHAR(20) COMMENT '手机号',
    gender ENUM('male', 'female', 'other') COMMENT '性别',
    birthday DATE COMMENT '生日',
    avatar_color VARCHAR(7) DEFAULT '#1d9bf0' COMMENT '头像颜色',
    timezone VARCHAR(50) DEFAULT 'Asia/Shanghai' COMMENT '时区',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE COMMENT '账户是否激活'
);

-- 重复规则表
CREATE TABLE repeat_patterns (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pattern_type ENUM('none', 'daily', 'weekly', 'monthly', 'custom') NOT NULL DEFAULT 'none',
    interval_value INT DEFAULT 1 COMMENT '间隔值，如每2天、每3周',
    days_of_week JSON COMMENT '一周中的哪几天 [0,1,2,3,4,5,6]',
    days_of_month JSON COMMENT '一月中的哪几天 [1,2,3,...,31]',
    end_type ENUM('never', 'after', 'on_date') DEFAULT 'never',
    end_after_count INT COMMENT '重复次数',
    end_date DATE COMMENT '结束日期',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TODO项目表
CREATE TABLE todos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL COMMENT 'TODO标题',
    description TEXT COMMENT '详细描述/备注',
    reminder_time TIME COMMENT '提醒时间（如08:00）',
    reminder_type ENUM('specific_time', 'all_day', 'before_meal', 'after_meal') DEFAULT 'all_day',
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    category VARCHAR(50) COMMENT '分类（如健康、学习等）',
    repeat_pattern_id INT COMMENT '重复模式ID',
    start_date DATE NOT NULL COMMENT '开始日期',
    due_date DATE COMMENT '截止日期',
    estimated_duration INT COMMENT '预计用时（分钟）',
    emoji VARCHAR(10) COMMENT 'emoji图标',
    color VARCHAR(7) COMMENT '颜色标识',
    is_template BOOLEAN DEFAULT FALSE COMMENT '是否为模板',
    sort_order INT DEFAULT 0 COMMENT '排序',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (repeat_pattern_id) REFERENCES repeat_patterns(id) ON DELETE SET NULL,
    INDEX idx_user_date (user_id, start_date),
    INDEX idx_reminder (reminder_time, reminder_type)
);

-- TODO完成记录表
CREATE TABLE todo_completions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    todo_id INT NOT NULL,
    user_id INT NOT NULL,
    completion_date DATE NOT NULL,
    completion_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT COMMENT '完成时的备注',
    mood ENUM('great', 'good', 'okay', 'bad') COMMENT '完成时的心情',
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_completion (todo_id, completion_date),
    INDEX idx_user_date (user_id, completion_date)
);

-- 用户设置表
CREATE TABLE user_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    notification_enabled BOOLEAN DEFAULT TRUE,
    notification_time_advance INT DEFAULT 10 COMMENT '提前提醒分钟数',
    theme VARCHAR(20) DEFAULT 'light',
    language VARCHAR(10) DEFAULT 'zh-CN',
    week_start_day INT DEFAULT 1 COMMENT '周开始日（0=周日，1=周一）',
    settings_json JSON COMMENT '其他设置的JSON存储',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 家庭组表（可选，用于家庭成员管理）
CREATE TABLE families (
    id INT PRIMARY KEY AUTO_INCREMENT,
    family_name VARCHAR(100) NOT NULL,
    created_by INT NOT NULL,
    invite_code VARCHAR(10) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 家庭成员关系表
CREATE TABLE family_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    family_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('admin', 'member') DEFAULT 'member',
    relationship VARCHAR(50) COMMENT '关系（如父亲、母亲、孩子）',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_family_user (family_id, user_id)
);

-- 插入示例数据
INSERT INTO users (username, display_name, email, phone, gender, birthday, avatar_color) VALUES
('dad', 'Dad', 'dad@example.com', '13800138001', 'male', '1980-05-15', '#1d9bf0'),
('mom', 'Mom', 'mom@example.com', '13800138002', 'female', '1985-08-20', '#e91e63'),
('kid', 'Kid', 'kid@example.com', NULL, 'other', '2010-12-10', '#ff9800');

-- 插入重复模式示例
INSERT INTO repeat_patterns (pattern_type, interval_value, end_type) VALUES
('daily', 1, 'never'),  -- 每日
('weekly', 1, 'never'),  -- 每周
('none', 1, 'never');    -- 不重复

-- 插入示例TODO
INSERT INTO todos (user_id, title, description, reminder_time, reminder_type, repeat_pattern_id, start_date, emoji) VALUES
(1, '早上吃鱼肝油', '帮助降低肌酐，分多次饮用', '08:00', 'specific_time', 1, CURDATE(), '🐟'),
(1, '吃一粒善存', '', '09:00', 'after_meal', 1, CURDATE(), '💊'),
(2, '进行10分钟冥想', '可以使用冥想app引导', '07:00', 'specific_time', 1, CURDATE(), '🧘‍♀️'),
(3, '吃维生素D', '', '09:00', 'after_meal', 1, CURDATE(), '🌞');

-- 创建视图：用户TODO概览
CREATE VIEW user_todos_overview AS
SELECT 
    u.id as user_id,
    u.display_name,
    t.id as todo_id,
    t.title,
    t.description,
    t.reminder_time,
    t.start_date,
    t.emoji,
    rp.pattern_type,
    CASE 
        WHEN tc.completion_date IS NOT NULL THEN TRUE 
        ELSE FALSE 
    END as is_completed_today
FROM users u
LEFT JOIN todos t ON u.id = t.user_id AND t.is_deleted = FALSE
LEFT JOIN repeat_patterns rp ON t.repeat_pattern_id = rp.id
LEFT JOIN todo_completions tc ON t.id = tc.todo_id AND tc.completion_date = CURDATE()
WHERE u.is_active = TRUE
ORDER BY u.id, t.sort_order, t.reminder_time;