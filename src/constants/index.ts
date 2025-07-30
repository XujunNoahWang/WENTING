// App Constants
export const APP_CONFIG = {
  NAME: 'WENTING',
  VERSION: '1.0.0',
  BUILD_NUMBER: 1,
  DESCRIPTION: '家庭健康监督应用',
};

// API Constants
export const API_ENDPOINTS = {
  WEATHER: 'https://api.openweathermap.org/data/2.5',
  GOOGLE_CALENDAR: 'https://www.googleapis.com/calendar/v3',
  GEMINI: 'https://generativelanguage.googleapis.com/v1beta',
};

// Database Constants
export const DATABASE_CONFIG = {
  NAME: 'wenting.db',
  LOCATION: 'default',
  VERSION: 1,
  TABLE_NAMES: {
    USERS: 'users',
    HOUSEHOLDS: 'households',
    HOUSEHOLD_MEMBERS: 'household_members',
    HEALTH_RECORDS: 'health_records',
    REMINDERS: 'reminders',
    HEALTH_CALENDAR: 'health_calendar',
    AUDIT_LOGS: 'audit_logs',
  },
};

// Security Constants
export const SECURITY_CONFIG = {
  ENCRYPTION: {
    ALGORITHM: 'AES-256-GCM',
    KEY_DERIVATION: 'PBKDF2',
    SALT_LENGTH: 32,
    IV_LENGTH: 16,
    ITERATIONS: 100000,
  },
  AUTHENTICATION: {
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  },
  BIOMETRIC: {
    REASON: '请使用生物识别验证身份以访问健康数据',
    FALLBACK_TITLE: '使用密码',
    CANCEL_TITLE: '取消',
  },
};

// Health Record Constants
export const HEALTH_RECORD_TYPES = {
  MEDICATION: 'medication',
  DIAGNOSIS: 'diagnosis',
  ALLERGY: 'allergy',
  VACCINATION: 'vaccination',
  VITAL_SIGNS: 'vital_signs',
  LAB_RESULT: 'lab_result',
  MEDICAL_HISTORY: 'medical_history',
} as const;

export const MEDICATION_FREQUENCIES = [
  { label: '每日一次', value: 'daily_once' },
  { label: '每日两次', value: 'daily_twice' },
  { label: '每日三次', value: 'daily_thrice' },
  { label: '每周一次', value: 'weekly_once' },
  { label: '每月一次', value: 'monthly_once' },
  { label: '根据需要', value: 'as_needed' },
  { label: '自定义', value: 'custom' },
];

// Reminder Constants
export const REMINDER_TYPES = {
  MEDICATION: 'medication',
  APPOINTMENT: 'appointment',
  HEALTH_TIP: 'health_tip',
  CHECKUP: 'checkup',
  CUSTOM: 'custom',
} as const;

export const REMINDER_FREQUENCIES = [
  { label: '一次性', value: 'once' },
  { label: '每日', value: 'daily' },
  { label: '每周', value: 'weekly' },
  { label: '每月', value: 'monthly' },
  { label: '自定义', value: 'custom' },
];

// Calendar Constants
export const APPOINTMENT_TYPES = {
  CHECKUP: 'checkup',
  FOLLOW_UP: 'follow_up',
  PROCEDURE: 'procedure',
  CONSULTATION: 'consultation',
  EMERGENCY: 'emergency',
} as const;

// Permission Constants
export const PERMISSIONS = {
  CAMERA: 'camera',
  STORAGE: 'storage',
  NOTIFICATIONS: 'notifications',
  LOCATION: 'location',
} as const;

// Role Constants
export const USER_ROLES = {
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

// Validation Constants
export const VALIDATION_RULES = {
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL_CHARS: false,
  },
  PHONE: {
    PATTERN: /^[+]?[\d\s\-\(\)]{10,}$/,
  },
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
};

// UI Constants
export const COLORS = {
  PRIMARY: '#007AFF',
  SECONDARY: '#5AC8FA',
  SUCCESS: '#34C759',
  WARNING: '#FF9500',
  ERROR: '#FF3B30',
  BACKGROUND: '#F2F2F7',
  SURFACE: '#FFFFFF',
  TEXT_PRIMARY: '#000000',
  TEXT_SECONDARY: '#8E8E93',
  BORDER: '#C6C6C8',
  DISABLED: '#8E8E93',
};

export const FONTS = {
  REGULAR: 'System',
  BOLD: 'System',
  LIGHT: 'System',
  SIZES: {
    SMALL: 12,
    MEDIUM: 16,
    LARGE: 20,
    XLARGE: 24,
  },
};

export const SPACING = {
  XS: 4,
  SM: 8,
  MD: 16,
  LG: 24,
  XL: 32,
  XXL: 48,
};

// Animation Constants
export const ANIMATIONS = {
  DURATION: {
    SHORT: 200,
    MEDIUM: 300,
    LONG: 500,
  },
  EASING: {
    EASE_IN: 'ease-in',
    EASE_OUT: 'ease-out',
    EASE_IN_OUT: 'ease-in-out',
  },
};

// Storage Keys
export const STORAGE_KEYS = {
  USER_TOKEN: 'user_token',
  USER_DATA: 'user_data',
  BIOMETRIC_ENABLED: 'biometric_enabled',
  LANGUAGE_PREFERENCE: 'language_preference',
  THEME_PREFERENCE: 'theme_preference',
  NOTIFICATION_SETTINGS: 'notification_settings',
  ONBOARDING_COMPLETED: 'onboarding_completed',
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接错误，请检查网络设置',
  AUTH_FAILED: '身份验证失败',
  INVALID_CREDENTIALS: '用户名或密码错误',
  BIOMETRIC_NOT_AVAILABLE: '生物识别功能不可用',
  CAMERA_PERMISSION_DENIED: '需要相机权限才能拍照',
  STORAGE_PERMISSION_DENIED: '需要存储权限才能保存文件',
  GENERIC_ERROR: '发生未知错误，请重试',
  VALIDATION_ERROR: '输入数据验证失败',
  DATABASE_ERROR: '数据库操作失败',
  ENCRYPTION_ERROR: '数据加密失败',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  RECORD_SAVED: '健康档案保存成功',
  REMINDER_SET: '提醒设置成功',
  PROFILE_UPDATED: '个人资料更新成功',
  INVITATION_SENT: '邀请发送成功',
  HOUSEHOLD_CREATED: '家庭创建成功',
  LOGIN_SUCCESS: '登录成功',
  LOGOUT_SUCCESS: '退出登录成功',
};

// Feature Flags (for v2.0 features)
export const FEATURE_FLAGS = {
  MARKETPLACE_ENABLED: false,
  DEVICE_INTEGRATION_ENABLED: false,
  EXTERNAL_PROVIDER_ACCESS: false,
  ADVANCED_ANALYTICS: false,
  TELEMEDICINE: false,
};

// Image Constants
export const IMAGE_CONFIG = {
  MAX_WIDTH: 1200,
  MAX_HEIGHT: 1600,
  QUALITY: 0.8,
  FORMAT: 'JPEG',
};

// Notification Constants
export const NOTIFICATION_CHANNELS = {
  MEDICATIONS: {
    id: 'medications',
    name: '用药提醒',
    description: '药物服用提醒通知',
    importance: 'high',
  },
  APPOINTMENTS: {
    id: 'appointments',
    name: '预约提醒',
    description: '医疗预约提醒通知',
    importance: 'high',
  },
  HEALTH_TIPS: {
    id: 'health_tips',
    name: '健康建议',
    description: '个性化健康建议通知',
    importance: 'default',
  },
  GENERAL: {
    id: 'general',
    name: '一般通知',
    description: '应用一般通知',
    importance: 'default',
  },
};

export default {
  APP_CONFIG,
  API_ENDPOINTS,
  DATABASE_CONFIG,
  SECURITY_CONFIG,
  COLORS,
  FONTS,
  SPACING,
  STORAGE_KEYS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  FEATURE_FLAGS,
};