// Mock Firebase Firestore for web platform
const FirebaseFirestore = {
  default: () => ({
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: () => Promise.reject(new Error('Use firebaseAuthService instead')),
        set: () => Promise.reject(new Error('Use firebaseAuthService instead')),
        update: () => Promise.reject(new Error('Use firebaseAuthService instead')),
        delete: () => Promise.reject(new Error('Use firebaseAuthService instead'))
      }),
      add: () => Promise.reject(new Error('Use firebaseAuthService instead')),
      get: () => Promise.reject(new Error('Use firebaseAuthService instead'))
    })
  })
};

export default FirebaseFirestore;