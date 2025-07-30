import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAppDispatch, useAppSelector, selectAuthLoading, selectAuthError } from '@store/index';
import { signInWithEmail, signInWithGoogle, clearError } from '@store/slices/authSlice';

// Components
import Input from '@components/common/Input';
import Button from '@components/common/Button';

// Constants
import { COLORS, FONTS, SPACING } from '@constants/index';

// Utils
import { validateEmail, validatePassword } from '@utils/validation/authValidation';

const LoginScreen: React.FC = () => {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector(selectAuthLoading);
  const authError = useAppSelector(selectAuthError);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    
    // Clear auth error
    if (authError) {
      dispatch(clearError());
    }
  };

  const validateForm = (): boolean => {
    const newErrors = {
      email: '',
      password: '',
    };

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = '请输入邮箱地址';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = '请输入有效的邮箱地址';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = '请输入密码';
    } else if (formData.password.length < 6) {
      newErrors.password = '密码至少需要6位字符';
    }

    setErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== '');
  };

  const handleEmailLogin = async () => {
    if (!validateForm()) return;

    try {
      await dispatch(signInWithEmail({
        email: formData.email,
        password: formData.password,
      })).unwrap();
      
      // Navigation handled by RootNavigator based on auth state
    } catch (error: any) {
      Alert.alert('登录失败', error || '请检查您的邮箱和密码');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await dispatch(signInWithGoogle()).unwrap();
    } catch (error: any) {
      Alert.alert('Google登录失败', error || 'Google登录过程中出现错误');
    }
  };

  const handlePhoneLogin = () => {
    navigation.navigate('PhoneVerification' as never);
  };

  const handleRegister = () => {
    navigation.navigate('Register' as never);
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword' as never);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>💊</Text>
          </View>
          <Text style={styles.title}>WENTING</Text>
          <Text style={styles.subtitle}>守护全家健康</Text>
        </View>

        {/* Login Form */}
        <View style={styles.form}>
          <Input
            label="邮箱地址"
            placeholder="请输入您的邮箱"
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            error={errors.email}
            leftIcon="mail-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            required
          />

          <Input
            label="密码"
            placeholder="请输入您的密码"
            value={formData.password}
            onChangeText={(value) => handleInputChange('password', value)}
            error={errors.password}
            leftIcon="lock-closed-outline"
            secureTextEntry
            required
          />

          {authError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{authError}</Text>
            </View>
          )}

          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>忘记密码？</Text>
          </TouchableOpacity>

          <Button
            title="登录"
            onPress={handleEmailLogin}
            loading={isLoading}
            fullWidth
            style={styles.loginButton}
          />

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>或</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Alternative Login Methods */}
          <Button
            title="使用Google登录"
            onPress={handleGoogleLogin}
            variant="outline"
            fullWidth
            style={styles.socialButton}
          />

          <Button
            title="使用手机号登录"
            onPress={handlePhoneLogin}
            variant="secondary"
            fullWidth
            style={styles.socialButton}
          />
        </View>

        {/* Register Link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            还没有账户？
            <Text style={styles.registerLink} onPress={handleRegister}>
              {' '}立即注册
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACING.LG,
  },
  header: {
    alignItems: 'center',
    paddingTop: SPACING.XXL,
    paddingBottom: SPACING.XL,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.MD,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  logo: {
    fontSize: 32,
  },
  title: {
    fontSize: FONTS.SIZES.XLARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.XS,
  },
  subtitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
  },
  form: {
    flex: 1,
    paddingVertical: SPACING.LG,
  },
  errorContainer: {
    backgroundColor: COLORS.ERROR + '15',
    borderColor: COLORS.ERROR,
    borderWidth: 1,
    borderRadius: 8,
    padding: SPACING.MD,
    marginBottom: SPACING.MD,
  },
  errorText: {
    color: COLORS.ERROR,
    fontSize: FONTS.SIZES.SMALL,
    textAlign: 'center',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: SPACING.LG,
  },
  forgotPasswordText: {
    color: COLORS.PRIMARY,
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
  },
  loginButton: {
    marginBottom: SPACING.LG,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.LG,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.BORDER,
  },
  dividerText: {
    marginHorizontal: SPACING.MD,
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONTS.SIZES.SMALL,
  },
  socialButton: {
    marginBottom: SPACING.MD,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.LG,
  },
  footerText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
  },
  registerLink: {
    color: COLORS.PRIMARY,
    fontFamily: FONTS.BOLD,
  },
});

export default LoginScreen;