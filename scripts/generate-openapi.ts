import { writeFile } from 'node:fs/promises';
import { KEYFOLIO_OPENAPI } from '../packages/api-contract/src/openapi.js';
await writeFile('docs/openapi/keyfolio-v1.json', `${JSON.stringify(KEYFOLIO_OPENAPI, null, 2)}\n`, 'utf8');
