// Mock Firebase Auth for web platform
const FirebaseAuth = {
  default: () => ({
    signInWithPhoneNumber: (phoneNumber: string) => {
      return Promise.reject({
        code: 'auth/phone-auth-not-supported',
        message: 'Phone authentication is not supported on web platform'
      });
    },
    signInWithEmailAndPassword: (email: string, password: string) => {
      return Promise.reject({
        code: 'auth/not-implemented',
        message: 'Use firebaseAuthService instead'
      });
    }
  })
};

export default FirebaseAuth;