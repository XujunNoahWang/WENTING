import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS, FONTS, SPACING } from '@constants/index';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}) => {
  const buttonStyle = [
    styles.button,
    styles[variant],
    styles[size],
    fullWidth && styles.fullWidth,
    disabled && styles.disabled,
    style,
  ];

  const titleStyle = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText,
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' ? COLORS.PRIMARY : COLORS.SURFACE}
        />
      ) : (
        <Text style={titleStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
  
  // Variants
  primary: {
    backgroundColor: COLORS.PRIMARY,
  },
  secondary: {
    backgroundColor: COLORS.SECONDARY,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
  },
  danger: {
    backgroundColor: COLORS.ERROR,
  },
  
  // Sizes
  small: {
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    minHeight: 36,
  },
  medium: {
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    minHeight: 44,
  },
  large: {
    paddingHorizontal: SPACING.XL,
    paddingVertical: SPACING.LG,
    minHeight: 52,
  },
  
  // Disabled state
  disabled: {
    backgroundColor: COLORS.DISABLED,
    borderColor: COLORS.DISABLED,
  },
  
  // Text styles
  text: {
    fontFamily: FONTS.BOLD,
    textAlign: 'center',
  },
  
  // Text variants
  primaryText: {
    color: COLORS.SURFACE,
  },
  secondaryText: {
    color: COLORS.SURFACE,
  },
  outlineText: {
    color: COLORS.PRIMARY,
  },
  dangerText: {
    color: COLORS.SURFACE,
  },
  
  // Text sizes
  smallText: {
    fontSize: FONTS.SIZES.SMALL,
  },
  mediumText: {
    fontSize: FONTS.SIZES.MEDIUM,
  },
  largeText: {
    fontSize: FONTS.SIZES.LARGE,
  },
  
  disabledText: {
    color: COLORS.TEXT_SECONDARY,
  },
});

export default Button;