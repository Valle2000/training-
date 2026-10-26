// Nur die Hook-Regeln von React: Hooks dürfen nicht nach einer frühen Rückgabe oder bedingt aufgerufen werden
// (sonst „Minified React error #310“ auf dem Gerät).
import hooks from 'eslint-plugin-react-hooks';
export default [
 {ignores:['dist/**','node_modules/**']},
 {files:['**/*.jsx'],languageOptions:{ecmaVersion:2023,sourceType:'module',parserOptions:{ecmaFeatures:{jsx:true}}},
  plugins:{'react-hooks':hooks},rules:{'react-hooks/rules-of-hooks':'error'}},
];
