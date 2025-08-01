import React, { useEffect, useState } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAppDispatch, useAppSelector, selectIsAuthenticated, selectAuthLoading } from '../store/index';
import { getCurrentUser } from '../store/slices/authSlice';

// Navigation Types
import { RootStackParamList } from '../types/index';

// Navigators
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';

// Components
import LoadingScreen from '../components/common/LoadingScreen';
import SplashScreen from '../components/common/SplashScreen';

const Stack = createStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectAuthLoading);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Check if user is already authenticated
      await dispatch(getCurrentUser()).unwrap();
    } catch (error) {
      console.log('No authenticated user found');
    } finally {
      setIsInitializing(false);
    }
  };

  // Show splash screen while initializing
  if (isInitializing) {
    return <SplashScreen />;
  }

  // Show loading screen while auth is in progress
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
      }}
    >
      {isAuthenticated ? (
        <Stack.Screen 
          name="Main" 
          component={MainNavigator} 
          options={{
            animationTypeForReplace: 'push',
          }}
        />
      ) : (
        <Stack.Screen 
          name="Auth" 
          component={AuthNavigator}
          options={{
            animationTypeForReplace: 'pop',
          }}
        />
      )}
    </Stack.Navigator>
  );
};

export default RootNavigator;