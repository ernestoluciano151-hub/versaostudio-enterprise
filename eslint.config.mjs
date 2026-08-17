import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Configuração ESLint — flat config.
 *
 * Deliberadamente mínima. As regras que protegem a arquitetura (fronteiras de
 * módulo, proibição de verificar papéis fora de `requirePermission`) entram
 * quando houver módulos a proteger — ver docs/architecture/folder-structure.md.
 */
export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'next-env.d.ts',
      '*.tsbuildinfo',
    ],
  },

  js.configs.recommended,

  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        crypto: 'readonly',
        URL: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        Buffer: 'readonly',
        requestAnimationFrame: 'readonly',
      },
    },
    rules: {
      // `_` como prefixo marca argumentos deliberadamente não usados.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // A regra central da arquitetura: papéis não se verificam à mão.
      // Ver ADR-008 e docs/security/rbac.md §6.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "BinaryExpression[operator='==='] > MemberExpression[property.name='role']",
          message:
            'Proibido comparar papéis diretamente. Usar requirePermission() (ADR-008).',
        },
      ],
    },
  },

  // Os testes usam padrões que não fazem sentido no código de produção.
  {
    files: ['**/__tests__/**', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-syntax': 'off',
    },
  },
);
