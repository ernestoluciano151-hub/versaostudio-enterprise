/**
 * Política de rotas partilhada entre o middleware (Edge) e os layouts (Node).
 * Não importa Prisma, Node APIs nem React — tem de compilar no Edge Runtime.
 */

export const SESSION_COOKIE = '__Host-versaostudio.session' as const;

/** Prefixos públicos: acessíveis sem sessão. */
export const PUBLIC_PREFIXES = [
  '/', '/servicos', '/pacotes', '/portfolio', '/blog', '/sobre', '/contacto',
  '/agendar', '/entrar', '/recuperar', '/redefinir',
  '/politica-privacidade', '/termos', '/politica-cookies',
] as const;

/** Prefixos sempre protegidos. */
export const PROTECTED_PREFIXES = ['/admin', '/cliente'] as const;

/** Exceções dentro de /admin acessíveis sem sessão (o próprio login). */
export const ADMIN_PUBLIC_PATHS = ['/admin/entrar'] as const;

/** Ficheiros e rotas internas que o middleware nunca deve processar. */
const BYPASS = /^\/(?:_next|favicon\.ico|robots\.txt|sitemap\.xml|api\/health)/;

export type RouteKind = 'bypass' | 'public' | 'client-area' | 'admin-area';

export function classifyRoute(pathname: string): RouteKind {
  if (BYPASS.test(pathname)) return 'bypass';
  if ((ADMIN_PUBLIC_PATHS as readonly string[]).includes(pathname)) return 'public';
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin-area';
  if (pathname === '/cliente' || pathname.startsWith('/cliente/')) return 'client-area';
  return 'public';
}

export function requiresSession(pathname: string): boolean {
  const kind = classifyRoute(pathname);
  return kind === 'admin-area' || kind === 'client-area';
}

/**
 * Validação ESTRUTURAL do valor do cookie. Não é autenticação.
 * O Edge Runtime não acede à base de dados; a validade real da sessão é
 * verificada em runtime Node (ADR-007, decisão 3).
 */
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{32,256}$/;

export function isWellFormedSessionToken(value: string | undefined): boolean {
  if (!value) return false;
  return TOKEN_SHAPE.test(value);
}

export function loginPathFor(pathname: string): string {
  return classifyRoute(pathname) === 'admin-area' ? '/admin/entrar' : '/entrar';
}

/** Constrói o destino de redirect, preservando o caminho pedido. */
export function buildLoginRedirect(pathname: string, search: string): string {
  const target = `${pathname}${search}`;
  const login = loginPathFor(pathname);
  // Só caminhos internos são aceites como callback — impede open redirect.
  const safe = target.startsWith('/') && !target.startsWith('//') ? target : '/';
  return `${login}?callbackUrl=${encodeURIComponent(safe)}`;
}
