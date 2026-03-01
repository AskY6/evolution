import { useState, useCallback, useEffect, useRef } from "react";
import type { Stage } from "../../types/pipeline.js";
import type {
  EvolutionEngine,
  EvolutionRunResult,
  LogLine,
  PipelineEvent,
} from "../types.js";
import type { Demonstration } from "../../types/demonstration.js";
import type { ApproxOutcome } from "../../types/pipeline.js";

export interface PipelineState {
  running: boolean;
  phase: "idle" | "approximation" | "extension";
  activeStage: Stage | undefined;
  logs: LogLine[];
  result: EvolutionRunResult | null;
  approxResult: ApproxOutcome | null;
  error: string | null;
  runEvolution: (demo: Demonstration) => Promise<void>;
  runApproximation: (demo: Demonstration) => Promise<void>;
  clearLogs: () => void;
}

export function usePipeline(engine: EvolutionEngine): PipelineState {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<PipelineState["phase"]>("idle");
  const [activeStage, setActiveStage] = useState<Stage | undefined>(undefined);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [result, setResult] = useState<EvolutionRunResult | null>(null);
  const [approxResult, setApproxResult] = useState<ApproxOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const logsRef = useRef<LogLine[]>([]);

  useEffect(() => {
    const unsub = engine.subscribe((event: PipelineEvent) => {
      switch (event.kind) {
        case "pipeline:start":
          setPhase(event.phase);
          break;
        case "stage:enter":
          setActiveStage(event.stage);
          break;
        case "stage:complete":
          break;
        case "stage:error":
          setError(event.error);
          break;
        case "log":
          logsRef.current = [...logsRef.current, event.line];
          setLogs(logsRef.current);
          break;
        case "pipeline:complete":
          setActiveStage(undefined);
          break;
      }
    });
    return unsub;
  }, [engine]);

  const clearLogs = useCallback(() => {
    logsRef.current = [];
    setLogs([]);
    setResult(null);
    setApproxResult(null);
    setError(null);
    setPhase("idle");
    setActiveStage(undefined);
  }, []);

  const runEvolution = useCallback(
    async (demo: Demonstration) => {
      clearLogs();
      setRunning(true);
      try {
        const res = await engine.runEvolution(demo);
        setResult(res);
        if (res.kind === "failed") {
          setError(res.message);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setRunning(false);
        setPhase("idle");
      }
    },
    [engine, clearLogs],
  );

  const runApproximation = useCallback(
    async (demo: Demonstration) => {
      clearLogs();
      setRunning(true);
      setPhase("approximation");
      try {
        const res = await engine.runApproximation(demo);
        setApproxResult(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setRunning(false);
        setPhase("idle");
      }
    },
    [engine, clearLogs],
  );

  return {
    running,
    phase,
    activeStage,
    logs,
    result,
    approxResult,
    error,
    runEvolution,
    runApproximation,
    clearLogs,
  };
}
