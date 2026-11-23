import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import unusedImports from 'eslint-plugin-unused-imports';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      '.vercel/**',
      'dist/**',
      'build/**',
      '*.min.js',
      '*.min.css',
      'package-lock.json',
      'yarn.lock',
      'bun.lockb',
      '.env*',
      'public/**',
      '*.md',
      'scripts/**',
      'types/**',
    ],
  },
  // Benchmark artifacts also contain TypeScript, but are not application modules.
  {
    files: ['docs/assessments/**/*.ts', '.context/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
    },
  },
  {
    files: [
      'app/**/*.{js,jsx,ts,tsx}',
      'components/**/*.{js,jsx,ts,tsx}',
      'lib/**/*.{js,jsx,ts,tsx}',
      'hooks/**/*.{js,jsx,ts,tsx}',
      'cosmic/**/*.{js,jsx,ts,tsx}',
      'test/**/*.{js,jsx,ts,tsx}',
    ],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URLSearchParams: 'readonly',
        WebSocket: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        React: 'readonly',
        JSX: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLAnchorElement: 'readonly',
        HTMLSpanElement: 'readonly',
        HTMLParagraphElement: 'readonly',
        HTMLHeadingElement: 'readonly',
        HTMLUListElement: 'readonly',
        HTMLLIElement: 'readonly',
        HTMLOListElement: 'readonly',
        HTMLIFrameElement: 'readonly',
        MouseEvent: 'readonly',
        KeyboardEvent: 'readonly',
        Event: 'readonly',
        Node: 'readonly',
        File: 'readonly',
        RequestInit: 'readonly',
        Window: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      'unused-imports': unusedImports,
      prettier: prettier,
    },
    rules: {
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],

      '@typescript-eslint/no-unused-vars': 'off', // Turn off base rule as it can report incorrect errors
      '@typescript-eslint/no-explicit-any': 'warn',

      'prettier/prettier': 'error',

      'no-console': 'off',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-undef': 'off', // TypeScript handles this

      // Next.js 16.4 Turbopack drops the server-action id of a binding a 'use server'
      // module re-exports, and client calls throw `reading 'apply'` (#21). Export each
      // action from the module that defines it.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "Program:has(> ExpressionStatement[directive='use server']) ExportNamedDeclaration[declaration=null][exportKind!='type']",
          message:
            "Do not re-export from a 'use server' module. Import the action from the module that defines it.",
        },
        {
          selector:
            "Program:has(> ExpressionStatement[directive='use server']) ExportAllDeclaration[exportKind!='type']",
          message:
            "Do not re-export from a 'use server' module. Import the action from the module that defines it.",
        },
      ],

      // Disable Next.js img element warning - using native img intentionally
      '@next/next/no-img-element': 'off',
    },
  },
  prettierConfig,
];
