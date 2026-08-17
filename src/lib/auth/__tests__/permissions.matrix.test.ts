import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, type Permission } from '../permissions';

/**
 * SINCRONIZAÇÃO CÓDIGO ↔ DOCUMENTAÇÃO.
 * `docs/security/rbac.md §4` é a fonte única. Este teste falha se divergirem.
 */

const HEADER_TO_ROLE = {
  OWN: 'OWNER', ADM: 'ADMIN', FIN: 'FINANCE_MANAGER', PRD: 'PRODUCER',
  PHO: 'PHOTOGRAPHER', VID: 'VIDEOGRAPHER', EDT: 'EDITOR', CNT: 'CONTENT_MANAGER',
  SAL: 'SALES', STF: 'STAFF', CLI: 'CLIENT',
} as const;
const HEADERS = Object.keys(HEADER_TO_ROLE) as (keyof typeof HEADER_TO_ROLE)[];

function parseMatrix(): Map<string, Map<string, string>> {
  const md = readFileSync(join(process.cwd(), 'docs/security/rbac.md'), 'utf8');
  const section = md.split('## 4. Matriz')[1]?.split('## 4-A.')[0] ?? '';
  const out = new Map<string, Map<string, string>>();
  for (const line of section.split('\n')) {
    const m = /^\|\s*\*{0,2}`([a-z_]+:[a-z_]+)`\*{0,2}\s*\|(.+)\|\s*$/.exec(line.trim());
    if (!m) continue;
    const cells = (m[2] ?? '').split('|').map((c) => c.trim());
    const row = new Map<string, string>();
    HEADERS.forEach((h, i) => row.set(HEADER_TO_ROLE[h], cells[i] ?? ''));
    out.set(m[1] ?? '', row);
  }
  return out;
}

describe('permissions.ts espelha docs/security/rbac.md', () => {
  const matrix = parseMatrix();

  it('a matriz do documento foi lida', () => {
    expect(matrix.size).toBeGreaterThan(0);
  });

  it('o conjunto de permissões é idêntico', () => {
    expect([...matrix.keys()].sort()).toEqual([...PERMISSIONS].sort());
  });

  it.each(ROLES)('%s: as 73 células coincidem com o documento', (role) => {
    const grants = ROLE_PERMISSIONS[role];
    for (const permission of PERMISSIONS) {
      const cell = matrix.get(permission)?.get(role);
      const expected =
        cell === '✅' ? 'full' : cell === '🔒' ? 'owned' : 'none';
      const actual = grants.full.includes(permission)
        ? 'full'
        : grants.owned.includes(permission)
          ? 'owned'
          : 'none';
      expect(actual, `${role} × ${permission}`).toBe(expected);
    }
  });

  it('cobre as 803 células (11 papéis × 73 permissões)', () => {
    expect(ROLES.length * PERMISSIONS.length).toBe(803);
  });

  it('nenhuma permissão está simultaneamente em full e owned', () => {
    for (const role of ROLES) {
      const { full, owned } = ROLE_PERMISSIONS[role];
      const overlap = full.filter((p) => (owned as readonly Permission[]).includes(p));
      expect(overlap, `${role}`).toEqual([]);
    }
  });
});
