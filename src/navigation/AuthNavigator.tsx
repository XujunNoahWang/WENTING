import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

// Types
import { RootStackParamList } from '@types/index';

// Screens
import LoginScreen from '@screens/auth/LoginScreen';
import RegisterScreen from '@screens/auth/RegisterScreen';
import ForgotPasswordScreen from '@screens/auth/ForgotPasswordScreen';
import PhoneVerificationScreen from '@screens/auth/PhoneVerificationScreen';

// Constants
import { COLORS } from '@constants/index';

const Stack = createStackNavigator<RootStackParamList>();

const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Login"
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
        gestureEnabled: true,
        cardStyle: {
          backgroundColor: COLORS.BACKGROUND,
        },
      }}
    >
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          headerShown: false,
        }}
      />
      
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{
          title: '注册账户',
        }}
      />
      
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          title: '忘记密码',
        }}
      />
      
      <Stack.Screen
        name="PhoneVerification"
        component={PhoneVerificationScreen}
        options={{
          title: '验证手机号',
          headerLeft: () => null, // Prevent going back during verification
        }}
      />
    </Stack.Navigator>
  );
};

export default AuthNavigator;