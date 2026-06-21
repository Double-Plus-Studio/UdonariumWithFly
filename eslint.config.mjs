// @ts-check
import eslint from '@eslint/js';
import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import angularTemplateParser from '@angular-eslint/template-parser';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/', '.angular/', 'node_modules/', '**/*.spec.ts'],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
    ],
    plugins: {
      '@angular-eslint': angular,
    },
    processor: angularTemplate.processors['extract-inline-html'],
    rules: {
      ...angular.configs.recommended.rules,
      // 架構遷移規則：現有程式碼維持 constructor injection / NgModule，僅警告不擋 CI
      '@angular-eslint/prefer-inject': 'warn',
      '@angular-eslint/prefer-standalone': 'warn',
      // Angular style
      '@angular-eslint/component-class-suffix': 'error',
      '@angular-eslint/directive-class-suffix': 'error',
      '@angular-eslint/no-input-rename': 'error',
      '@angular-eslint/no-output-rename': 'error',
      '@angular-eslint/use-lifecycle-interface': 'warn',
      // TypeScript
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-function': 'warn',
      // 現有程式碼大量使用 TypeScript namespace，屬架構問題，僅警告
      '@typescript-eslint/no-namespace': 'warn',
      // 日文全形空白是刻意的字串內容，只對程式碼位置報錯
      'no-irregular-whitespace': ['error', { skipStrings: true, skipComments: true, skipRegExps: true, skipTemplates: true }],
      // regex 裡的無用 escape 為風格問題，不阻擋 CI
      'no-useless-escape': 'warn',
      'no-console': 'warn',
    },
  },
  {
    files: ['**/*.html'],
    plugins: {
      '@angular-eslint/template': angularTemplate,
    },
    languageOptions: {
      parser: angularTemplateParser,
    },
    rules: {
      ...angularTemplate.configs.recommended.rules,
      // 允許 == null / != null（等同檢查 null|undefined），其餘仍要用 ===
      '@angular-eslint/template/eqeqeq': ['error', { allowNullOrUndefined: true }],
      // 遊戲 UI 的 accessibility 規則改為 warn
      '@angular-eslint/template/click-events-have-key-events': 'warn',
      '@angular-eslint/template/interactive-supports-focus': 'warn',
      '@angular-eslint/template/alt-text': 'warn',
      '@angular-eslint/template/label-has-associated-control': 'warn',
      // @if/@for 語法遷移：範圍較大，僅警告
      '@angular-eslint/template/prefer-control-flow': 'warn',
    },
  },
);
