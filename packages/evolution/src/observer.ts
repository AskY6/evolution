// Phase 2, Week 11: DemonstrationSource interface

import type { Demonstration } from "./types/demonstration.js";

/** External source of expert demonstrations — the trigger for evolution. */
export interface DemonstrationSource {
  subscribe(callback: (demo: Demonstration) => void): void;
}
