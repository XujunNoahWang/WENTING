// 工具函数
const Utils = {
    // DOM选择器 - 单个元素
    $: (selector) => {
        return document.querySelector(selector);
    },

    // DOM选择器 - 多个元素
    $$: (selector) => {
        return Array.from(document.querySelectorAll(selector));
    },

    // 格式化日期
    formatDate: (date) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        return {
            month: months[date.getMonth()],
            date: date.getDate(),
            weekday: weekdays[date.getDay()],
            full: `${months[date.getMonth()]} ${date.getDate()}`
        };
    },

    // 计算日期范围
    calculateDateRange: (periodText) => {
        const now = new Date();
        let endDate = new Date(now);
        
        if (periodText.includes('周')) {
            const weeks = parseInt(periodText);
            endDate.setDate(now.getDate() + weeks * 7 - 1);
        } else if (periodText.includes('个月')) {
            const months_count = parseInt(periodText);
            endDate.setMonth(now.getMonth() + months_count);
            endDate.setDate(now.getDate() - 1);
        } else {
            return ''; // 对于"每日"等不需要显示日期范围
        }
        
        const startMonth = now.getMonth() + 1;
        const startDay = now.getDate();
        const endMonth = endDate.getMonth() + 1;
        const endDay = endDate.getDate();
        
        return `${startMonth}/${startDay}-${endMonth}/${endDay}`;
    },

    // 生成唯一ID
    generateId: () => {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    },

    // 防抖函数
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // 深拷贝
    deepClone: (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => Utils.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    clonedObj[key] = Utils.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    },

    // 节流函数
    throttle: (func, limit) => {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // HTML转义函数，防止XSS攻击
    escapeHtml: (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// 导出到全局
window.Utils = Utils;