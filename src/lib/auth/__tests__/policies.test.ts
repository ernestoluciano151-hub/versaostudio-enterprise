import { describe, expect, it } from 'vitest';
import {
  BACKUP_CODE_COUNT, LOCKOUT_THRESHOLD, PASSWORD_MIN_LENGTH,
  checkPassword, generateBackupCodes, hashToken, isLockedOut, isTokenExpired,
  issueToken, lockoutFor, resetLockout, shouldNotifyOwner,
  shouldRegenerateBackupCodes, tokenMatches,
} from '../policies';

const AGORA = new Date('2026-08-05T10:00:00Z');

describe('política de palavras-passe', () => {
  it('aceita uma palavra-passe longa e não trivial', () => {
    expect(checkPassword('fotografia em luanda 2026').valid).toBe(true);
  });

  it.each([
    ['curta', 'too_short'],
    ['password123', 'too_short'], // 11 caracteres — o comprimento falha primeiro
    ['            ', 'only_whitespace'],
    ['passwordpassword', 'too_common'],
    ['angola123456', 'too_common'],
    ['a'.repeat(200), 'too_long'],
  ])('recusa "%s" por %s', (password, reason) => {
    const resultado = checkPassword(password);
    expect(resultado.valid).toBe(false);
    expect(resultado.reason).toBe(reason);
  });

  it('a lista de senhas comuns só apanha correspondências exatas', () => {
    // Limitação conhecida: quem receber "too_short" em `password123` pode
    // acrescentar um dígito e passar. Mitigação real = lista das 10 000 mais
    // usadas + verificação de variantes. Registado em §7 de authentication.md.
    expect(checkPassword('passwordpassword').reason).toBe('too_common');
    expect(checkPassword('password12345').valid).toBe(true); // passa, e é fraca
  });

  it('recusa reutilizar a palavra-passe atual', () => {
    const atual = 'a minha palavra passe atual';
    expect(checkPassword(atual, { currentPassword: atual }).reason).toBe('same_as_current');
  });

  it('não impõe regras de composição — `Password1!` seria fraca e cumpri-las-ia todas', () => {
    expect(checkPassword('cavalo bateria grampo correto').valid).toBe(true);
    expect(PASSWORD_MIN_LENGTH).toBe(12);
  });
});

describe('bloqueio progressivo', () => {
  it('não bloqueia antes da 5.ª falha', () => {
    for (let i = 0; i < LOCKOUT_THRESHOLD; i += 1) {
      expect(lockoutFor(i, AGORA).lockedUntil).toBeNull();
    }
  });

  it.each([
    [5, 1], [6, 5], [7, 15], [8, 60], [20, 60],
  ])('%d falhas → bloqueio de %d minuto(s)', (falhas, minutos) => {
    const estado = lockoutFor(falhas, AGORA);
    expect(estado.lockedUntil?.getTime()).toBe(AGORA.getTime() + minutos * 60_000);
  });

  it('o bloqueio expira com o tempo', () => {
    const estado = lockoutFor(5, AGORA);
    expect(isLockedOut(estado, AGORA)).toBe(true);
    expect(isLockedOut(estado, new Date(AGORA.getTime() + 61_000))).toBe(false);
  });

  it('o sucesso repõe o contador', () => {
    expect(resetLockout()).toEqual({ failedLogins: 0, lockedUntil: null });
  });

  it('notifica o titular à 5.ª falha — pode ser ele o alvo', () => {
    expect(shouldNotifyOwner(4)).toBe(false);
    expect(shouldNotifyOwner(5)).toBe(true);
    expect(shouldNotifyOwner(6)).toBe(false);
  });
});

describe('tokens de uso único', () => {
  it('o token enviado nunca é o guardado', () => {
    const emitido = issueToken(15, AGORA);
    expect(emitido.tokenHash).not.toBe(emitido.token);
    expect(emitido.tokenHash).toBe(hashToken(emitido.token));
  });

  it('o hash não permite recuperar o token', () => {
    const emitido = issueToken(15, AGORA);
    expect(emitido.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(emitido.tokenHash).not.toContain(emitido.token);
  });

  it('valida o token correto', () => {
    const emitido = issueToken(30, AGORA);
    expect(tokenMatches(emitido.token, emitido.tokenHash)).toBe(true);
  });

  it('recusa token errado', () => {
    const emitido = issueToken(30, AGORA);
    expect(tokenMatches('outro-token-qualquer', emitido.tokenHash)).toBe(false);
  });

  it('dois tokens nunca coincidem', () => {
    expect(issueToken(15, AGORA).token).not.toBe(issueToken(15, AGORA).token);
  });

  it('expira ao fim do TTL', () => {
    const emitido = issueToken(15, AGORA);
    expect(isTokenExpired(emitido.expiresAt, new Date(AGORA.getTime() + 14 * 60_000))).toBe(false);
    expect(isTokenExpired(emitido.expiresAt, new Date(AGORA.getTime() + 16 * 60_000))).toBe(true);
  });

  it('magic link tem TTL mais curto que o reset de palavra-passe', () => {
    const magic = issueToken(15, AGORA);
    const reset = issueToken(30, AGORA);
    expect(magic.expiresAt.getTime()).toBeLessThan(reset.expiresAt.getTime());
  });
});

describe('códigos de recuperação MFA', () => {
  const codigos = generateBackupCodes();

  it('gera 10 códigos', () => {
    expect(codigos).toHaveLength(BACKUP_CODE_COUNT);
  });

  it('são todos distintos', () => {
    expect(new Set(codigos).size).toBe(BACKUP_CODE_COUNT);
  });

  it('evitam caracteres ambíguos (I, O, 0, 1)', () => {
    for (const codigo of codigos) expect(codigo).not.toMatch(/[IO01]/);
  });

  it('insiste na regeneração abaixo de 3 por usar', () => {
    expect(shouldRegenerateBackupCodes(3)).toBe(false);
    expect(shouldRegenerateBackupCodes(2)).toBe(true);
    expect(shouldRegenerateBackupCodes(0)).toBe(true);
  });
});
