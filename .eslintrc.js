module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'script'
  },
  rules: {
    // 代码质量和性能相关
    'no-unused-vars': 'error',
    'no-undef': 'error',
    'no-redeclare': 'error',
    'no-dupe-keys': 'error',
    'no-unreachable': 'error',
    'no-constant-condition': 'error',
    'no-debugger': 'warn',
    'no-alert': 'warn',
    
    // 命名规范 (放宽数据库字段命名)
    'camelcase': ['warn', { 
      'properties': 'never',
      'allow': ['^[a-z]+_[a-z]+$', '^user_id$', '^ai_suggestions$', '^reminder_time$', '^repeat_type$', '^repeat_interval$', '^start_date$', '^cycle_type$', '^cycle_duration$', '^cycle_unit$', '^sort_order$']
    }],
    'no-underscore-dangle': 'off',
    
    // 性能相关
    'no-loop-func': 'error',
    'no-inner-declarations': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    
    // 代码复杂度
    'complexity': ['warn', 15],
    'max-depth': ['warn', 4],
    'max-params': ['warn', 5],
    'max-statements': ['warn', 50],
    'max-lines-per-function': ['warn', 100],
    'max-lines': ['warn', 500],
    
    // 关闭格式检查
    'indent': 'off',
    'quotes': 'off',
    'semi': 'off',
    'comma-dangle': 'off',
    'no-trailing-spaces': 'off',
    'eol-last': 'off',
    'linebreak-style': 'off',
    'object-curly-spacing': 'off',
    'space-before-function-paren': 'off',
    
    // 保留console，因为这是正常运行的项目
    'no-console': 'off'
  },
  ignorePatterns: [
    'node_modules/',
    'build/',
    'dist/',
    '*.min.js',
    'cloudflared.exe'
  ]
};