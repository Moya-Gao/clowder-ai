/**
 * F167 Phase O PR-O2b: Singleton sample store instance.
 *
 * Module-level singleton — same durability model as OTel counter
 * instances (process-local, reset on restart). Imported by:
 * - Route handlers (to record events after checkGrounding)
 * - F192 eval adapter (to consume sample evidence for verdicts)
 */

import { GroundingSampleStore } from './grounding-sample-store.js';

export const groundingSampleStore = new GroundingSampleStore();
