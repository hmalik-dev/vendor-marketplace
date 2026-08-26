import globals from 'globals';
import base from './base.js';

/**
 * Flat ESLint config for React/Next.js packages. Next.js contributes its own
 * plugin config on top of this in `apps/web` (added in ticket #2).
 */
export default [
  ...base,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
];
