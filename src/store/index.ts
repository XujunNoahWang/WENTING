import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { Platform } from 'react-native';

// Platform-specific storage
let storage: any;
if (Platform.OS === 'web') {
  // Use localStorage for web
  storage = {
    getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
    setItem: (key: string, value: string) => Promise.resolve(localStorage.setItem(key, value)),
    removeItem: (key: string) => Promise.resolve(localStorage.removeItem(key)),
  };
} else {
  // Use EncryptedStorage for mobile
  const EncryptedStorage = require('react-native-encrypted-storage').default;
  storage = EncryptedStorage;
}

// Import slices
import authReducer from './slices/authSlice';

// Persist configuration
const persistConfig = {
  key: 'root',
  storage: storage,
  whitelist: ['auth'], // Only persist auth state
  blacklist: [], // Don't persist these slices
};

// Root reducer
const rootReducer = combineReducers({
  auth: authReducer,
  // Add other reducers here as we create them
});

// Persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/FLUSH',
          'persist/REHYDRATE',
          'persist/PAUSE',
          'persist/PERSIST',
          'persist/PURGE',
          'persist/REGISTER',
        ],
      },
    }),
  devTools: __DEV__,
});

// Create persistor
export const persistor = persistStore(store);

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Selectors
export const selectAuth = (state: RootState) => state.auth;
export const selectUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectAuthLoading = (state: RootState) => state.auth.isLoading;
export const selectAuthError = (state: RootState) => state.auth.error;

export default store;