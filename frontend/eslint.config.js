import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import prettier from '@vue/eslint-config-prettier'

export default [
  // Base JavaScript configuration
  js.configs.recommended,
  
  // Vue.js configuration
  ...vue.configs['flat/essential'], // Use essential instead of recommended to reduce complexity
  
  // Prettier configuration
  prettier,
  
  {
    files: ['src/**/*.{js,jsx,ts,tsx,vue}'], // Only lint src directory
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/*.min.js',
      '**/public/**',
      '**/.*',
      '**/*.config.js',
      '**/vite.config.*',
      '**/vitest.config.*',
      '**/tests/**',
      '**/*.test.js',
      '**/*.spec.js'
    ],
    languageOptions: {
      ecmaVersion: 2024, 
      sourceType: 'module',
      globals: {
                console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        
        // Timing functions
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        
        // Fetch and related
        fetch: 'readonly',
        Blob: 'readonly',
        AbortSignal: 'readonly',
        AbortController: 'readonly',
        
        // Node.js (for build tools)
        process: 'readonly',
        global: 'readonly',
        
        // Test globals (even though we ignore test files)
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly'
      }
    },
    rules: {
      // Essential rules only to prevent hanging
      'no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_' 
      }],
      'no-undef': 'error',
      'no-console': 'off',
      
      // Vue-specific essential rules
      'vue/multi-word-component-names': 'off',
      'vue/no-unused-vars': 'error'
    }
  }
]
