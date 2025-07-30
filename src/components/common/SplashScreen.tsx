import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { COLORS, FONTS, SPACING } from '@constants/index';

const { width, height } = Dimensions.get('window');

const SplashScreen: React.FC = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* App Logo - Replace with actual logo */}
        <View style={styles.logoPlaceholder}>
          <Text style={styles.logoText}>💊</Text>
        </View>
        
        <Text style={styles.appName}>WENTING</Text>
        <Text style={styles.tagline}>守护全家健康</Text>
      </Animated.View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>智能家庭健康管理</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: height * 0.1,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.LG,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  logoText: {
    fontSize: 48,
  },
  appName: {
    fontSize: FONTS.SIZES.XLARGE * 1.5,
    fontFamily: FONTS.BOLD,
    color: COLORS.SURFACE,
    marginBottom: SPACING.SM,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SURFACE,
    opacity: 0.9,
  },
  footer: {
    position: 'absolute',
    bottom: height * 0.1,
    alignItems: 'center',
  },
  footerText: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.SURFACE,
    opacity: 0.7,
  },
});

export default SplashScreen;