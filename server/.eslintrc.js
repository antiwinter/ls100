export default {
  env: {
    node: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-unused-vars': ['error', { 
      varsIgnorePattern: '^[A-Z_]',
      argsIgnorePattern: '^_'
    }],
    'semi': ['error', 'never'],
    'quotes': ['error', 'single'],
    'no-console': 'off', // Allow console.log in server
    'comma-dangle': ['error', 'never'],
  },
} 