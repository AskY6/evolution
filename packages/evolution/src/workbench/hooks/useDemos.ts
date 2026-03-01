import { useState, useCallback, useMemo } from "react";
import type { Demonstration } from "../../types/demonstration.js";
import type { DemoStore } from "../types.js";

export interface DemosState {
  demos: Demonstration[];
  add: (demo: Demonstration) => void;
  remove: (id: string) => void;
  get: (id: string) => Demonstration | undefined;
}

export function useDemos(store: DemoStore): DemosState {
  const [version, setVersion] = useState(0);

  const demos = useMemo(() => store.list(), [store, version]);

  const add = useCallback(
    (demo: Demonstration) => {
      store.add(demo);
      setVersion((v) => v + 1);
    },
    [store],
  );

  const remove = useCallback(
    (id: string) => {
      store.remove(id);
      setVersion((v) => v + 1);
    },
    [store],
  );

  const get = useCallback((id: string) => store.get(id), [store]);

  return { demos, add, remove, get };
}
