// Mock Firebase App for web platform
const FirebaseApp = {
  default: () => ({
    apps: [],
    initializeApp: (config: any) => ({
      name: 'default',
      options: config
    })
  })
};

export default FirebaseApp;