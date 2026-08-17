import { describe, expect, it } from 'vitest';
import {
  buildLoginRedirect, classifyRoute, isWellFormedSessionToken,
  loginPathFor, requiresSession,
} from '../route-policy';

const VALID = 'a'.repeat(43);

describe('classifyRoute', () => {
  it.each([
    ['/_next/static/x.js', 'bypass'],
    ['/favicon.ico', 'bypass'],
    ['/api/health', 'bypass'],
    ['/', 'public'],
    ['/servicos/fotografia', 'public'],
    ['/entrar', 'public'],
    ['/admin/entrar', 'public'],
    ['/admin', 'admin-area'],
    ['/admin/financeiro', 'admin-area'],
    ['/cliente', 'client-area'],
    ['/cliente/faturas', 'client-area'],
  ] as const)('%s → %s', (path, kind) => {
    expect(classifyRoute(path)).toBe(kind);
  });

  it('não confunde prefixos parecidos com áreas protegidas', () => {
    expect(classifyRoute('/administracao')).toBe('public');
    expect(classifyRoute('/clientes-felizes')).toBe('public');
  });
});

describe('requiresSession', () => {
  it('exige sessão em /admin e /cliente', () => {
    expect(requiresSession('/admin/crm')).toBe(true);
    expect(requiresSession('/cliente/reservas')).toBe(true);
  });
  it('não exige em rotas públicas nem no login de admin', () => {
    expect(requiresSession('/pacotes')).toBe(false);
    expect(requiresSession('/admin/entrar')).toBe(false);
  });
});

describe('isWellFormedSessionToken', () => {
  it('aceita token com forma válida', () => {
    expect(isWellFormedSessionToken(VALID)).toBe(true);
  });
  const invalidos: ReadonlyArray<readonly [string | undefined, string]> = [
    [undefined, 'ausente'],
    ['', 'vazio'],
    ['curto', 'curto demais'],
    ['a'.repeat(300), 'longo demais'],
    ['tem espaço aqui!!!!!!!!!!!!!!!!!!!!!!!!!', 'caracteres inválidos'],
    ["' OR 1=1 --aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", 'tentativa de injeção'],
  ];

  it.each(invalidos)('rejeita %s (%s)', (value) => {
    expect(isWellFormedSessionToken(value)).toBe(false);
  });

  it('NÃO é autenticação — apenas forma', () => {
    // Um token bem formado mas inexistente passa aqui e é recusado no runtime Node.
    expect(isWellFormedSessionToken('z'.repeat(64))).toBe(true);
  });
});

describe('redirect de login', () => {
  it('envia staff para o login de admin', () => {
    expect(loginPathFor('/admin/financeiro')).toBe('/admin/entrar');
  });
  it('envia cliente para o login público', () => {
    expect(loginPathFor('/cliente/faturas')).toBe('/entrar');
  });
  it('preserva o destino pedido', () => {
    expect(buildLoginRedirect('/cliente/faturas', '?page=2'))
      .toBe('/entrar?callbackUrl=%2Fcliente%2Ffaturas%3Fpage%3D2');
  });
  it('bloqueia open redirect para domínio externo', () => {
    expect(buildLoginRedirect('//evil.example.com', '')).toBe('/entrar?callbackUrl=%2F');
  });
});
