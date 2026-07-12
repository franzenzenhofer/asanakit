import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'out/**', 'gallery/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: false }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-magic-numbers': 'off',
      'max-lines': ['error', { max: 450, skipBlankLines: true, skipComments: true }],
      'max-params': ['error', 4],
      complexity: ['error', 12],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
      'no-console': 'off',
    },
  },
  {
    files: ['tests/**/*.ts', 'scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      'max-lines': 'off',
    },
  },
);
