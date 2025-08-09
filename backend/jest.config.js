// Jest测试配置
module.exports = {
    // 测试环境
    testEnvironment: 'node',
    
    // 测试文件匹配模式
    testMatch: [
        '**/tests/**/*.test.js',
        '**/__tests__/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],
    
    // 忽略的文件和目录
    testPathIgnorePatterns: [
        '/node_modules/',
        '/build/',
        '/dist/'
    ],
    
    // 覆盖率收集
    collectCoverage: false,
    collectCoverageFrom: [
        'services/**/*.js',
        'routes/**/*.js',
        'middleware/**/*.js',
        '!**/node_modules/**',
        '!**/tests/**',
        '!**/scripts/**'
    ],
    
    // 覆盖率报告格式
    coverageReporters: [
        'text',
        'lcov',
        'html',
        'json'
    ],
    
    // 覆盖率输出目录
    coverageDirectory: 'coverage',
    
    // 覆盖率阈值
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },
    
    // 测试超时时间（毫秒）
    testTimeout: 30000,
    
    // 设置文件
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    
    // 全局变量
    globals: {
        'TEST_ENV': true
    },
    
    // 模块路径映射
    moduleNameMapping: {
        '^@/(.*)$': '<rootDir>/$1',
        '^@services/(.*)$': '<rootDir>/services/$1',
        '^@routes/(.*)$': '<rootDir>/routes/$1',
        '^@middleware/(.*)$': '<rootDir>/middleware/$1',
        '^@config/(.*)$': '<rootDir>/config/$1'
    },
    
    // 详细输出
    verbose: true,
    
    // 静默模式（设为false显示详细日志）
    silent: false,
    
    // 测试结果处理器
    reporters: [
        'default',
        ['jest-html-reporters', {
            publicPath: './test-reports',
            filename: 'integration-test-report.html',
            expand: true
        }]
    ],
    
    // 并行测试
    maxWorkers: '50%',
    
    // 测试前后钩子
    globalSetup: '<rootDir>/tests/globalSetup.js',
    globalTeardown: '<rootDir>/tests/globalTeardown.js'
};