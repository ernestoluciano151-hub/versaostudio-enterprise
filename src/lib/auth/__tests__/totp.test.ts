import { describe, expect, it } from 'vitest';
import {
  counterFor, fromBase32, generateSecret, generateTotp, hotp,
  otpauthUri, safeCompare, toBase32, verifyTotp,
} from '../totp';

/**
 * Vetores oficiais da RFC 6238 (Apêndice B), variante SHA-1.
 * Segredo: "12345678901234567890" em ASCII · 8 dígitos.
 * Se esta implementação estiver errada, estes vetores denunciam-na.
 */
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');
const RFC_BASE32 = toBase32(RFC_SECRET);

describe('conformidade com os vetores da RFC 6238', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('T=%d → %s', (seconds, expected) => {
    expect(hotp(RFC_SECRET, Math.floor(seconds / 30), 8)).toBe(expected);
  });
});

describe('base32', () => {
  it('faz a viagem de ida e volta', () => {
    expect(fromBase32(toBase32(RFC_SECRET)).equals(RFC_SECRET)).toBe(true);
  });
  it('aceita minúsculas e espaços', () => {
    const codificado = toBase32(RFC_SECRET);
    expect(fromBase32(codificado.toLowerCase()).equals(RFC_SECRET)).toBe(true);
  });
  it('recusa caracteres fora do alfabeto', () => {
    expect(() => fromBase32('AAAA1111')).toThrow(/inválido/);
  });
  it('gera segredos de 160 bits por omissão', () => {
    expect(fromBase32(generateSecret())).toHaveLength(20);
  });
  it('dois segredos gerados nunca coincidem', () => {
    expect(generateSecret()).not.toBe(generateSecret());
  });
});

describe('verifyTotp', () => {
  const agora = 1_700_000_000_000;

  it('aceita o código do período atual', () => {
    const code = generateTotp(RFC_BASE32, agora);
    expect(verifyTotp(RFC_BASE32, code, { timestampMs: agora }).valid).toBe(true);
  });

  it('tolera ±30 s de desvio de relógio', () => {
    const anterior = generateTotp(RFC_BASE32, agora - 30_000);
    const seguinte = generateTotp(RFC_BASE32, agora + 30_000);
    expect(verifyTotp(RFC_BASE32, anterior, { timestampMs: agora }).valid).toBe(true);
    expect(verifyTotp(RFC_BASE32, seguinte, { timestampMs: agora }).valid).toBe(true);
  });

  it('recusa desvio de 90 s (fora da janela)', () => {
    const velho = generateTotp(RFC_BASE32, agora - 90_000);
    expect(verifyTotp(RFC_BASE32, velho, { timestampMs: agora }).valid).toBe(false);
  });

  it.each(['12345', '1234567', 'abcdef', '', '12 34 56'])(
    'recusa formato inválido: "%s"', (code) => {
      expect(verifyTotp(RFC_BASE32, code, { timestampMs: agora }).valid).toBe(false);
    });

  it('devolve o período aceite, para registo', () => {
    const code = generateTotp(RFC_BASE32, agora);
    expect(verifyTotp(RFC_BASE32, code, { timestampMs: agora }).counter)
      .toBe(counterFor(agora));
  });
});

describe('proteção contra replay dentro dos 30 s', () => {
  const agora = 1_700_000_000_000;

  it('recusa o mesmo código uma segunda vez', () => {
    const code = generateTotp(RFC_BASE32, agora);
    const primeira = verifyTotp(RFC_BASE32, code, { timestampMs: agora });
    expect(primeira.valid).toBe(true);

    const segunda = verifyTotp(RFC_BASE32, code, {
      timestampMs: agora,
      lastUsedCounter: primeira.counter,
    });
    expect(segunda.valid).toBe(false);
  });

  it('aceita o código do período seguinte após um uso', () => {
    const usado = counterFor(agora);
    const proximo = generateTotp(RFC_BASE32, agora + 30_000);
    expect(verifyTotp(RFC_BASE32, proximo, {
      timestampMs: agora + 30_000, lastUsedCounter: usado,
    }).valid).toBe(true);
  });
});

describe('safeCompare', () => {
  it('compara valores iguais', () => {
    expect(safeCompare('123456', '123456')).toBe(true);
  });
  it('distingue valores diferentes', () => {
    expect(safeCompare('123456', '654321')).toBe(false);
  });
  it('não rebenta com comprimentos diferentes', () => {
    expect(safeCompare('123', '123456')).toBe(false);
  });
});

describe('otpauthUri', () => {
  const uri = otpauthUri(RFC_BASE32, 'ernesto@versaodigitallda.com');

  it('identifica o emissor e a conta', () => {
    expect(uri).toContain('Versao%20Digital');
    expect(uri).toContain('ernesto%40versaodigitallda.com');
  });
  it('declara os parâmetros que as apps precisam', () => {
    expect(uri).toContain('algorithm=SHA1');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });
});
