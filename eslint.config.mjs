// eslint.config.mjs
// @ts-check
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import angular from 'angular-eslint';
import prettier from 'eslint-config-prettier/flat';

const layer = (forbidden, message) => ({
  '@typescript-eslint/no-restricted-imports': [
    'error',
    { patterns: forbidden.map((regex) => ({ regex, message, allowTypeImports: false })) },
  ],
});

export default defineConfig(
  { ignores: ['dist/', 'coverage/', '.angular/', 'docs/', 'node_modules/'] },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      angular.configs.tsRecommended,
      prettier,
    ],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'bb', style: 'kebab-case' },
      ],
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'bb', style: 'camelCase' },
      ],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-exports': ['error', { restrictDefaultExports: { direct: true } }],
    },
  },
  {
    files: ['**/*.spec.ts', '**/testing/**/*.ts'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
  {
    files: ['src/app/engine/**/*.ts'],
    rules: layer(
      ['^@angular/', '^rxjs', '(^|/)(state|platform|ui)(/|$)'],
      'engine is pure TypeScript: no Angular, RxJS, state, platform or ui imports (ADR-0002).',
    ),
  },
  {
    files: ['src/app/platform/**/*.ts'],
    rules: layer(['(^|/)(state|ui)(/|$)'], 'platform must not import state or ui (ADR-0002).'),
  },
  {
    files: ['src/app/state/**/*.ts'],
    rules: layer(['(^|/)ui(/|$)'], 'state must not import ui (ADR-0002).'),
  },
  {
    files: ['src/app/ui/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '(^|/)platform(/|$)', message: 'ui must not import platform (ADR-0002).' },
            {
              regex: '(^|/)engine(/|$)',
              message: 'ui may import engine types only (ADR-0002).',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
  },
);
