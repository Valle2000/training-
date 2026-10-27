// Hook-Regeln von React (Hooks nicht nach einer frühen Rückgabe oder bedingt aufrufen, sonst
// „Minified React error #310“ auf dem Gerät) und Prüfung auf undefinierte Variablen.
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const jsx = { ecmaVersion: 2023, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } };
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  { files: ['src/**/*.{js,jsx}'], languageOptions: { ...jsx, globals: { ...globals.browser, __APP_VERSION__: 'readonly', __APP_URL__: 'readonly', __BUILD__: 'readonly' } } },
  { files: ['public/sw.js'], languageOptions: { ecmaVersion: 2023, globals: globals.serviceworker } },
  { files: ['server/**/*.mjs', 'scripts/**/*.mjs', 'api/**/*.js', 'tests/**/*.mjs', '*.config.*'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node } },
  { files: ['**/*.{js,jsx,mjs}'], rules: { 'no-undef': 'error' } },
  { files: ['**/*.jsx'], plugins: { 'react-hooks': hooks }, rules: { 'react-hooks/rules-of-hooks': 'error' } },
];
