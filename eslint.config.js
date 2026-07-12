import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Screens and components must reach the game only through the src/game facade
// and hooks; they may never import the pure engine/rules/bot internals directly.
const PURE_CORE_BOUNDARY = {
  patterns: [
    {
      group: ['**/engine/*', '**/rules/*', '**/bot/*'],
      message:
        'Screens and components must go through the src/game facade or hooks, never src/engine, src/rules, or src/bot directly.',
    },
  ],
};

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/screens/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', PURE_CORE_BOUNDARY],
    },
  },
);
