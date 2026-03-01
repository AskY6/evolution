import { useState, useCallback, useMemo } from "react";
import type { Schema, CandidateSchema } from "../../types/schema.js";
import type { SchemaRegistry } from "../../schema-registry.js";

export interface SchemaRegistryState {
  current: Schema;
  history: ReadonlyArray<Schema>;
  promote: (candidate: CandidateSchema, newVersion: string) => Schema;
  rollback: (id: string, version: string) => void;
  refresh: () => void;
}

export function useSchemaRegistry(registry: SchemaRegistry): SchemaRegistryState {
  const [version, setVersion] = useState(0);

  const current = useMemo(() => registry.current(), [registry, version]);
  const history = useMemo(() => registry.history(), [registry, version]);

  const promote = useCallback(
    (candidate: CandidateSchema, newVersion: string): Schema => {
      const promoted = registry.promote(candidate, newVersion);
      setVersion((v) => v + 1);
      return promoted;
    },
    [registry],
  );

  const rollback = useCallback(
    (id: string, ver: string) => {
      registry.rollback(id, ver);
      setVersion((v) => v + 1);
    },
    [registry],
  );

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  return { current, history, promote, rollback, refresh };
}
