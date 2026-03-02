import type { Demonstration } from "@evolution/core";
import type { DemoStore } from "@evolution/core/workbench";

// ---------------------------------------------------------------------------
// localStorage store — fallback / offline
// ---------------------------------------------------------------------------

const STORAGE_KEY = "evolution-workbench-demos";

export function createLocalDemoStore(): DemoStore {
  function load(): Demonstration[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function save(demos: Demonstration[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(demos));
  }

  return {
    list(): Demonstration[] {
      return load();
    },

    get(id: string): Demonstration | undefined {
      return load().find((d) => d.id === id);
    },

    add(demo: Demonstration): void {
      const demos = load();
      demos.push(demo);
      save(demos);
    },

    remove(id: string): void {
      const demos = load().filter((d) => d.id !== id);
      save(demos);
    },
  };
}

// ---------------------------------------------------------------------------
// .evolution/ folder store — backed by the Vite dev server API
// ---------------------------------------------------------------------------

/**
 * Creates a DemoStore backed by .evolution/demos/ on disk.
 *
 * Keeps an in-memory copy for synchronous reads (satisfying DemoStore's
 * sync interface). Mutations optimistically update memory and fire-and-forget
 * a write to the /api/demos endpoint served by the Vite evolutionPlugin.
 *
 * @param initial - demonstrations pre-loaded from GET /api/demos
 */
export function createEvolutionFolderStore(initial: Demonstration[]): DemoStore {
  let demos: Demonstration[] = [...initial];

  return {
    list(): Demonstration[] {
      return demos;
    },

    get(id: string): Demonstration | undefined {
      return demos.find((d) => d.id === id);
    },

    add(demo: Demonstration): void {
      demos = [...demos, demo];
      fetch("/api/demos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(demo),
      }).catch(console.error);
    },

    remove(id: string): void {
      demos = demos.filter((d) => d.id !== id);
      fetch(`/api/demos/${id}`, { method: "DELETE" }).catch(console.error);
    },
  };
}
