/**
 * Stub de `server-only` para o ambiente de teste.
 *
 * O pacote real lança se for importado a partir de um Client Component — proteção
 * que se mantém intacta no `next build`. Em Vitest não há distinção
 * servidor/cliente, pelo que o import rebentaria em módulos legítimos de servidor.
 *
 * Substituir por este ficheiro NÃO enfraquece a proteção: apenas a desliga onde
 * ela não faz sentido. `server-only.guard.test.ts` verifica que o import continua
 * presente nos módulos que o exigem.
 */
export {};
