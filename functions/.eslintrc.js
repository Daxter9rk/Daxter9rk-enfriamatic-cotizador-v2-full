module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json'],
    sourceType: 'module',
  },
  ignorePatterns: ['/lib/**/*'],
  plugins: ['@typescript-eslint'],
  rules: {
    quotes: ['error', 'single', {avoidEscape: true}],
    indent: ['error', 2, {SwitchCase: 1}],
    'max-len': 'off',
    'require-jsdoc': 'off',
    'operator-linebreak': 'off',
  },
};
