import React, { useState, useEffect } from 'react';
import { View, StatusBar, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { firebaseWebAuthService } from '../config/firebase-web';
import { performanceMonitor } from '../utils/performance/PerformanceMonitor';
import { COLORS } from '../constants/colors';
import { FirebaseUser } from '../types/appTypes';

// Screen Components
import AuthScreen from './auth/AuthScreen';
import FamilyScreen from './household/FamilyScreen';
import HealthScreen from './health/HealthScreen';
import CalendarScreen from './calendar/CalendarScreen';
import SettingsScreen from './settings/SettingsScreen';
import HealthRecordDetailScreen from './health/HealthRecordDetailScreen';

const MainScreen: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState('login');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [screenData, setScreenData] = useState<any>(null);

  useEffect(() => {
    initializeFirebase();
  }, []);

  const initializeFirebase = async () => {
    const startTime = Date.now();
    
    try {
      const initialized = await firebaseWebAuthService.initialize();
      if (initialized) {
        console.log('Firebase Web 服务初始化成功');
        
        const unsubscribe = firebaseWebAuthService.onAuthStateChanged((user) => {
          if (user) {
            console.log('用户认证状态变化:', user);
            setUser(user);
            setIsLoggedIn(true);
            setCurrentScreen('home');
          } else {
            setUser(null);
            setIsLoggedIn(false);
            setCurrentScreen('login');
          }
        });

        const endTime = Date.now();
        performanceMonitor.recordMetric('firebase_initialization', endTime - startTime);

        return unsubscribe;
      } else {
        console.error('Firebase Web 服务初始化失败');
      }
    } catch (error) {
      console.error('初始化过程中发生错误:', error);
    }
  };

  const handleLogin = (userData: FirebaseUser) => {
    setUser(userData);
    setIsLoggedIn(true);
    setCurrentScreen('home');
  };

  const handleLogout = () => {
    setUser(null);
    setIsLoggedIn(false);
    setCurrentScreen('login');
  };

  const handleNavigate = (screen: string, data?: any) => {
    setCurrentScreen(screen);
    setScreenData(data);
  };

  const renderCurrentScreen = () => {
    if (!isLoggedIn) {
      return <AuthScreen onLogin={handleLogin} />;
    }

    if (!user) {
      return <AuthScreen onLogin={handleLogin} />;
    }

    switch (currentScreen) {
      case 'home':
        return (
          <View style={styles.homeContainer}>
            <View style={styles.header}>
              <View>
                <Text style={styles.welcomeText}>欢迎回来</Text>
                <Text style={styles.userNameText}>{user.fullName || user.displayName || '用户'}</Text>
              </View>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutButtonText}>退出</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.menuSection}>
              <Text style={styles.sectionTitle}>功能菜单</Text>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleNavigate('health')}
              >
                <Text style={styles.menuItemIcon}>🏥</Text>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>健康记录</Text>
                  <Text style={styles.menuItemSubtitle}>管理家庭成员的健康档案</Text>
                </View>
                <Text style={styles.menuItemArrow}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleNavigate('family')}
              >
                <Text style={styles.menuItemIcon}>👨‍👩‍👧‍👦</Text>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>家庭管理</Text>
                  <Text style={styles.menuItemSubtitle}>管理家庭成员和权限</Text>
                </View>
                <Text style={styles.menuItemArrow}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleNavigate('calendar')}
              >
                <Text style={styles.menuItemIcon}>📅</Text>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>健康日历</Text>
                  <Text style={styles.menuItemSubtitle}>查看体检和复查安排</Text>
                </View>
                <Text style={styles.menuItemArrow}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleNavigate('settings')}
              >
                <Text style={styles.menuItemIcon}>⚙️</Text>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>设置</Text>
                  <Text style={styles.menuItemSubtitle}>个人设置和应用配置</Text>
                </View>
                <Text style={styles.menuItemArrow}>→</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      case 'family':
        return (
          <FamilyScreen 
            user={user} 
            onNavigate={handleNavigate}
          />
        );
      case 'health':
        return (
          <HealthScreen 
            user={user} 
            onNavigate={handleNavigate}
          />
        );
      case 'healthRecordDetail':
        return (
          <HealthRecordDetailScreen 
            user={user} 
            onNavigate={handleNavigate}
            selectedRecord={screenData?.record || null}
          />
        );
      case 'calendar':
        return (
          <CalendarScreen 
            user={user} 
            onNavigate={handleNavigate}
          />
        );
      case 'settings':
        return (
          <SettingsScreen 
            user={user} 
            onNavigate={handleNavigate}
            onLogout={handleLogout}
          />
        );
      default:
        return (
          <View style={styles.homeContainer}>
            <View style={styles.header}>
              <View>
                <Text style={styles.welcomeText}>欢迎回来</Text>
                <Text style={styles.userNameText}>{user.fullName || user.displayName || '用户'}</Text>
              </View>
              <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutButtonText}>退出</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.menuSection}>
              <Text style={styles.sectionTitle}>功能菜单</Text>
              
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleNavigate('health')}
              >
                <Text style={styles.menuItemIcon}>🏥</Text>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>健康记录</Text>
                  <Text style={styles.menuItemSubtitle}>管理家庭成员的健康档案</Text>
                </View>
                <Text style={styles.menuItemArrow}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleNavigate('family')}
              >
                <Text style={styles.menuItemIcon}>👨‍👩‍👧‍👦</Text>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>家庭管理</Text>
                  <Text style={styles.menuItemSubtitle}>管理家庭成员和权限</Text>
                </View>
                <Text style={styles.menuItemArrow}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleNavigate('calendar')}
              >
                <Text style={styles.menuItemIcon}>📅</Text>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>健康日历</Text>
                  <Text style={styles.menuItemSubtitle}>查看体检和复查安排</Text>
                </View>
                <Text style={styles.menuItemArrow}>→</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleNavigate('settings')}
              >
                <Text style={styles.menuItemIcon}>⚙️</Text>
                <View style={styles.menuItemContent}>
                  <Text style={styles.menuItemTitle}>设置</Text>
                  <Text style={styles.menuItemSubtitle}>个人设置和应用配置</Text>
                </View>
                <Text style={styles.menuItemArrow}>→</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor={COLORS.background} 
        translucent={false}
      />
      {renderCurrentScreen()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  homeContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.primary,
  },
  welcomeText: {
    color: COLORS.background,
    fontSize: 14,
    opacity: 0.9,
  },
  userNameText: {
    color: COLORS.background,
    fontSize: 20,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  logoutButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '500',
  },
  menuSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuItemIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  menuItemSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  menuItemArrow: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});

export default MainScreen;