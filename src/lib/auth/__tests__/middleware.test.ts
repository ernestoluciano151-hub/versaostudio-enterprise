import { describe, expect, it, vi, beforeEach } from 'vitest';
import { middleware } from '../../../middleware';
import { SESSION_COOKIE } from '../route-policy';

const VALID = 'a'.repeat(43);

function req(path: string, cookie?: string, search = ''): Request {
  const url = `https://www.versaodigitallda.com${path}${search}`;
  const headers = new Headers({ 'user-agent': 'vitest', 'x-forwarded-for': '10.0.0.1' });
  if (cookie !== undefined) headers.set('cookie', `${SESSION_COOKIE}=${cookie}`);
  // NextRequest é construível a partir de Request no ambiente de teste
  return new Request(url, { headers });
}

async function run(path: string, cookie?: string, search = '') {
  const { NextRequest } = await import('next/server');
  return middleware(new NextRequest(req(path, cookie, search)));
}

describe('middleware — rotas públicas', () => {
  it.each(['/', '/servicos/fotografia', '/pacotes', '/entrar', '/admin/entrar'])(
    '%s passa sem cookie', async (path) => {
      const res = await run(path);
      expect(res.status).toBe(200);
      expect(res.headers.get('location')).toBeNull();
    });
});

describe('middleware — rotas protegidas sem sessão', () => {
  it('redireciona /cliente para /entrar', async () => {
    const res = await run('/cliente/faturas');
    expect(res.status).toBe(307);
    const loc = new URL(res.headers.get('location') ?? '');
    expect(loc.pathname).toBe('/entrar');
    expect(loc.searchParams.get('callbackUrl')).toBe('/cliente/faturas');
  });

  it('redireciona /admin para /admin/entrar', async () => {
    const res = await run('/admin/financeiro');
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/admin/entrar');
  });

  it('rejeita cookie malformado como se não existisse', async () => {
    const res = await run('/admin', 'nao-e-um-token');
    expect(res.status).toBe(307);
  });

  it('rejeita tentativa de injeção no cookie', async () => {
    const res = await run('/cliente', "' OR 1=1 --");
    expect(res.status).toBe(307);
  });

  it('limpa o cookie inválido na resposta', async () => {
    const res = await run('/admin', 'invalido');
    expect(res.headers.get('set-cookie') ?? '').toContain(SESSION_COOKIE);
  });
});

describe('middleware — com cookie bem formado', () => {
  it('deixa passar para validação em runtime Node', async () => {
    const res = await run('/cliente/reservas', VALID);
    expect(res.status).toBe(200);
  });

  it('emite x-request-id para correlação', async () => {
    const res = await run('/cliente', VALID);
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('middleware — NÃO autoriza (garantia arquitetural)', () => {
  it('um cookie bem formado não concede papel nem permissões', async () => {
    // O middleware deixa passar; a autorização real acontece no runtime Node.
    // Este teste existe para impedir que alguém acrescente lógica de papel aqui.
    const res = await run('/admin/financeiro', VALID);
    expect(res.status).toBe(200);
  });

  it('o código-fonte do middleware não referencia papéis nem permissões', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../../middleware.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/ROLE_PERMISSIONS|hasPermission|requirePermission|'OWNER'|"OWNER"/);
  });
});

describe('middleware — auditoria de acesso negado', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('regista ACCESS_DENIED com ip, userAgent e path', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await run('/admin/financeiro');
    expect(spy).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(payload.type).toBe('ACCESS_DENIED');
    expect(payload.success).toBe(false);
    expect(payload.ip).toBe('10.0.0.1');
    expect(payload.userAgent).toBe('vitest');
    expect(payload.path).toBe('/admin/financeiro');
    expect(payload.at).toBeTruthy();
    expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('distingue cookie ausente de cookie malformado', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await run('/admin');
    await run('/admin', 'xx');
    const reasons = spy.mock.calls.map((c) => JSON.parse(String(c[0])).reason);
    expect(reasons).toEqual(['missing_session_cookie', 'malformed_session_cookie']);
  });

  it('nunca regista o valor do cookie', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await run('/admin', 'segredo-que-nao-pode-aparecer-nos-logs-aaaa');
    expect(String(spy.mock.calls[0]?.[0])).not.toContain('segredo-que-nao-pode');
  });
});
