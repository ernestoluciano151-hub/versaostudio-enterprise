import js from '@eslint/js';

export default [
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts'] },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: (await import('typescript-eslint')).parser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly',
                 Request: 'readonly', Response: 'readonly', crypto: 'readonly' },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-restricted-syntax': ['error', {
        selector: "BinaryExpression[operator='==='][left.property.name='role']",
        message: "Proibido verificar papel diretamente. Usar requirePermission().",
      }],
    },
  },
];
