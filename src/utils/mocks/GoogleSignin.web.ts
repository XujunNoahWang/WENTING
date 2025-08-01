// Mock Google Sign-In for web platform
export const GoogleSignin = {
  configure: (config: any) => {
    console.log('GoogleSignin configured for web:', config);
  },
  
  hasPlayServices: () => Promise.resolve(true),
  
  signIn: () => Promise.reject(new Error('Google Sign-In not available on web. Use Firebase Auth instead.')),
  
  signOut: () => Promise.resolve(),
  
  isSignedIn: () => Promise.resolve(false),
  
  getCurrentUser: () => Promise.resolve(null),
};

export const statusCodes = {
  SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
  IN_PROGRESS: 'IN_PROGRESS',
  PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  SIGN_IN_REQUIRED: 'SIGN_IN_REQUIRED',
};

export const GoogleSigninButton = () => null;