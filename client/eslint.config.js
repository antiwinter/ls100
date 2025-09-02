import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules', 'dev-dist', 'public', 'src/shards/anki/test']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module'
      }
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }],
      'no-console': 'error',
      'semi': ['error', 'never'],
      'quotes': ['error', 'single'],
      'comma-dangle': ['error', 'never'],
      'indent': ['error', 2],
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'space-before-blocks': ['error', 'always'],
      'keyword-spacing': ['error', { 'before': true, 'after': true }],
      'space-infix-ops': 'error',
      'eol-last': ['error', 'always'],
      'no-trailing-spaces': 'error',
      'max-len': ['error', {
        'code': 100,           // Max characters per line
        'tabWidth': 2,         // Tab width for calculation
        'ignoreUrls': true,    // Ignore lines with URLs
        'ignoreStrings': true, // Ignore long strings
        'ignoreComments': false,// Ignore long comments
        'ignoreRegExpLiterals': true,
        'ignoreTemplateLiterals': true,
        'ignorePattern': '^\\s*<.*>.*</.*>\\s*$|^\\s*.*>$'  // Ignore JSX/HTML lines
      }]
    }
  },
  {
    files: ['vite.config.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ['src/config/constants.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        process: 'readonly'
      }
    }
  }
])
