const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
require('dotenv').config();

module.exports = {
  mode: 'development',
  entry: './index.web.js',
  output: {
    path: path.resolve(__dirname, 'web/dist'),
    filename: 'bundle.js',
  },
  resolve: {
    extensions: ['.web.js', '.js', '.web.tsx', '.tsx', '.web.ts', '.ts', '.json'],
    alias: {
      'react-native': 'react-native-web',
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@screens': path.resolve(__dirname, 'src/screens'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@navigation': path.resolve(__dirname, 'src/navigation'),
      '@config': path.resolve(__dirname, 'src/config'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@store': path.resolve(__dirname, 'src/store'),
      '@constants': path.resolve(__dirname, 'src/constants'),
      '@assets': path.resolve(__dirname, 'src/assets'),
    },
    fallback: {
      "process": require.resolve("process/browser"),
      "buffer": require.resolve("buffer"),
    },
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-react',
              '@babel/preset-typescript',
            ],
            plugins: [
              ['module-resolver', {
                root: ['./src'],
                alias: {
                  '@': './src',
                  '@components': './src/components',
                  '@screens': './src/screens',
                  '@services': './src/services',
                  '@navigation': './src/navigation',
                  '@config': './src/config',
                  '@utils': './src/utils',
                  '@types': './src/types',
                  '@store': './src/store',
                  '@constants': './src/constants',
                  '@assets': './src/assets',
                },
              }],
            ],
          },
        },
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/,
        use: {
          loader: 'file-loader',
          options: {
            name: '[name].[ext]',
            outputPath: 'assets/',
          },
        },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './web/index.html',
    }),
    new webpack.DefinePlugin({
      '__DEV__': JSON.stringify(process.env.NODE_ENV === 'development'),
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
        REACT_APP_GEMINI_API_KEY: JSON.stringify(process.env.REACT_APP_GEMINI_API_KEY),
        REACT_APP_FIREBASE_API_KEY: JSON.stringify(process.env.REACT_APP_FIREBASE_API_KEY),
        REACT_APP_FIREBASE_AUTH_DOMAIN: JSON.stringify(process.env.REACT_APP_FIREBASE_AUTH_DOMAIN),
        REACT_APP_FIREBASE_PROJECT_ID: JSON.stringify(process.env.REACT_APP_FIREBASE_PROJECT_ID),
        REACT_APP_FIREBASE_STORAGE_BUCKET: JSON.stringify(process.env.REACT_APP_FIREBASE_STORAGE_BUCKET),
        REACT_APP_FIREBASE_MESSAGING_SENDER_ID: JSON.stringify(process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID),
        REACT_APP_FIREBASE_APP_ID: JSON.stringify(process.env.REACT_APP_FIREBASE_APP_ID),
        REACT_APP_FIREBASE_MEASUREMENT_ID: JSON.stringify(process.env.REACT_APP_FIREBASE_MEASUREMENT_ID),
      }
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
    // Ignore React Native specific modules for web builds
    new webpack.IgnorePlugin({
      resourceRegExp: /^react-native-sqlite-storage$/,
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'web'),
    },
    compress: true,
    port: 3001,
    host: 'localhost',
    hot: false,
    liveReload: false,
    open: true,
    allowedHosts: 'all',
    client: {
      webSocketURL: 'ws://localhost:3001/ws',
      reconnect: false,
    },
    webSocketServer: false,
  },
};