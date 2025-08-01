import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Import actual screens
import HealthRecordsScreen from '@screens/health/HealthRecordsScreen';
import HouseholdScreen from '@screens/household/HouseholdScreen';
import CalendarScreen from '@screens/calendar/CalendarScreen';
import SettingsScreen from '@screens/settings/SettingsScreen';

const Stack = createStackNavigator();

// Home screen with menu options
const TestHomeScreen: React.FC = () => {
  const navigation = useNavigation();

  const menuItems = [
    { title: '健康记录', subtitle: '查看和管理健康数据', screen: 'Health' },
    { title: '家庭成员', subtitle: '管理家庭成员信息', screen: 'Family' },
    { title: '日历提醒', subtitle: '设置健康提醒', screen: 'Calendar' },
    { title: '设置', subtitle: '应用设置和偏好', screen: 'Settings' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>WENTING 健康管理</Text>
        <Text style={styles.subtitle}>家庭健康监督助手</Text>
      </View>
      
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={() => navigation.navigate(item.screen as never)}
          >
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

// We'll use the actual screens imported above

// Placeholder screens for Calendar and Settings
const TestCalendarScreen: React.FC = () => {
  return (
    <View style={styles.screenContainer}>
      <Text style={styles.screenTitle}>日历提醒</Text>
      <Text style={styles.screenContent}>这里将显示日历和提醒功能</Text>
    </View>
  );
};

const TestSettingsScreen: React.FC = () => {
  return (
    <View style={styles.screenContainer}>
      <Text style={styles.screenTitle}>设置</Text>
      <Text style={styles.screenContent}>这里将显示应用设置</Text>
    </View>
  );
};

const TestNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="TestHome"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#007AFF',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen 
        name="TestHome" 
        component={TestHomeScreen}
        options={{ title: 'WENTING 主页' }}
      />
      <Stack.Screen 
        name="Health" 
        component={HealthRecordsScreen}
        options={{ title: '健康记录' }}
      />
      <Stack.Screen 
        name="Family" 
        component={HouseholdScreen}
        options={{ title: '家庭成员' }}
      />
      <Stack.Screen 
        name="Calendar" 
        component={TestCalendarScreen}
        options={{ title: '日历提醒' }}
      />
      <Stack.Screen 
        name="Settings" 
        component={TestSettingsScreen}
        options={{ title: '设置' }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  menuContainer: {
    paddingHorizontal: 20,
  },
  menuItem: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  menuSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  screenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    padding: 20,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  screenContent: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default TestNavigator;