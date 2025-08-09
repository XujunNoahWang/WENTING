// 测试错误处理系统
const ErrorHandlingService = require('../services/errorHandlingService');
const DataSyncService = require('../services/dataSyncService');
const { createErrorTables } = require('./create-error-logs-table');

async function testErrorHandling() {
    try {
        console.log('🧪 开始测试错误处理系统...');
        
        // 1. 创建必要的表
        console.log('\n📋 1. 创建错误处理表...');
        await createErrorTables();
        
        // 2. 测试网络错误处理
        console.log('\n🌐 2. 测试网络错误处理...');
        const networkError = new Error('网络连接失败');
        networkError.code = 'ECONNREFUSED';
        
        const networkResult = await ErrorHandlingService.handleError(networkError, {
            operation: 'testNetworkOperation',
            userId: 'test_user',
            retryCount: 0
        });
        
        console.log('网络错误处理结果:', {
            success: networkResult.success,
            canRetry: networkResult.canRetry,
            userMessage: networkResult.userMessage
        });
        
        // 3. 测试验证错误处理
        console.log('\n⚠️  3. 测试验证错误处理...');
        const validationError = new Error('输入参数无效');
        validationError.code = 'VALIDATION_ERROR';
        
        const validationResult = await ErrorHandlingService.handleError(validationError, {
            operation: 'testValidationOperation',
            userId: 'test_user'
        });
        
        console.log('验证错误处理结果:', {
            success: validationResult.success,
            canRetry: validationResult.canRetry,
            userMessage: validationResult.userMessage
        });
        
        // 4. 测试同步错误处理
        console.log('\n🔄 4. 测试同步错误处理...');
        const syncError = new Error('数据同步失败');
        syncError.code = 'SYNC_FAILED';
        
        const syncResult = await ErrorHandlingService.handleError(syncError, {
            operation: 'testSyncOperation',
            userId: 'test_user',
            retryCount: 1
        });
        
        console.log('同步错误处理结果:', {
            success: syncResult.success,
            canRetry: syncResult.canRetry,
            userMessage: syncResult.userMessage
        });
        
        // 5. 测试数据库错误处理
        console.log('\n💾 5. 测试数据库错误处理...');
        const dbError = new Error('数据库连接超时');
        dbError.code = 'SQLITE_BUSY';
        
        const dbResult = await ErrorHandlingService.handleError(dbError, {
            operation: 'testDatabaseOperation',
            userId: 'test_user'
        });
        
        console.log('数据库错误处理结果:', {
            success: dbResult.success,
            canRetry: dbResult.canRetry,
            userMessage: dbResult.userMessage
        });
        
        // 6. 测试同步队列
        console.log('\n📝 6. 测试同步队列...');
        await DataSyncService.addToSyncQueue('todo_sync', {
            operation: 'create',
            todoData: { id: 1, title: '测试TODO' },
            link: { manager_app_user: 'user1', linked_app_user: 'user2' },
            originalUserId: 123
        }, '测试错误消息');
        
        console.log('✅ 同步队列测试项目已添加');
        
        // 7. 获取错误统计
        console.log('\n📊 7. 获取错误统计...');
        const errorStats = await ErrorHandlingService.getErrorStats('24h');
        console.log('错误统计:', errorStats);
        
        // 8. 获取同步统计
        console.log('\n📈 8. 获取同步统计...');
        const syncStats = await DataSyncService.getSyncStats();
        console.log('同步统计:', syncStats);
        
        // 9. 测试重试机制
        console.log('\n🔁 9. 测试重试机制...');
        let retryCount = 0;
        const maxRetries = 3;
        
        const testRetryFunction = async () => {
            retryCount++;
            console.log(`  尝试第 ${retryCount} 次...`);
            
            if (retryCount < maxRetries) {
                throw new Error(`重试测试失败 (${retryCount}/${maxRetries})`);
            }
            
            return { success: true, message: '重试成功' };
        };
        
        const retryError = new Error('重试测试错误');
        const retryResult = await ErrorHandlingService.handleError(retryError, {
            operation: 'testRetryOperation',
            userId: 'test_user',
            retryFunction: testRetryFunction
        });
        
        console.log('重试机制测试结果:', {
            success: retryResult.success,
            finalRetryCount: retryCount
        });
        
        // 10. 测试错误恢复
        console.log('\n🔧 10. 测试错误恢复...');
        const recoverableError = new Error('可恢复的网络错误');
        recoverableError.code = 'ENOTFOUND';
        
        const recoveryResult = await ErrorHandlingService.handleError(recoverableError, {
            operation: 'testRecoveryOperation',
            userId: 'test_user',
            retryFunction: async () => {
                console.log('  执行恢复操作...');
                return { success: true, message: '恢复成功' };
            }
        });
        
        console.log('错误恢复测试结果:', {
            success: recoveryResult.success,
            message: recoveryResult.userMessage
        });
        
        console.log('\n✅ 错误处理系统测试完成');
        
        // 最终统计
        const finalStats = await ErrorHandlingService.getErrorStats('24h');
        console.log('\n📋 最终错误统计:');
        console.log(`  - 总错误数: ${finalStats.total}`);
        finalStats.breakdown.forEach(item => {
            console.log(`  - ${item.error_type}(${item.severity}): ${item.count} 次`);
        });
        
    } catch (error) {
        console.error('❌ 测试错误处理系统失败:', error);
        throw error;
    }
}

// 测试错误处理服务的各种方法
async function testErrorHandlingMethods() {
    try {
        console.log('\n🔬 测试错误处理服务方法...');
        
        // 测试错误分析
        const testError = new Error('测试错误消息');
        testError.code = 'TEST_ERROR';
        
        const errorInfo = ErrorHandlingService.analyzeError(testError, {
            operation: 'testOperation',
            userId: 'test_user'
        });
        
        console.log('错误分析结果:', {
            type: errorInfo.type,
            severity: errorInfo.severity,
            canAutoRecover: errorInfo.canAutoRecover
        });
        
        // 测试用户友好消息
        const userMessage = ErrorHandlingService.getUserFriendlyMessage(errorInfo);
        console.log('用户友好消息:', userMessage);
        
        // 测试重试检查
        const canRetry = ErrorHandlingService.canRetry(errorInfo);
        console.log('可以重试:', canRetry);
        
        // 测试重试延迟计算
        const retryDelay = ErrorHandlingService.getRetryDelay(2);
        console.log('重试延迟 (第3次):', retryDelay, 'ms');
        
        console.log('✅ 错误处理服务方法测试完成');
        
    } catch (error) {
        console.error('❌ 测试错误处理服务方法失败:', error);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    testErrorHandling()
        .then(() => testErrorHandlingMethods())
        .then(() => {
            console.log('\n🎉 所有测试完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 测试失败:', error);
            process.exit(1);
        });
}

module.exports = { testErrorHandling, testErrorHandlingMethods };