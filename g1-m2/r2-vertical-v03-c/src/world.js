import { createWorldWithSupport, replayWithSupport } from '../../r2-vertical-v03-a/src/world.js';
import { supportPolicy } from '../../r2-vertical-v03-b/src/support-graph.js';
import { openingPolicy } from './opening-intents.js';

export { POLICY_VERSION } from './opening-intents.js';

export function createWorld(config, hooks) {
  return createWorldWithSupport(supportPolicy, config, hooks, openingPolicy);
}

export function replay(journal) {
  return replayWithSupport(supportPolicy, journal, openingPolicy);
}
