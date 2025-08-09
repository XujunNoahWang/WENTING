#!/usr/bin/env node

// 集成测试运行器
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs').promises;

// 测试配置
const TEST_CONFIG = {
    timeout: 60000, // 60秒超时
    retries: 2,     // 失败重试次数
    parallel: false // 是否并行运行测试
};

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function colorLog(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

class IntegrationTestRunner {
    constructor() {
        this.testResults = {
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            duration: 0
        };
        this.failedTests = [];
    }
    
    async run() {
        colorLog('cyan', '🚀 开始运行用户关联功能集成测试套件');
        colorLog('blue', '=' .repeat(60));
        
        const startTime = Date.now();
        
        try {
            // 预检查
            await this.preCheck();
            
            // 运行测试
            await this.runTests();
            
            // 生成报告
            this.testResults.duration = Date.now() - startTime;
            await this.generateReport();
            
            // 退出码
            process.exit(this.testResults.failed > 0 ? 1 : 0);
            
        } catch (error) {
            colorLog('red', `💥 测试运行器错误: ${error.message}`);
            process.exit(1);
        }
    }
    
    async preCheck() {
        colorLog('yellow', '🔍 执行预检查...');
        
        // 检查数据库连接
        try {
            const { testConnection } = require('../config/sqlite');
            const connected = await testConnection();
            if (!connected) {
                throw new Error('数据库连接失败');
            }
            colorLog('green', '✅ 数据库连接正常');
        } catch (error) {
            throw new Error(`数据库预检查失败: ${error.message}`);
        }
        
        // 检查必要的服务
        const requiredServices = [
            '../services/linkService',
            '../services/dataSyncService',
            '../services/websocketService'
        ];
        
        for (const service of requiredServices) {
            try {
                require(service);
                colorLog('green', `✅ 服务加载成功: ${service}`);
            } catch (error) {
                throw new Error(`服务加载失败 ${service}: ${error.message}`);
            }
        }
        
        // 检查测试文件
        const testFiles = [
            '../tests/integration.test.js',
            '../tests/linkService.test.js'
        ];
        
        for (const testFile of testFiles) {
            try {
                const filePath = path.resolve(__dirname, testFile);
                await fs.access(filePath);
                colorLog('green', `✅ 测试文件存在: ${testFile}`);
            } catch (error) {
                throw new Error(`测试文件不存在: ${testFile}`);
            }
        }
        
        colorLog('green', '✅ 预检查完成');
    }
    
    async runTests() {
        colorLog('yellow', '🧪 开始执行测试...');
        
        const testSuites = [
            {
                name: '单元测试',
                file: '../tests/linkService.test.js',
                description: 'LinkService核心功能单元测试'
            },
            {
                name: '集成测试',
                file: '../tests/integration.test.js',
                description: '端到端集成测试和并发测试'
            }
        ];
        
        for (const suite of testSuites) {
            await this.runTestSuite(suite);
        }
    }
    
    async runTestSuite(suite) {
        colorLog('blue', `\n📋 运行测试套件: ${suite.name}`);
        colorLog('blue', `📄 描述: ${suite.description}`);
        colorLog('blue', '-'.repeat(50));
        
        const startTime = Date.now();
        let attempt = 0;
        let success = false;
        
        while (attempt <= TEST_CONFIG.retries && !success) {
            attempt++;
            
            if (attempt > 1) {
                colorLog('yellow', `🔄 重试第 ${attempt - 1} 次...`);
            }
            
            try {
                await this.executeTestFile(suite.file);
                success = true;
                this.testResults.passed++;
                
                const duration = Date.now() - startTime;
                colorLog('green', `✅ ${suite.name} 通过 (${duration}ms)`);
                
            } catch (error) {
                if (attempt > TEST_CONFIG.retries) {
                    this.testResults.failed++;
                    this.failedTests.push({
                        suite: suite.name,
                        error: error.message,
                        duration: Date.now() - startTime
                    });
                    
                    colorLog('red', `❌ ${suite.name} 失败: ${error.message}`);
                } else {
                    colorLog('yellow', `⚠️  ${suite.name} 第 ${attempt} 次尝试失败: ${error.message}`);
                }
            }
        }
        
        this.testResults.total++;
    }
    
    async executeTestFile(testFile) {
        return new Promise((resolve, reject) => {
            const filePath = path.resolve(__dirname, testFile);
            
            // 使用Node.js直接执行测试文件
            const testProcess = spawn('node', [filePath], {
                stdio: 'pipe',
                timeout: TEST_CONFIG.timeout
            });
            
            let stdout = '';
            let stderr = '';
            
            testProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                // 实时输出测试日志
                process.stdout.write(data);
            });
            
            testProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                process.stderr.write(data);
            });
            
            testProcess.on('close', (code) => {
                if (code === 0) {
                    resolve({ stdout, stderr });
                } else {
                    reject(new Error(`测试进程退出码: ${code}\n${stderr}`));
                }
            });
            
            testProcess.on('error', (error) => {
                reject(new Error(`测试进程错误: ${error.message}`));
            });
            
            // 超时处理
            setTimeout(() => {
                testProcess.kill('SIGTERM');
                reject(new Error('测试执行超时'));
            }, TEST_CONFIG.timeout);
        });
    }
    
    async generateReport() {
        colorLog('blue', '\n' + '='.repeat(60));
        colorLog('cyan', '📊 测试报告');
        colorLog('blue', '='.repeat(60));
        
        // 基本统计
        colorLog('bright', `总测试套件: ${this.testResults.total}`);
        colorLog('green', `通过: ${this.testResults.passed}`);
        colorLog('red', `失败: ${this.testResults.failed}`);
        colorLog('yellow', `跳过: ${this.testResults.skipped}`);
        colorLog('blue', `总耗时: ${this.testResults.duration}ms`);
        
        // 成功率
        const successRate = this.testResults.total > 0 
            ? ((this.testResults.passed / this.testResults.total) * 100).toFixed(2)
            : 0;
        
        if (successRate >= 90) {
            colorLog('green', `✅ 成功率: ${successRate}%`);
        } else if (successRate >= 70) {
            colorLog('yellow', `⚠️  成功率: ${successRate}%`);
        } else {
            colorLog('red', `❌ 成功率: ${successRate}%`);
        }
        
        // 失败详情
        if (this.failedTests.length > 0) {
            colorLog('red', '\n❌ 失败的测试:');
            this.failedTests.forEach((test, index) => {
                colorLog('red', `${index + 1}. ${test.suite}`);
                colorLog('red', `   错误: ${test.error}`);
                colorLog('red', `   耗时: ${test.duration}ms`);
            });
        }
        
        // 生成JSON报告
        await this.generateJSONReport();
        
        // 总结
        colorLog('blue', '\n' + '='.repeat(60));
        if (this.testResults.failed === 0) {
            colorLog('green', '🎉 所有测试通过！用户关联功能集成测试完成。');
        } else {
            colorLog('red', `💥 有 ${this.testResults.failed} 个测试失败，请检查上述错误信息。`);
        }
        colorLog('blue', '='.repeat(60));
    }
    
    async generateJSONReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: this.testResults,
            failedTests: this.failedTests,
            environment: {
                node: process.version,
                platform: process.platform,
                arch: process.arch
            }
        };
        
        try {
            const reportPath = path.resolve(__dirname, '../tests/integration-test-report.json');
            await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
            colorLog('blue', `📄 JSON报告已生成: ${reportPath}`);
        } catch (error) {
            colorLog('yellow', `⚠️  无法生成JSON报告: ${error.message}`);
        }
    }
}

// 主函数
async function main() {
    const runner = new IntegrationTestRunner();
    await runner.run();
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
    colorLog('red', `💥 未处理的Promise拒绝: ${reason}`);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    colorLog('red', `💥 未捕获的异常: ${error.message}`);
    process.exit(1);
});

// 信号处理
process.on('SIGINT', () => {
    colorLog('yellow', '\n⚠️  收到中断信号，正在清理...');
    process.exit(130);
});

process.on('SIGTERM', () => {
    colorLog('yellow', '\n⚠️  收到终止信号，正在清理...');
    process.exit(143);
});

// 如果直接运行此文件
if (require.main === module) {
    main().catch(error => {
        colorLog('red', `💥 运行器启动失败: ${error.message}`);
        process.exit(1);
    });
}

module.exports = { IntegrationTestRunner };