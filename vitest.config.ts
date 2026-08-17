import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/auth/**'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` lança quando importado fora de um Server Component. Em Vitest
      // resolve para o build de cliente e rebenta. Substitui-se por um stub vazio.
      // A proteção real mantém-se no `next build`; o teste `server-only.guard.test.ts`
      // garante que o import não desaparece do código.
      'server-only': fileURLToPath(new URL('./src/test/server-only.stub.ts', import.meta.url)),
    },
  },
});
