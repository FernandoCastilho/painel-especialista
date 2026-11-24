import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import react from 'eslint-plugin-react'

export default [
  { ignores: ['dist/**', 'node_modules/**', 'public/**', 'workspace-qa/**', 'qa-followup/**', 'table-qa/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-hooks': reactHooks, react },
    rules: { 'react/jsx-uses-vars': 'error', 'react/jsx-uses-react': 'off', ...reactHooks.configs.recommended.rules, 'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_|^React$' }] },
  },
  { files: ['scripts/**/*.mjs', 'test/**/*.mjs', 'vite.config.js', 'eslint.config.js'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node } },
  { files: ['worker/**/*.mjs'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.serviceworker, console: 'readonly' } } },
  { files: ['scripts/**/*.cjs'], languageOptions: { ecmaVersion: 2023, sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } } },
]
