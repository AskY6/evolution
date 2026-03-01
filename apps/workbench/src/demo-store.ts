import type { Demonstration } from "@evolution/core";
import type { DemoStore } from "@evolution/core/workbench";

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
