/** Erros de autorização. Todos falham FECHADO por omissão. */

export class UnauthenticatedError extends Error {
  readonly status = 401 as const;
  constructor(message = 'Autenticação necessária.') {
    super(message);
    this.name = 'UnauthenticatedError';
  }
}

export class ForbiddenError extends Error {
  readonly status = 403 as const;
  constructor(
    readonly permission: string,
    message = 'Sem permissão para esta operação.',
  ) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Devolvido quando o registo existe mas não pertence ao ator.
 * 404 e não 403: 403 confirmaria a existência do registo (fuga de informação).
 */
export class NotFoundError extends Error {
  readonly status = 404 as const;
  constructor(message = 'Não encontrado.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class MfaRequiredError extends Error {
  readonly status = 403 as const;
  constructor(message = 'Verificação de dois fatores necessária.') {
    super(message);
    this.name = 'MfaRequiredError';
  }
}
