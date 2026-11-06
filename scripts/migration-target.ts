// Pure decision for which migration engine a command targets. External
// migration REQUIRES DATABASE_URL and never implicitly falls back to the
// ephemeral engine; the ephemeral engine is reachable only through the
// explicitly-named local command.

export type MigrationTarget =
  | { kind: 'external'; url: string }
  | { kind: 'missing_url'; reason: string };

export function resolveMigrationTarget(env: { DATABASE_URL?: string }): MigrationTarget {
  const url = env.DATABASE_URL;
  if (!url || url.trim() === '') {
    return {
      kind: 'missing_url',
      reason:
        'DATABASE_URL is required to run an external migration. There is no implicit ephemeral fallback; ' +
        'use the explicitly local command (pnpm db:migrate:local) for the isolated PGlite engine.',
    };
  }
  return { kind: 'external', url };
}