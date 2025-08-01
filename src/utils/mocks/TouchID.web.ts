// Mock TouchID for web platform
const TouchID = {
  isSupported: () => Promise.resolve(false),
  authenticate: () => Promise.reject(new Error('TouchID not supported on web')),
};

export default TouchID;