const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    alias: {
      '@': './src',
      '@components': './src/components',
      '@screens': './src/screens',
      '@services': './src/services',
      '@utils': './src/utils',
      '@types': './src/types',
      '@store': './src/store',
      '@constants': './src/constants',
      '@assets': './src/assets',
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);