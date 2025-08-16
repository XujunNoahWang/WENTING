/**
 * 对话框工具类 - 替换原生alert/confirm的友好UI组件
 * 使用现有的modal样式系统
 */
class DialogUtils {
    /**
     * 显示信息对话框 (替换alert)
     * @param {string} message - 消息内容
     * @param {string} title - 标题 (可选)
     * @param {string} type - 类型: 'info'|'success'|'warning'|'error'
     * @returns {Promise<void>}
     */
    static showAlert(message, title = '提示', type = 'info') {
        return new Promise((resolve) => {
            const existingModal = document.querySelector('.alert-modal');
            if (existingModal) {
                existingModal.remove();
            }

            const iconMap = {
                info: '💡',
                success: '✅',
                warning: '⚠️',
                error: '❌'
            };

            const colorMap = {
                info: '#1d9bf0',
                success: '#17bf63',
                warning: '#ffad1f',
                error: '#f91880'
            };

            const modal = document.createElement('div');
            modal.className = 'modal-overlay alert-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 style="color: ${colorMap[type]}; display: flex; align-items: center; gap: 8px;">
                            <span>${iconMap[type]}</span>
                            ${title}
                        </h3>
                    </div>
                    <div style="padding: 0 20px 20px 20px;">
                        <p style="margin: 0; line-height: 1.5; color: #14171a;">${message}</p>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-primary" style="background: ${colorMap[type]}; color: white; border: none;">确定</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const confirmBtn = modal.querySelector('.btn-primary');
            const closeModal = () => {
                modal.remove();
                resolve();
            };

            confirmBtn.addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });

            // ESC键关闭
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escHandler);
                    closeModal();
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    }

    /**
     * 显示确认对话框 (替换confirm)
     * @param {string} message - 消息内容
     * @param {string} title - 标题 (可选)
     * @param {Object} options - 选项
     * @param {string} options.confirmText - 确认按钮文本
     * @param {string} options.cancelText - 取消按钮文本
     * @param {string} options.type - 类型: 'warning'|'danger'|'info'
     * @returns {Promise<boolean>}
     */
    static showConfirm(message, title = '确认操作', options = {}) {
        const {
            confirmText = '确定',
            cancelText = '取消',
            type = 'warning'
        } = options;

        return new Promise((resolve) => {
            const existingModal = document.querySelector('.confirm-modal');
            if (existingModal) {
                existingModal.remove();
            }

            const iconMap = {
                warning: '⚠️',
                danger: '🚨',
                info: '❓'
            };

            const colorMap = {
                warning: '#ffad1f',
                danger: '#f91880',
                info: '#1d9bf0'
            };

            const modal = document.createElement('div');
            modal.className = 'modal-overlay confirm-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 style="color: ${colorMap[type]}; display: flex; align-items: center; gap: 8px;">
                            <span>${iconMap[type]}</span>
                            ${title}
                        </h3>
                    </div>
                    <div style="padding: 0 20px 20px 20px;">
                        <p style="margin: 0; line-height: 1.5; color: #14171a;">${message}</p>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-cancel" style="background: #f7f9fa; color: #657786; border: 1px solid #e1e8ed;">${cancelText}</button>
                        <button class="btn-confirm" style="background: ${colorMap[type]}; color: white; border: none;">${confirmText}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            const confirmBtn = modal.querySelector('.btn-confirm');
            const cancelBtn = modal.querySelector('.btn-cancel');
            
            const closeModal = (result) => {
                modal.remove();
                resolve(result);
            };

            confirmBtn.addEventListener('click', () => closeModal(true));
            cancelBtn.addEventListener('click', () => closeModal(false));
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal(false);
            });

            // ESC键取消
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escHandler);
                    closeModal(false);
                }
            };
            document.addEventListener('keydown', escHandler);
        });
    }

    /**
     * 显示成功消息
     */
    static showSuccess(message, title = '成功') {
        return this.showAlert(message, title, 'success');
    }

    /**
     * 显示错误消息
     */
    static showError(message, title = '错误') {
        return this.showAlert(message, title, 'error');
    }

    /**
     * 显示警告消息
     */
    static showWarning(message, title = '警告') {
        return this.showAlert(message, title, 'warning');
    }

    /**
     * 显示删除确认对话框
     */
    static showDeleteConfirm(itemName = '此项', message = null) {
        const defaultMessage = `确定要删除${itemName}吗？此操作无法撤销。`;
        return this.showConfirm(
            message || defaultMessage,
            '确认删除',
            {
                confirmText: '删除',
                cancelText: '取消',
                type: 'danger'
            }
        );
    }
}

// 导出给其他模块使用
window.DialogUtils = DialogUtils;