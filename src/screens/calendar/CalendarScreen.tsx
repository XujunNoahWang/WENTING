import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { COLORS } from '../../constants/colors';
import { FirebaseUser } from '../../types/appTypes';

interface CalendarScreenProps {
  user: FirebaseUser;
  onNavigate: (screen: string) => void;
}

const CalendarScreen: React.FC<CalendarScreenProps> = ({ user, onNavigate }) => {
  const handleComingSoon = () => {
    Alert.alert('功能开发中', '健康日历功能正在开发中，敬请期待！');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => onNavigate('home')}
      >
        <Text style={styles.backButtonText}>← 返回</Text>
      </TouchableOpacity>

      <Text style={styles.screenTitle}>健康日历</Text>

      <View style={styles.content}>
        <View style={styles.comingSoonContainer}>
          <Text style={styles.comingSoonIcon}>📅</Text>
          <Text style={styles.comingSoonTitle}>功能开发中</Text>
          <Text style={styles.comingSoonText}>
            健康日历功能正在开发中，将包括：{'\n\n'}
            • 体检预约提醒{'\n'}
            • 复查时间安排{'\n'}
            • 用药时间提醒{'\n'}
            • 健康检查日程{'\n\n'}
            敬请期待！
          </Text>
          <TouchableOpacity style={styles.okButton} onPress={handleComingSoon}>
            <Text style={styles.okButtonText}>了解</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  comingSoonContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.light,
    borderRadius: 12,
    padding: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  comingSoonIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  comingSoonTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  comingSoonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  okButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  okButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CalendarScreen;