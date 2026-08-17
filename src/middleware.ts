import { NextResponse, type NextRequest } from 'next/server';
import {
  SESSION_COOKIE, buildLoginRedirect, classifyRoute,
  isWellFormedSessionToken, requiresSession,
} from '@/lib/auth/route-policy';
import { createConsoleRecorder } from '@/lib/auth/audit';

/**
 * MIDDLEWARE — Camada 1 de 3.
 *
 * O que FAZ:  verifica presença e forma do cookie de sessão; redireciona quem
 *             não tem sessão; regista tentativas de acesso negado.
 * O que NÃO FAZ: autorizar. Corre no Edge Runtime, sem acesso à base de dados.
 *             Papel e permissões são resolvidos em runtime Node, a partir de
 *             `Membership`, a cada pedido (ADR-007).
 *
 * O cookie transporta APENAS um identificador opaco de sessão:
 * zero papéis, zero permissões. Alterá-lo não concede acesso — invalida a sessão.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname, search } = request.nextUrl;

  if (classifyRoute(pathname) === 'bypass') return NextResponse.next();
  if (!requiresSession(pathname)) return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!isWellFormedSessionToken(token)) {
    const requestId = crypto.randomUUID();
    await createConsoleRecorder().record({
      type: 'ACCESS_DENIED',
      success: false,
      reason: token ? 'malformed_session_cookie' : 'missing_session_cookie',
      context: {
        ip: request.headers.get('x-forwarded-for') ?? request.headers.get('cf-connecting-ip'),
        userAgent: request.headers.get('user-agent'),
        path: pathname,
        requestId,
      },
    });

    const response = NextResponse.redirect(
      new URL(buildLoginRedirect(pathname, search), request.url),
    );
    response.cookies.delete(SESSION_COOKIE);
    response.headers.set('x-request-id', requestId);
    return response;
  }

  const response = NextResponse.next();
  response.headers.set('x-request-id', crypto.randomUUID());
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
