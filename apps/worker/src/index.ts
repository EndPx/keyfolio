import { requireAppConfig } from '@keyfolio/domain';
import { decideWorkerAction } from './action.js';

const config = requireAppConfig(process.env);
const action = decideWorkerAction(config.mode);

console.log(`[worker] ${action.message}`);

if (action.kind === 'refuse') {
  process.exit(2);
}
process.exit(0);