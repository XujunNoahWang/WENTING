const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { initTodoDatabase } = require('./scripts/init-todo-db');

// 导入路由
const usersRouter = require('./routes/users');
const todosRouter = require('./routes/todos');
const notesRouter = require('./routes/notes');

// 导入WebSocket服务
const websocketService = require('./services/websocketService');

const app = express();
const PORT = process.env.PORT || 3001;

// 安全中间件
app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            scriptSrcAttr: ["'unsafe-inline'"],  // 允许内联事件处理器
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https:", "http:", "wss:", "ws:"],
            fontSrc: ["'self'", "data:", "https:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'self'"]
        },
    },
}));

// 压缩响应
app.use(compression());

// CORS配置
app.use(cors({
    origin: function(origin, callback) {
        // 允许没有origin的请求（比如直接打开HTML文件）
        if (!origin) return callback(null, true);
        
        // 允许的origins列表
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://192.168.3.5:3000',
            'http://192.168.3.5:3001'
        ];
        
        // 检查环境变量中的自定义origin
        if (process.env.CORS_ORIGIN) {
            allowedOrigins.push(process.env.CORS_ORIGIN);
        }
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(null, true); // 在开发环境中允许所有origins
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID']
}));

// 速率限制 - 开发环境使用更宽松的限制
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1分钟
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // 限制每个IP 1分钟内最多1000个请求
    message: {
        success: false,
        message: '请求过于频繁，请稍后再试'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// 只在生产环境启用速率限制
if (process.env.NODE_ENV === 'production') {
    app.use('/api', limiter);
}

// 解析JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志中间件
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`${timestamp} - ${req.method} ${req.path} - ${req.ip}`);
    next();
});

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: '服务运行正常',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// 静态文件服务 - 服务前端文件
app.use(express.static('../', {
    setHeaders: (res, path) => {
        // 为JS文件设置正确的MIME类型
        if (path.endsWith('.js')) {
            res.set('Content-Type', 'application/javascript');
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
        // 为CSS文件设置正确的MIME类型
        if (path.endsWith('.css')) {
            res.set('Content-Type', 'text/css');
        }
        // 为HTML文件设置正确的MIME类型
        if (path.endsWith('.html')) {
            res.set('Content-Type', 'text/html');
        }
        // 为favicon设置正确的MIME类型
        if (path.endsWith('favicon.ico')) {
            res.set('Content-Type', 'image/x-icon');
        }
    }
}));

// API路由
app.use('/api/users', usersRouter);
app.use('/api/todos', todosRouter);
app.use('/api/notes', notesRouter);

// 根路径
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '雯婷 API服务',
        version: '1.0.0',
        endpoints: {
            users: '/api/users',
            todos: '/api/todos',
            notes: '/api/notes',
            patterns: '/api/patterns',
            health: '/health'
        },
        documentation: '请查看README.md获取API文档'
    });
});

// 404处理
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `路径 ${req.originalUrl} 不存在`,
        availableEndpoints: [
            '/api/users',
            '/api/todos',
            '/api/patterns',
            '/health'
        ]
    });
});

// 全局错误处理中间件
app.use((err, req, res, next) => {
    console.error('全局错误:', err);
    
    // 数据库连接错误
    if (err.code === 'ECONNREFUSED' || err.code === 'ER_ACCESS_DENIED_ERROR') {
        return res.status(503).json({
            success: false,
            message: '数据库连接失败，请稍后再试'
        });
    }
    
    // JSON解析错误
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            message: '请求数据格式错误'
        });
    }
    
    // 默认服务器错误
    res.status(500).json({
        success: false,
        message: '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? err.message : '请联系管理员'
    });
});

// 检查数据库表是否存在的函数
async function checkTablesExist() {
    try {
        const { query } = require('./config/database');
        
        // 检查 users 表是否存在
        const result = await query("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
        return result.length > 0;
    } catch (error) {
        console.error('❌ 检查数据库表时出错:', error);
        return false;
    }
}

// 启动服务器
async function startServer() {
    try {
        // 测试数据库连接
        console.log('🔄 正在测试数据库连接...');
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.error('❌ 数据库连接失败，服务器启动中止');
            process.exit(1);
        }
        
        // 检查数据库表是否存在，如果不存在则自动初始化
        console.log('🔄 正在检查数据库表...');
        const tablesExist = await checkTablesExist();
        
        if (!tablesExist) {
            console.log('⚠️  数据库表不存在，正在自动初始化数据库...');
            try {
                await initTodoDatabase(true); // 保留数据模式，只创建缺失的表
                console.log('✅ 数据库自动初始化完成');
            } catch (initError) {
                console.error('❌ 数据库自动初始化失败:', initError);
                process.exit(1);
            }
        } else {
            console.log('✅ 数据库表检查通过');
        }
        
        // 启动HTTP服务器，监听所有网络接口
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log('🚀 雯婷 API服务器启动成功');
            console.log(`📡 服务地址: http://localhost:${PORT}`);
            console.log(`📱 局域网地址: http://192.168.3.5:${PORT}`);
            console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
            console.log(`📊 健康检查: http://localhost:${PORT}/health`);
            console.log(`📚 API文档: http://localhost:${PORT}/api`);
            console.log('✅ 服务器准备就绪');
        });

        // 初始化WebSocket服务
        console.log('🔄 正在初始化WebSocket服务...');
        websocketService.init(server);
        console.log(`🔌 WebSocket地址: ws://localhost:${PORT}/ws`);
        console.log(`📱 WebSocket局域网: ws://192.168.3.5:${PORT}/ws`);
        
        // 优雅关闭
        const gracefulShutdown = (signal) => {
            console.log(`\n📥 收到 ${signal} 信号，开始优雅关闭...`);
            
            server.close((err) => {
                if (err) {
                    console.error('❌ 关闭HTTP服务器时出错:', err);
                    process.exit(1);
                }
                
                console.log('✅ HTTP服务器已关闭');
                console.log('👋 再见！');
                process.exit(0);
            });
        };
        
        // 监听关闭信号
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
        // 捕获未处理的Promise拒绝
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ 未处理的Promise拒绝:', reason);
            console.error('在Promise:', promise);
        });
        
        // 捕获未捕获的异常
        process.on('uncaughtException', (error) => {
            console.error('❌ 未捕获的异常:', error);
            process.exit(1);
        });
        
    } catch (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
    }
}

// 启动服务器
startServer();

module.exports = app;