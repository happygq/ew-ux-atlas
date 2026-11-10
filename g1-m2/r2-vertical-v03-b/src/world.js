import { createWorldWithSupport, replayWithSupport } from '../../r2-vertical-v03-a/src/world.js';
import { supportPolicy } from './support-graph.js';

export { POLICY_VERSION } from './support-graph.js';

export function createWorld(config, hooks) {
  return createWorldWithSupport(supportPolicy, config, hooks);
}

export function replay(journal) {
  return replayWithSupport(supportPolicy, journal);
}
