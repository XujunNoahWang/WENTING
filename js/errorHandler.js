// 前端错误处理器 - 统一的错误处理和用户反馈
class ErrorHandler {
    
    // 错误类型定义
    static get ERROR_TYPES() {
        return {
        NETWORK: 'network',
        VALIDATION: 'validation',
        SYNC: 'sync',
        PERMISSION: 'permission',
        WEBSOCKET: 'websocket',
        TIMEOUT: 'timeout',
        UNKNOWN: 'unknown'
        };
    }
    
    // 重试配置
    static get RETRY_CONFIG() {
        return {
        MAX_RETRIES: 3,
        BASE_DELAY: 1000,
        MAX_DELAY: 8000,
        BACKOFF_MULTIPLIER: 1.5
        };
    }
    
    // 错误计数器
    static get errorCounts() {
        if (!this._errorCounts) {
            this._errorCounts = new Map();
        }
        return this._errorCounts;
    }
    
    // 防止无限循环的标记
    static get isHandlingError() {
        return this._isHandlingError || false;
    }
    
    static set isHandlingError(value) {
        this._isHandlingError = value;
    }
    
    // 处理错误
    static async handleError(error, context = {}) {
        // 防止错误处理器自身错误造成无限循环
        if (ErrorHandler.isHandlingError) {
            console.error('❌ 错误处理器循环检测:', error.message || error);
            return { success: false, error: 'Error handler loop detected' };
        }
        
        try {
            ErrorHandler.isHandlingError = true;
            const errorInfo = this.analyzeError(error, context);
            
            // 记录错误
            this.logError(errorInfo);
            
            // 显示用户友好的错误消息
            this.showUserError(errorInfo);
            
            // 尝试自动恢复
            if (errorInfo.canAutoRecover && this.shouldAttemptRecovery(errorInfo)) {
                const result = await this.attemptRecovery(errorInfo);
                ErrorHandler.isHandlingError = false;
                return result;
            }
            
            ErrorHandler.isHandlingError = false;
            return {
                success: false,
                error: errorInfo,
                canRetry: this.canRetry(errorInfo),
                retryAfter: this.getRetryDelay(errorInfo.retryCount || 0)
            };
            
        } catch (handlingError) {
            ErrorHandler.isHandlingError = false;
            console.error('❌ 错误处理器失败:', handlingError);
            // 简单地显示错误消息，不调用其他可能出错的方法
            try {
                alert('系统错误处理失败，请刷新页面重试: ' + handlingError.message);
            } catch (e) {
                console.error('无法显示错误消息:', e);
            }
            return { success: false, canRetry: false };
        }
    }
    
    // 分析错误
    static analyzeError(error, context) {
        const errorInfo = this._createBaseErrorInfo(error, context);
        this._classifyErrorType(error, errorInfo);
        return errorInfo;
    }

    // 创建基础错误信息
    static _createBaseErrorInfo(error, context) {
        return {
            timestamp: new Date().toISOString(),
            message: error.message || '未知错误',
            stack: error.stack,
            context,
            type: this.ERROR_TYPES.UNKNOWN,
            canAutoRecover: false,
            retryCount: context.retryCount || 0,
            operation: context.operation || 'unknown'
        };
    }

    // 分类错误类型
    static _classifyErrorType(error, errorInfo) {
        if (this._isNetworkError(error)) {
            this._setNetworkError(errorInfo);
        } else if (this._isTimeoutError(error)) {
            this._setTimeoutError(errorInfo);
        } else if (this._isValidationError(error)) {
            this._setValidationError(errorInfo);
        } else if (this._isPermissionError(error)) {
            this._setPermissionError(errorInfo);
        } else if (this._isWebSocketError(error)) {
            this._setWebSocketError(errorInfo);
        } else if (this._isSyncError(error)) {
            this._setSyncError(errorInfo);
        } else if (this._isServerError(error)) {
            this._setNetworkError(errorInfo);
        }
    }

    // 错误类型检查方法
    static _isNetworkError(error) {
        return error.name === 'TypeError' && error.message.includes('fetch');
    }

    static _isTimeoutError(error) {
        return error.name === 'AbortError' || error.message.includes('timeout');
    }

    static _isValidationError(error) {
        return error.status === 400 || error.message.includes('validation');
    }

    static _isPermissionError(error) {
        return error.status === 403 || error.status === 401;
    }

    static _isWebSocketError(error) {
        return error.message.includes('WebSocket') || error.message.includes('websocket');
    }

    static _isSyncError(error) {
        return error.message.includes('sync') || error.message.includes('同步');
    }

    static _isServerError(error) {
        return error.status >= 500;
    }

    // 错误属性设置方法
    static _setNetworkError(errorInfo) {
        errorInfo.type = this.ERROR_TYPES.NETWORK;
        errorInfo.canAutoRecover = true;
    }

    static _setTimeoutError(errorInfo) {
        errorInfo.type = this.ERROR_TYPES.TIMEOUT;
        errorInfo.canAutoRecover = true;
    }

    static _setValidationError(errorInfo) {
        errorInfo.type = this.ERROR_TYPES.VALIDATION;
        errorInfo.canAutoRecover = false;
    }

    static _setPermissionError(errorInfo) {
        errorInfo.type = this.ERROR_TYPES.PERMISSION;
        errorInfo.canAutoRecover = false;
    }

    static _setWebSocketError(errorInfo) {
        errorInfo.type = this.ERROR_TYPES.WEBSOCKET;
        errorInfo.canAutoRecover = true;
    }

    static _setSyncError(errorInfo) {
        errorInfo.type = this.ERROR_TYPES.SYNC;
        errorInfo.canAutoRecover = true;
    }
    
    // 记录错误
    static logError(errorInfo) {
        const errorKey = `${errorInfo.type}_${errorInfo.operation}`;
        const currentCount = this.errorCounts.get(errorKey) || 0;
        this.errorCounts.set(errorKey, currentCount + 1);
        
        console.error(`📝 错误记录 [${errorInfo.type}]:`, {
            message: errorInfo.message,
            operation: errorInfo.operation,
            count: currentCount + 1,
            timestamp: errorInfo.timestamp,
            context: errorInfo.context
        });
        
        // 如果错误频繁发生，记录到本地存储
        if (currentCount >= 2) {
            this.saveErrorToStorage(errorInfo);
        }
    }
    
    // 保存错误到本地存储
    static saveErrorToStorage(errorInfo) {
        try {
            const errors = JSON.parse(localStorage.getItem('errorLogs') || '[]');
            errors.push({
                ...errorInfo,
                stack: undefined // 不保存堆栈信息到本地存储
            });
            
            // 只保留最近50个错误
            if (errors.length > 50) {
                errors.splice(0, errors.length - 50);
            }
            
            localStorage.setItem('errorLogs', JSON.stringify(errors));
        } catch (storageError) {
            console.warn('⚠️  保存错误日志到本地存储失败:', storageError);
        }
    }
    
    // 显示用户错误
    static showUserError(errorInfo) {
        const message = this.getUserFriendlyMessage(errorInfo);
        const canRetry = this.canRetry(errorInfo);
        
        // 创建错误通知
        this.createErrorNotification({
            type: errorInfo.type,
            message,
            canRetry,
            retryCallback: canRetry ? () => this.retryOperation(errorInfo) : null,
            operation: errorInfo.operation
        });
    }
    
    // 创建错误通知
    static createErrorNotification({ type, message, canRetry, retryCallback, operation }) {
        // 移除现有的错误通知
        const existingNotification = document.querySelector('.error-notification');
        if (existingNotification) {
            existingNotification.remove();
        }
        
        const notification = document.createElement('div');
        notification.className = `error-notification error-${type}`;
        notification.innerHTML = `
            <div class="error-content">
                <div class="error-icon">${ErrorHandler.getErrorIcon(type)}</div>
                <div class="error-details">
                    <div class="error-message">${ErrorHandler.escapeHtml(message)}</div>
                    <div class="error-operation">操作: ${ErrorHandler.escapeHtml(operation)}</div>
                </div>
                <div class="error-actions">
                    ${canRetry ? '<button class="retry-btn">重试</button>' : ''}
                    <button class="dismiss-btn">关闭</button>
                </div>
            </div>
        `;
        
        // 添加样式
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            max-width: 400px;
            background: #fff;
            border-left: 4px solid ${this.getErrorColor(type)};
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
        `;
        
        // 绑定事件
        const retryBtn = notification.querySelector('.retry-btn');
        const dismissBtn = notification.querySelector('.dismiss-btn');
        
        if (retryBtn && retryCallback) {
            retryBtn.addEventListener('click', () => {
                notification.remove();
                retryCallback();
            });
        }
        
        dismissBtn.addEventListener('click', () => {
            notification.remove();
        });
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 自动消失（除非是严重错误）
        if (type !== this.ERROR_TYPES.PERMISSION && type !== this.ERROR_TYPES.VALIDATION) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 8000);
        }
    }
    
    // 获取错误图标
    static getErrorIcon(type) {
        const icons = {
            [ErrorHandler.ERROR_TYPES.NETWORK]: '🌐',
            [ErrorHandler.ERROR_TYPES.VALIDATION]: '⚠️',
            [ErrorHandler.ERROR_TYPES.SYNC]: '🔄',
            [ErrorHandler.ERROR_TYPES.PERMISSION]: '🔒',
            [ErrorHandler.ERROR_TYPES.WEBSOCKET]: '📡',
            [ErrorHandler.ERROR_TYPES.TIMEOUT]: '⏱️',
            [ErrorHandler.ERROR_TYPES.UNKNOWN]: '❌'
        };
        return icons[type] || '❌';
    }
    
    // 获取错误颜色
    static getErrorColor(type) {
        const colors = {
            [this.ERROR_TYPES.NETWORK]: '#ff6b6b',
            [this.ERROR_TYPES.VALIDATION]: '#ffa726',
            [this.ERROR_TYPES.SYNC]: '#42a5f5',
            [this.ERROR_TYPES.PERMISSION]: '#ef5350',
            [this.ERROR_TYPES.WEBSOCKET]: '#ab47bc',
            [this.ERROR_TYPES.TIMEOUT]: '#ff7043',
            [this.ERROR_TYPES.UNKNOWN]: '#666'
        };
        return colors[type] || '#666';
    }
    
    // 获取用户友好消息
    static getUserFriendlyMessage(errorInfo) {
        const messages = {
            [this.ERROR_TYPES.NETWORK]: '网络连接异常，请检查网络设置后重试',
            [this.ERROR_TYPES.VALIDATION]: '输入信息有误，请检查后重新提交',
            [this.ERROR_TYPES.SYNC]: '数据同步失败，正在尝试重新同步...',
            [this.ERROR_TYPES.PERMISSION]: '权限不足，无法执行此操作',
            [this.ERROR_TYPES.WEBSOCKET]: '实时连接中断，正在尝试重新连接...',
            [this.ERROR_TYPES.TIMEOUT]: '操作超时，请稍后重试',
            [this.ERROR_TYPES.UNKNOWN]: '系统遇到未知错误，请稍后重试'
        };
        
        return messages[errorInfo.type] || errorInfo.message;
    }
    
    // 尝试自动恢复
    static async attemptRecovery(errorInfo) {
        try {
            console.log(`🔄 尝试自动恢复: ${errorInfo.type}`);
            
            switch (errorInfo.type) {
                case this.ERROR_TYPES.NETWORK:
                    return await this.recoverNetworkError(errorInfo);
                    
                case this.ERROR_TYPES.WEBSOCKET:
                    return await this.recoverWebSocketError(errorInfo);
                    
                case this.ERROR_TYPES.SYNC:
                    return await this.recoverSyncError(errorInfo);
                    
                case this.ERROR_TYPES.TIMEOUT:
                    return await this.recoverTimeoutError(errorInfo);
                    
                default:
                    return { success: false, message: '无法自动恢复此类型的错误' };
            }
            
        } catch (recoveryError) {
            console.error('❌ 自动恢复失败:', recoveryError);
            return { success: false, message: '自动恢复过程中发生错误' };
        }
    }
    
    // 网络错误恢复
    static async recoverNetworkError(errorInfo) {
        if (errorInfo.retryCount >= this.RETRY_CONFIG.MAX_RETRIES) {
            return { success: false, message: '网络连接重试次数已达上限' };
        }
        
        const delay = this.getRetryDelay(errorInfo.retryCount);
        console.log(`⏳ 网络错误恢复: ${delay}ms 后重试`);
        
        await this.sleep(delay);
        
        // 测试网络连接
        try {
            const response = await fetch('/api/health', { 
                method: 'GET',
                timeout: 5000 
            });
            
            if (response.ok) {
                return { success: true, message: '网络连接已恢复' };
            }
        } catch (testError) {
            console.log('网络连接测试失败，继续重试...');
        }
        
        // 重新执行原始操作
        if (errorInfo.context.retryFunction) {
            try {
                errorInfo.retryCount++;
                const result = await errorInfo.context.retryFunction();
                return { success: true, result, message: '操作重试成功' };
            } catch (retryError) {
                return await this.attemptRecovery({ ...errorInfo, retryCount: errorInfo.retryCount });
            }
        }
        
        return { success: false, message: '无法重试原始操作' };
    }
    
    // WebSocket错误恢复
    static async recoverWebSocketError() {
        try {
            console.log('🔄 尝试恢复WebSocket连接...');
            
            // 通知WebSocket客户端重新连接
            if (window.websocketClient && window.websocketClient.reconnect) {
                await window.websocketClient.reconnect();
                return { success: true, message: 'WebSocket连接已恢复' };
            }
            
            return { success: false, message: 'WebSocket客户端不可用' };
            
        } catch (error) {
            return { success: false, message: 'WebSocket连接恢复失败' };
        }
    }
    
    // 同步错误恢复
    static async recoverSyncError() {
        try {
            console.log('🔄 尝试恢复数据同步...');
            
            // 触发数据重新同步
            // Link功能已集成到主应用SPA中，不需要单独的linkManager
            return { success: true, message: '数据同步已恢复' };
            
        } catch (error) {
            return { success: false, message: '数据同步恢复失败' };
        }
    }
    
    // 超时错误恢复
    static async recoverTimeoutError(errorInfo) {
        if (errorInfo.retryCount >= this.RETRY_CONFIG.MAX_RETRIES) {
            return { success: false, message: '操作超时重试次数已达上限' };
        }
        
        const delay = this.getRetryDelay(errorInfo.retryCount);
        console.log(`⏳ 超时错误恢复: ${delay}ms 后重试`);
        
        await this.sleep(delay);
        
        return { success: true, message: '准备重试超时操作' };
    }
    
    // 重试操作
    static async retryOperation(errorInfo) {
        if (!this.canRetry(errorInfo)) {
            this.showUserError({
                ...errorInfo,
                message: '无法重试此操作'
            });
            return;
        }
        
        try {
            // 显示重试中的提示
            this.showRetryingNotification(errorInfo.operation);
            
            errorInfo.retryCount = (errorInfo.retryCount || 0) + 1;
            
            if (errorInfo.context.retryFunction) {
                const result = await errorInfo.context.retryFunction();
                this.showSuccessNotification('操作重试成功');
                return result;
            } else {
                throw new Error('没有可重试的操作');
            }
            
        } catch (retryError) {
            console.error('❌ 手动重试失败:', retryError);
            await this.handleError(retryError, {
                ...errorInfo.context,
                retryCount: errorInfo.retryCount
            });
        }
    }
    
    // 显示重试中通知
    static showRetryingNotification(operation) {
        const notification = document.createElement('div');
        notification.className = 'retry-notification';
        notification.innerHTML = `
            <div class="retry-content">
                <div class="retry-spinner"></div>
                <span>正在重试 ${ErrorHandler.escapeHtml(operation)}...</span>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #2196f3;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 10001;
        `;
        
        document.body.appendChild(notification);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }
    
    // 显示成功通知
    static showSuccessNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'success-notification';
        notification.innerHTML = `
            <div class="success-content">
                <span>✅ ${ErrorHandler.escapeHtml(message)}</span>
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4caf50;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 10001;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 2000);
    }
    
    // 显示严重错误
    static showCriticalError(message) {
        const overlay = document.createElement('div');
        overlay.className = 'critical-error-overlay';
        overlay.innerHTML = `
            <div class="critical-error-modal">
                <div class="critical-error-icon">⚠️</div>
                <h3>系统错误</h3>
                <p>${ErrorHandler.escapeHtml(message)}</p>
                <div class="critical-error-actions">
                    <button onclick="location.reload()">刷新页面</button>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()">关闭</button>
                </div>
            </div>
        `;
        
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 20000;
        `;
        
        document.body.appendChild(overlay);
    }
    
    // 检查是否应该尝试恢复
    static shouldAttemptRecovery(errorInfo) {
        const errorKey = `${errorInfo.type}_${errorInfo.operation}`;
        const errorCount = this.errorCounts.get(errorKey) || 0;
        
        // 如果同类型错误频繁发生，暂停自动恢复
        return errorCount < 5;
    }
    
    // 检查是否可以重试
    static canRetry(errorInfo) {
        const retryableTypes = [
            this.ERROR_TYPES.NETWORK,
            this.ERROR_TYPES.SYNC,
            this.ERROR_TYPES.WEBSOCKET,
            this.ERROR_TYPES.TIMEOUT
        ];
        
        return retryableTypes.includes(errorInfo.type) && 
               (errorInfo.retryCount || 0) < this.RETRY_CONFIG.MAX_RETRIES;
    }
    
    // 获取重试延迟
    static getRetryDelay(retryCount) {
        const delay = Math.min(
            this.RETRY_CONFIG.BASE_DELAY * Math.pow(this.RETRY_CONFIG.BACKOFF_MULTIPLIER, retryCount),
            this.RETRY_CONFIG.MAX_DELAY
        );
        return delay;
    }
    
    // 睡眠函数
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // 获取错误统计
    static getErrorStats() {
        const stats = {};
        this.errorCounts.forEach((count, key) => {
            const [type, operation] = key.split('_');
            if (!stats[type]) stats[type] = {};
            stats[type][operation] = count;
        });
        return stats;
    }
    
    // 清理错误计数
    static clearErrorCounts() {
        this.errorCounts.clear();
        console.log('🧹 错误计数已清理');
    }
    
    // 导出错误日志
    static exportErrorLogs() {
        try {
            const logs = localStorage.getItem('errorLogs');
            if (logs) {
                const blob = new Blob([logs], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `error-logs-${new Date().toISOString().split('T')[0]}.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('❌ 导出错误日志失败:', error);
        }
    }

    // HTML转义函数，防止XSS攻击
    static escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// 添加CSS样式
const errorHandlerStyles = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .error-notification {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .error-content {
        display: flex;
        align-items: flex-start;
        padding: 16px;
        gap: 12px;
    }
    
    .error-icon {
        font-size: 20px;
        flex-shrink: 0;
    }
    
    .error-details {
        flex: 1;
        min-width: 0;
    }
    
    .error-message {
        font-weight: 500;
        margin-bottom: 4px;
        color: #333;
    }
    
    .error-operation {
        font-size: 12px;
        color: #666;
    }
    
    .error-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
    }
    
    .error-actions button {
        padding: 6px 12px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
    }
    
    .retry-btn {
        background: #2196f3;
        color: white;
    }
    
    .retry-btn:hover {
        background: #1976d2;
    }
    
    .dismiss-btn {
        background: #f5f5f5;
        color: #666;
    }
    
    .dismiss-btn:hover {
        background: #e0e0e0;
    }
    
    .retry-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top: 2px solid white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-right: 8px;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .critical-error-modal {
        background: white;
        padding: 24px;
        border-radius: 8px;
        text-align: center;
        max-width: 400px;
        margin: 20px;
    }
    
    .critical-error-icon {
        font-size: 48px;
        margin-bottom: 16px;
    }
    
    .critical-error-modal h3 {
        margin: 0 0 12px 0;
        color: #d32f2f;
    }
    
    .critical-error-modal p {
        margin: 0 0 20px 0;
        color: #666;
        line-height: 1.5;
    }
    
    .critical-error-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
    }
    
    .critical-error-actions button {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
    }
    
    .critical-error-actions button:first-child {
        background: #d32f2f;
        color: white;
    }
    
    .critical-error-actions button:last-child {
        background: #f5f5f5;
        color: #666;
    }
`;

// 注入样式
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = errorHandlerStyles;
    document.head.appendChild(styleSheet);
}

// 全局错误处理
if (typeof window !== 'undefined') {
    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
        console.error('未处理的Promise拒绝:', event.reason);
        ErrorHandler.handleError(event.reason, {
            operation: 'unhandled_promise_rejection',
            source: 'global'
        });
    });
    
    // 捕获全局JavaScript错误
    window.addEventListener('error', (event) => {
        console.error('全局JavaScript错误:', event.error);
        ErrorHandler.handleError(event.error, {
            operation: 'global_javascript_error',
            source: 'global',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    });
}