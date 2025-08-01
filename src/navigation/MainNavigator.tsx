import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/Ionicons';

// Types
import { RootStackParamList } from '../types/index';

// Screens
import HomeScreen from '../screens/home/HomeScreen';
import HouseholdScreen from '../screens/household/HouseholdScreen';
import HealthRecordsScreen from '../screens/health/HealthRecordsScreen';
import CalendarScreen from '../screens/calendar/CalendarScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

// Detail Screens
import AddHealthRecordScreen from '../screens/health/AddHealthRecordScreen';
import ViewHealthRecordScreen from '../screens/health/ViewHealthRecordScreen';
import AddReminderScreen from '../screens/reminders/AddReminderScreen';
import AddAppointmentScreen from '../screens/calendar/AddAppointmentScreen';
import HouseholdMembersScreen from '../screens/household/HouseholdMembersScreen';
import InviteMemberScreen from '../screens/household/InviteMemberScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

// Constants
import { COLORS, FONTS } from '../constants/index';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator<RootStackParamList>();

// Stack Navigators for each tab
const HomeStackNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: COLORS.PRIMARY,
        elevation: 0,
        shadowOpacity: 0,
      },
      headerTintColor: COLORS.SURFACE,
      headerTitleStyle: {
        fontWeight: 'bold',
        fontSize: 18,
      },
      headerBackTitleVisible: false,
    }}
  >
    <Stack.Screen
      name="Home"
      component={HomeScreen}
      options={{
        title: 'WENTING',
        headerStyle: {
          backgroundColor: COLORS.PRIMARY,
        },
      }}
    />
  </Stack.Navigator>
);

const HouseholdStackNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: COLORS.PRIMARY,
        elevation: 0,
        shadowOpacity: 0,
      },
      headerTintColor: COLORS.SURFACE,
      headerTitleStyle: {
        fontWeight: 'bold',
        fontSize: 18,
      },
      headerBackTitleVisible: false,
    }}
  >
    <Stack.Screen
      name="Household"
      component={HouseholdScreen}
      options={{
        title: '我的家庭',
      }}
    />
    <Stack.Screen
      name="HouseholdMembers"
      component={HouseholdMembersScreen}
      options={{
        title: '家庭成员',
      }}
    />
    <Stack.Screen
      name="InviteMember"
      component={InviteMemberScreen}
      options={{
        title: '邀请成员',
      }}
    />
  </Stack.Navigator>
);

const HealthStackNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: COLORS.PRIMARY,
        elevation: 0,
        shadowOpacity: 0,
      },
      headerTintColor: COLORS.SURFACE,
      headerTitleStyle: {
        fontWeight: 'bold',
        fontSize: 18,
      },
      headerBackTitleVisible: false,
    }}
  >
    <Stack.Screen
      name="HealthRecords"
      component={HealthRecordsScreen}
      options={{
        title: '健康档案',
      }}
    />
    <Stack.Screen
      name="AddHealthRecord"
      component={AddHealthRecordScreen}
      options={{
        title: '添加健康档案',
      }}
    />
    <Stack.Screen
      name="ViewHealthRecord"
      component={ViewHealthRecordScreen}
      options={{
        title: '健康档案详情',
      }}
    />
    <Stack.Screen
      name="AddReminder"
      component={AddReminderScreen}
      options={{
        title: '设置提醒',
      }}
    />
  </Stack.Navigator>
);

const CalendarStackNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: COLORS.PRIMARY,
        elevation: 0,
        shadowOpacity: 0,
      },
      headerTintColor: COLORS.SURFACE,
      headerTitleStyle: {
        fontWeight: 'bold',
        fontSize: 18,
      },
      headerBackTitleVisible: false,
    }}
  >
    <Stack.Screen
      name="Calendar"
      component={CalendarScreen}
      options={{
        title: '健康日历',
      }}
    />
    <Stack.Screen
      name="AddAppointment"
      component={AddAppointmentScreen}
      options={{
        title: '添加预约',
      }}
    />
  </Stack.Navigator>
);

const ProfileStackNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: {
        backgroundColor: COLORS.PRIMARY,
        elevation: 0,
        shadowOpacity: 0,
      },
      headerTintColor: COLORS.SURFACE,
      headerTitleStyle: {
        fontWeight: 'bold',
        fontSize: 18,
      },
      headerBackTitleVisible: false,
    }}
  >
    <Stack.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        title: '个人中心',
      }}
    />
    <Stack.Screen
      name="Settings"
      component={SettingsScreen}
      options={{
        title: '设置',
      }}
    />
  </Stack.Navigator>
);

const MainNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'HomeTab':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'HouseholdTab':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'HealthTab':
              iconName = focused ? 'heart' : 'heart-outline';
              break;
            case 'CalendarTab':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'ProfileTab':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'circle-outline';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: COLORS.PRIMARY,
        tabBarInactiveTintColor: COLORS.TEXT_SECONDARY,
        tabBarStyle: {
          backgroundColor: COLORS.SURFACE,
          borderTopColor: COLORS.BORDER,
          borderTopWidth: 1,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: FONTS.REGULAR,
          marginTop: -5,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          tabBarLabel: '首页',
        }}
      />
      
      <Tab.Screen
        name="HouseholdTab"
        component={HouseholdStackNavigator}
        options={{
          tabBarLabel: '家庭',
        }}
      />
      
      <Tab.Screen
        name="HealthTab"
        component={HealthStackNavigator}
        options={{
          tabBarLabel: '健康',
        }}
      />
      
      <Tab.Screen
        name="CalendarTab"
        component={CalendarStackNavigator}
        options={{
          tabBarLabel: '日历',
        }}
      />
      
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          tabBarLabel: '我的',
        }}
      />
    </Tab.Navigator>
  );
};

export default MainNavigator;