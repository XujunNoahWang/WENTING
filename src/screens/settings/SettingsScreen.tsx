import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { COLORS } from '../../constants/colors';
import { FirebaseUser } from '../../types/appTypes';

interface SettingsScreenProps {
  user: FirebaseUser;
  onNavigate: (screen: string) => void;
  onLogout: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ user, onNavigate, onLogout }) => {
  const handleComingSoon = (feature: string) => {
    Alert.alert('功能开发中', `${feature}功能正在开发中，敬请期待！`);
  };

  const handleLogout = () => {
    Alert.alert(
      '确认退出',
      '确定要退出登录吗？',
      [
        { text: '取消', style: 'cancel' },
        { text: '退出', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => onNavigate('home')}
      >
        <Text style={styles.backButtonText}>← 返回</Text>
      </TouchableOpacity>

      <Text style={styles.screenTitle}>设置</Text>

      {/* 用户信息 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>用户信息</Text>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.fullName || user.displayName || '用户'}</Text>
          <Text style={styles.userEmail}>{user.email || '未设置邮箱'}</Text>
        </View>
      </View>

      {/* 通知设置 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>通知设置</Text>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => handleComingSoon('推送通知')}
        >
          <Text style={styles.settingItemText}>推送通知</Text>
          <Text style={styles.settingItemArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => handleComingSoon('用药提醒')}
        >
          <Text style={styles.settingItemText}>用药提醒</Text>
          <Text style={styles.settingItemArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => handleComingSoon('健康提醒')}
        >
          <Text style={styles.settingItemText}>健康提醒</Text>
          <Text style={styles.settingItemArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* 隐私设置 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>隐私设置</Text>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => handleComingSoon('数据加密')}
        >
          <Text style={styles.settingItemText}>数据加密</Text>
          <Text style={styles.settingItemArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => handleComingSoon('分享权限')}
        >
          <Text style={styles.settingItemText}>分享权限</Text>
          <Text style={styles.settingItemArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* 应用设置 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>应用设置</Text>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => handleComingSoon('语言设置')}
        >
          <Text style={styles.settingItemText}>语言设置</Text>
          <Text style={styles.settingItemArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => handleComingSoon('主题设置')}
        >
          <Text style={styles.settingItemText}>主题设置</Text>
          <Text style={styles.settingItemArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* 帮助与支持 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>帮助与支持</Text>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => handleComingSoon('使用帮助')}
        >
          <Text style={styles.settingItemText}>使用帮助</Text>
          <Text style={styles.settingItemArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => handleComingSoon('联系我们')}
        >
          <Text style={styles.settingItemText}>联系我们</Text>
          <Text style={styles.settingItemArrow}>→</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.settingItem}
          onPress={() => handleComingSoon('关于应用')}
        >
          <Text style={styles.settingItemText}>关于应用</Text>
          <Text style={styles.settingItemArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* 退出登录 */}
      <View style={styles.section}>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutButtonText}>退出登录</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  userInfo: {
    backgroundColor: COLORS.light,
    marginHorizontal: 20,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    marginHorizontal: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  settingItemText: {
    fontSize: 16,
    color: COLORS.text,
  },
  settingItemArrow: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  logoutButton: {
    backgroundColor: COLORS.danger,
    marginHorizontal: 20,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacing: {
    height: 40,
  },
});

export default SettingsScreen;