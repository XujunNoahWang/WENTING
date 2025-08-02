import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppSelector, selectUser } from '../../store/index';
import Icon from 'react-native-vector-icons/Ionicons';

// Components
import Button from '../../components/common/Button';

// Constants
import { COLORS, FONTS, SPACING } from '../../constants/index';

// Services
import GeminiService from '../../services/gemini/GeminiService';

const HomeScreen: React.FC = () => {
  const user = useAppSelector(selectUser);
  const [healthTip, setHealthTip] = useState<string>('');
  const [isLoadingTip, setIsLoadingTip] = useState(false);

  useEffect(() => {
    loadHealthTip();
  }, []);

  const loadHealthTip = async () => {
    setIsLoadingTip(true);
    try {
      // Mock weather data for demonstration
      const mockWeatherData = {
        temperature: 25,
        humidity: 60,
        description: '晴朗',
        uvIndex: 7,
        airQuality: '良好',
      };

      // Mock user conditions
      const userConditions = ['高血压', '糖尿病'];

      const response = await GeminiService.generateHealthTip(
        userConditions,
        mockWeatherData,
        user?.fullName ? 45 : undefined
      );

      if (response.success) {
        setHealthTip(response.data || '今天是美好的一天，记得按时服药，保持健康的生活方式！');
      }
    } catch (error) {
      console.error('Failed to load health tip:', error);
      setHealthTip('今天是美好的一天，记得按时服药，保持健康的生活方式！');
    } finally {
      setIsLoadingTip(false);
    }
  };

  const handleQuickAction = (action: string) => {
    Alert.alert('功能提示', `${action}功能正在开发中，敬请期待！`);
  };

  const quickActions = [
    { id: 'addRecord', title: '添加健康档案', icon: 'add-circle-outline', color: COLORS.PRIMARY },
    { id: 'addReminder', title: '设置提醒', icon: 'alarm-outline', color: COLORS.SUCCESS },
    { id: 'addAppointment', title: '预约挂号', icon: 'medical-outline', color: COLORS.WARNING },
  ];

  const stats = [
    { label: '健康档案', value: '12', icon: 'document-text-outline' },
    { label: '活跃提醒', value: '5', icon: 'notifications-outline' },
    { label: '家庭成员', value: '4', icon: 'people-outline' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>
            {user?.fullName ? `你好, ${user.fullName}` : '你好'}
          </Text>
          <Text style={styles.subtitleText}>今天的健康状况如何？</Text>
        </View>
        
        <TouchableOpacity style={styles.notificationIcon}>
          <Icon name="notifications-outline" size={24} color={COLORS.TEXT_PRIMARY} />
          <View style={styles.notificationBadge}>
            <Text style={styles.badgeText}>3</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Health Tip Card */}
      <View style={styles.healthTipCard}>
        <View style={styles.cardHeader}>
          <Icon name="bulb-outline" size={20} color={COLORS.PRIMARY} />
          <Text style={styles.cardTitle}>今日健康建议</Text>
        </View>
        
        {isLoadingTip ? (
          <Text style={styles.loadingText}>正在生成个性化建议...</Text>
        ) : (
          <Text style={styles.healthTipText}>{healthTip}</Text>
        )}
        
        <TouchableOpacity onPress={loadHealthTip} style={styles.refreshButton}>
          <Icon name="refresh-outline" size={16} color={COLORS.PRIMARY} />
          <Text style={styles.refreshText}>刷新建议</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Overview */}
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>健康概览</Text>
        <View style={styles.statsGrid}>
          {stats.map((stat, index) => (
            <View key={index} style={styles.statCard}>
              <Icon name={stat.icon} size={24} color={COLORS.PRIMARY} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <Text style={styles.sectionTitle}>快速操作</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionCard}
              onPress={() => handleQuickAction(action.title)}
            >
              <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
                <Icon name={action.icon} size={24} color={action.color} />
              </View>
              <Text style={styles.actionTitle}>{action.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.recentActivity}>
        <Text style={styles.sectionTitle}>最近活动</Text>
        <View style={styles.activityList}>
          <View style={styles.activityItem}>
            <Icon name="checkmark-circle" size={20} color={COLORS.SUCCESS} />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>按时服用降压药</Text>
              <Text style={styles.activityTime}>2小时前</Text>
            </View>
          </View>
          
          <View style={styles.activityItem}>
            <Icon name="add-circle" size={20} color={COLORS.PRIMARY} />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>添加了血压记录</Text>
              <Text style={styles.activityTime}>昨天</Text>
            </View>
          </View>
          
          <View style={styles.activityItem}>
            <Icon name="calendar" size={20} color={COLORS.SECONDARY} />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>预约了体检</Text>
              <Text style={styles.activityTime}>3天前</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.MD,
    paddingBottom: SPACING.LG,
  },
  welcomeSection: {
    flex: 1,
  },
  welcomeText: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.XS,
  },
  subtitleText: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
  },
  notificationIcon: {
    position: 'relative',
    padding: SPACING.SM,
  },
  notificationBadge: {
    position: 'absolute',
    top: SPACING.XS,
    right: SPACING.XS,
    backgroundColor: COLORS.ERROR,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: COLORS.SURFACE,
    fontSize: 12,
    fontFamily: FONTS.BOLD,
  },
  healthTipCard: {
    backgroundColor: COLORS.SURFACE,
    marginHorizontal: SPACING.LG,
    marginBottom: SPACING.LG,
    borderRadius: 12,
    padding: SPACING.LG,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.MD,
  },
  cardTitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginLeft: SPACING.SM,
  },
  healthTipText: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_PRIMARY,
    lineHeight: 22,
    marginBottom: SPACING.MD,
  },
  loadingText: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    fontStyle: 'italic',
    marginBottom: SPACING.MD,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  refreshText: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.PRIMARY,
    marginLeft: SPACING.XS,
  },
  statsContainer: {
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.LG,
  },
  sectionTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.MD,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: COLORS.SURFACE,
    flex: 1,
    marginHorizontal: SPACING.XS,
    borderRadius: 8,
    padding: SPACING.MD,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.SM,
  },
  statLabel: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    marginTop: SPACING.XS,
  },
  quickActionsContainer: {
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.LG,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    backgroundColor: COLORS.SURFACE,
    width: '48%',
    borderRadius: 12,
    padding: SPACING.LG,
    alignItems: 'center',
    marginBottom: SPACING.MD,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  actionTitle: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
  },
  recentActivity: {
    paddingHorizontal: SPACING.LG,
    marginBottom: SPACING.LG,
  },
  activityList: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 8,
    padding: SPACING.MD,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.SM,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  activityContent: {
    flex: 1,
    marginLeft: SPACING.MD,
  },
  activityTitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_PRIMARY,
  },
  activityTime: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    marginTop: SPACING.XS,
  },
  bottomSpacing: {
    height: SPACING.XXL,
  },
});

export default HomeScreen;