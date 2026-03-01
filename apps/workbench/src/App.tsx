import { useMemo } from "react";
import { SchemaRegistry } from "@evolution/core";
import { BiAdapter, BiApproximate, BiExtend } from "./bi";
import {
  Workbench,
  createEvolutionEngine,
  type WorkbenchAdapter,
} from "@evolution/core/workbench";
import { createLocalDemoStore } from "./demo-store";
import { biSchemaV010 } from "./schema";

/** Mock LLM for demo mode — returns a placeholder response. */
async function mockLLM(prompt: string): Promise<string> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 500));

  // Return a minimal valid response based on prompt content
  if (prompt.includes("extension assistant")) {
    return JSON.stringify({
      extension: {
        id: "mock-ext",
        description: "Mock extension for demo",
        newFields: [],
        newRules: [],
      },
      basePayload: {
        chartType: "bar",
        title: "Mock Chart",
        dataSource: { metrics: ["revenue"], dimensions: ["month"] },
        xAxis: { field: "month" },
        yAxis: { field: "revenue" },
        series: [{ name: "Revenue", field: "revenue" }],
      },
      extensionPayload: {},
    });
  }

  return JSON.stringify({
    chartType: "bar",
    title: "Mock Chart",
    dataSource: {
      metrics: ["revenue"],
      dimensions: ["month"],
    },
    xAxis: { field: "month" },
    yAxis: { field: "revenue" },
    series: [{ name: "Revenue", field: "revenue" }],
  });
}

export function App() {
  const { adapter, registry, engine, demoStore } = useMemo(() => {
    const registry = new SchemaRegistry();
    registry.load(biSchemaV010);

    const biAdapter = new BiAdapter();
    const adapter: WorkbenchAdapter = biAdapter;

    const approximateAction = new BiApproximate(mockLLM);
    const extendAction = new BiExtend(mockLLM);

    const engine = createEvolutionEngine({
      schema: () => registry.current(),
      adapter: biAdapter,
      approximateAction,
      extendAction,
      convergenceConfig: { maxIterations: 3, gapThreshold: 1 },
    });

    const demoStore = createLocalDemoStore();

    return { adapter, registry, engine, demoStore };
  }, []);

  return (
    <Workbench
      adapter={adapter}
      registry={registry}
      engine={engine}
      demoStore={demoStore}
    />
  );
}
