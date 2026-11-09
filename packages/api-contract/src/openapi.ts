import { ERROR_STATUS, PAGE_LIMIT_DEFAULT, PAGE_LIMIT_MAX, SECTION_11_ROUTES } from './keyfolio-v1.js';

const envelope = (data: object) => ({ type: 'object', required: ['data', 'meta', 'error'], properties: { data, meta: { $ref: '#/components/schemas/Meta' }, error: { type: 'null' } } });
const failure = { type: 'object', required: ['data', 'meta', 'error'], properties: { data: { type: 'null' }, meta: { $ref: '#/components/schemas/Meta' }, error: { $ref: '#/components/schemas/Error' } } };

export function buildOpenApiDocument() {
  const paths: Record<string, unknown> = {};
  for (const route of SECTION_11_ROUTES) {
    const path = route.path.replaceAll(/:([A-Za-z0-9_]+)/g, '{$1}');
    const method = route.method.toLowerCase();
    const responses: Record<string, unknown> = {};
    for (const [status, meaning] of Object.entries(route.statuses)) {
      responses[status] = { description: meaning, content: { 'application/json': { schema: meaning === 'success' ? { $ref: '#/components/schemas/Envelope' } : failure } } };
    }
    const operation: Record<string, unknown> = { operationId: `${route.method}_${route.path.replaceAll(/[^A-Za-z0-9]+/g, '_').replace(/^_/, '').toLowerCase()}`, 'x-auth-boundary': route.auth, 'x-response-data': route.response, 'x-page-limit-default': PAGE_LIMIT_DEFAULT, 'x-page-limit-max': PAGE_LIMIT_MAX, responses };
    if (path.includes('{')) operation.parameters = [{ name: path.match(/\{[^}]+\}/)?.[0].slice(1, -1), in: 'path', required: true, schema: { type: 'string' } }];
    paths[path] = { ...(paths[path] as object | undefined), [method]: operation };
  }
  return {
    openapi: '3.1.0', info: { title: 'Keyfolio internal REST API', version: 'v1', description: 'KF-02b frozen browser-safe wire contract. Provider upstream routes are intentionally not described.' },
    paths,
    components: { schemas: {
      Meta: { type: 'object', required: ['request_id', 'observed_at', 'coverage', 'stale'], properties: { request_id: { type: 'string' }, observed_at: { type: 'string', format: 'date-time' }, coverage: { type: 'string' }, stale: { type: 'boolean' } } },
      Error: { type: 'object', required: ['code', 'message', 'retryable'], properties: { code: { type: 'string', enum: Object.keys(ERROR_STATUS) }, message: { type: 'string' }, retryable: { type: 'boolean' } } },
      Envelope: { type: 'object', required: ['data', 'meta', 'error'], properties: { data: {}, meta: { $ref: '#/components/schemas/Meta' }, error: { type: 'null' } } },
      AtomicAmount: { type: 'string', pattern: '^(0|[1-9][0-9]*)$', maxLength: 39, 'x-u128-maximum': '340282366920938463463374607431768211455', description: 'Canonical unsigned u128 atomic string; JSON numbers and fractions are invalid.' },
      OpaqueCursor: { type: 'string', minLength: 1, maxLength: 512, description: 'Opaque server-issued cursor; never a SQL offset.' },
      Page: { type: 'object', required: ['items', 'next_cursor', 'limit'], properties: { items: { type: 'array' }, next_cursor: { anyOf: [{ $ref: '#/components/schemas/OpaqueCursor' }, { type: 'null' }] }, limit: { type: 'integer', minimum: 1, maximum: PAGE_LIMIT_MAX, default: PAGE_LIMIT_DEFAULT } } },
    } },
  };
}

export const KEYFOLIO_OPENAPI = buildOpenApiDocument();
