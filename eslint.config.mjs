import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['.output', '.wxt', 'node_modules', 'stats.html', 'public'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.webextensions, ...globals.node },
    },
  },
  // TypeScript already checks for undefined identifiers.
  { files: ['**/*.ts', '**/*.mts'], rules: { 'no-undef': 'off' } },
  // Must be last: turns off stylistic rules that would conflict with Prettier.
  prettier,
);
