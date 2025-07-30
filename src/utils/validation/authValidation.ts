import { VALIDATION_RULES } from '@constants/index';

/**
 * Validate email address
 */
export const validateEmail = (email: string): boolean => {
  return VALIDATION_RULES.EMAIL.PATTERN.test(email.trim());
};

/**
 * Validate phone number
 */
export const validatePhone = (phone: string): boolean => {
  return VALIDATION_RULES.PHONE.PATTERN.test(phone.trim());
};

/**
 * Validate password strength
 */
export const validatePassword = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const rules = VALIDATION_RULES.PASSWORD;

  if (password.length < rules.MIN_LENGTH) {
    errors.push(`密码至少需要${rules.MIN_LENGTH}位字符`);
  }

  if (rules.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('密码需要包含至少一个大写字母');
  }

  if (rules.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('密码需要包含至少一个小写字母');
  }

  if (rules.REQUIRE_NUMBERS && !/\d/.test(password)) {
    errors.push('密码需要包含至少一个数字');
  }

  if (rules.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('密码需要包含至少一个特殊字符');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate password confirmation
 */
export const validatePasswordConfirmation = (password: string, confirmation: string): boolean => {
  return password === confirmation && password.length > 0;
};

/**
 * Validate full name
 */
export const validateFullName = (name: string): boolean => {
  const trimmedName = name.trim();
  return trimmedName.length >= 2 && trimmedName.length <= 50;
};

/**
 * Validate SMS verification code
 */
export const validateVerificationCode = (code: string): boolean => {
  return /^\d{6}$/.test(code.trim());
};

/**
 * Validate required field
 */
export const validateRequired = (value: string): boolean => {
  return value.trim().length > 0;
};

/**
 * Comprehensive form validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export const validateLoginForm = (data: {
  email?: string;
  phone?: string;
  password: string;
}): ValidationResult => {
  const errors: Record<string, string> = {};

  // Validate identifier (email or phone)
  if (data.email) {
    if (!validateRequired(data.email)) {
      errors.email = '请输入邮箱地址';
    } else if (!validateEmail(data.email)) {
      errors.email = '请输入有效的邮箱地址';
    }
  } else if (data.phone) {
    if (!validateRequired(data.phone)) {
      errors.phone = '请输入手机号';
    } else if (!validatePhone(data.phone)) {
      errors.phone = '请输入有效的手机号';
    }
  } else {
    errors.identifier = '请输入邮箱或手机号';
  }

  // Validate password
  if (!validateRequired(data.password)) {
    errors.password = '请输入密码';
  } else if (data.password.length < 6) {
    errors.password = '密码至少需要6位字符';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateRegisterForm = (data: {
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  confirmPassword: string;
}): ValidationResult => {
  const errors: Record<string, string> = {};

  // Validate full name
  if (!validateRequired(data.fullName)) {
    errors.fullName = '请输入姓名';
  } else if (!validateFullName(data.fullName)) {
    errors.fullName = '姓名长度需要在2-50个字符之间';
  }

  // Validate identifier (email or phone)
  if (data.email) {
    if (!validateEmail(data.email)) {
      errors.email = '请输入有效的邮箱地址';
    }
  } else if (data.phone) {
    if (!validatePhone(data.phone)) {
      errors.phone = '请输入有效的手机号';
    }
  } else {
    errors.identifier = '请输入邮箱或手机号';
  }

  // Validate password
  const passwordValidation = validatePassword(data.password);
  if (!passwordValidation.isValid) {
    errors.password = passwordValidation.errors[0]; // Show first error
  }

  // Validate password confirmation
  if (!validatePasswordConfirmation(data.password, data.confirmPassword)) {
    errors.confirmPassword = '两次输入的密码不一致';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateForgotPasswordForm = (data: {
  email?: string;
  phone?: string;
}): ValidationResult => {
  const errors: Record<string, string> = {};

  if (data.email) {
    if (!validateRequired(data.email)) {
      errors.email = '请输入邮箱地址';
    } else if (!validateEmail(data.email)) {
      errors.email = '请输入有效的邮箱地址';
    }
  } else if (data.phone) {
    if (!validateRequired(data.phone)) {
      errors.phone = '请输入手机号';
    } else if (!validatePhone(data.phone)) {
      errors.phone = '请输入有效的手机号';
    }
  } else {
    errors.identifier = '请输入邮箱或手机号';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};