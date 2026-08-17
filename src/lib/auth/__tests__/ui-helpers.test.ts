import { describe, expect, it } from 'vitest';
import {
  AUTH_MESSAGES, isCompleteTotpCode, looksLikeEmail, maskEmail, messageFor,
  nextFocusIndex, normalizeEmail, normalizeTotpCode, safeCallbackUrl, spreadPastedCode,
} from '../ui-helpers';

describe('normalizeTotpCode', () => {
  it.each([
    ['123456', '123456'],
    ['123 456', '123456'],
    ['123-456', '123456'],
    ['  123456  ', '123456'],
    ['12345678', '123456'], // trunca ao 6.º dígito
    ['abc123', '123'],
    ['', ''],
  ])('"%s" → "%s"', (input, expected) => {
    expect(normalizeTotpCode(input)).toBe(expected);
  });
});

describe('isCompleteTotpCode', () => {
  it('aceita exatamente 6 dígitos', () => {
    expect(isCompleteTotpCode('123456')).toBe(true);
  });
  it.each(['12345', '1234567', 'abcdef', ''])('recusa "%s"', (code) => {
    expect(isCompleteTotpCode(code)).toBe(false);
  });
});

describe('colar código', () => {
  it('distribui os 6 dígitos pelas caixas', () => {
    expect(spreadPastedCode('123456')).toEqual(['1', '2', '3', '4', '5', '6']);
  });
  it('preenche a partir do início mesmo com código parcial', () => {
    expect(spreadPastedCode('12')).toEqual(['1', '2', '', '', '', '']);
  });
  it('limpa espaços de códigos copiados de apps', () => {
    expect(spreadPastedCode('123 456')).toEqual(['1', '2', '3', '4', '5', '6']);
  });
});

describe('navegação entre caixas', () => {
  it('avança ao escrever', () => {
    expect(nextFocusIndex(0, '1')).toBe(1);
  });
  it('recua ao apagar', () => {
    expect(nextFocusIndex(3, '')).toBe(2);
  });
  it('não passa dos limites', () => {
    expect(nextFocusIndex(5, '9')).toBe(5);
    expect(nextFocusIndex(0, '')).toBe(0);
  });
});

describe('safeCallbackUrl — defesa contra open redirect', () => {
  it('aceita caminhos internos', () => {
    expect(safeCallbackUrl('/cliente/faturas')).toBe('/cliente/faturas');
  });

  const perigosos: ReadonlyArray<readonly [string | null | undefined, string]> = [
    ['//evil.example.com', 'protocolo relativo'],
    ['https://evil.example.com', 'URL absoluto'],
    ['http://evil.example.com', 'URL absoluto http'],
    ['/\\evil.example.com', 'barra invertida'],
    ['evil.example.com', 'sem barra inicial'],
    [null, 'nulo'],
    [undefined, 'indefinido'],
    ['', 'vazio'],
  ];

  it.each(perigosos)('recusa %s (%s) e usa o fallback', (input) => {
    expect(safeCallbackUrl(input)).toBe('/');
  });

  it('respeita o fallback indicado', () => {
    expect(safeCallbackUrl(null, '/admin')).toBe('/admin');
  });
});

describe('mensagens', () => {
  it('conta inexistente e senha errada dizem exatamente o mesmo', () => {
    expect(AUTH_MESSAGES.invalid_credentials).toBe(AUTH_MESSAGES.account_disabled);
    expect(AUTH_MESSAGES.invalid_credentials).toBe(AUTH_MESSAGES.password_required);
  });

  it('a mensagem de magic link não confirma que a conta existe', () => {
    expect(AUTH_MESSAGES.magic_link_sent).toMatch(/^Se existir/);
  });

  it('nenhuma mensagem revela detalhes internos', () => {
    for (const mensagem of Object.values(AUTH_MESSAGES)) {
      expect(mensagem).not.toMatch(/utilizador não encontrado|user not found|hash|token|SQL/i);
    }
  });

  it('chave desconhecida devolve a mensagem genérica', () => {
    expect(messageFor('coisa_estranha')).toBe(AUTH_MESSAGES.unknown);
    expect(messageFor(null)).toBe(AUTH_MESSAGES.unknown);
  });
});

describe('e-mail', () => {
  it('normaliza maiúsculas e espaços', () => {
    expect(normalizeEmail('  Ernesto@VersaoDigitalLda.COM ')).toBe('ernesto@versaodigitallda.com');
  });

  it.each(['a@b.co', 'ernesto@versaodigitallda.com'])('aceita "%s"', (e) => {
    expect(looksLikeEmail(e)).toBe(true);
  });

  it.each(['sem-arroba', '@sem-local.com', 'sem@dominio', 'com espaco@a.com'])(
    'recusa "%s"', (e) => {
      expect(looksLikeEmail(e)).toBe(false);
    });

  it('mascara o e-mail sem esconder o domínio', () => {
    expect(maskEmail('ernesto@versaodigitallda.com')).toBe('er*****@versaodigitallda.com');
  });

  it('não rebenta com entradas estranhas', () => {
    expect(maskEmail('sem-arroba')).toBe('sem-arroba');
  });
});
