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

/** Mock LLM for demo mode — returns a placeholder Dashboard response. */
async function mockLLM(prompt: string): Promise<string> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 600));

  const mockDashboard = {
    title: "Revenue Overview Dashboard",
    layout: { columns: 2, rows: 2 },
    charts: [
      {
        id: "chart-revenue",
        chartType: "bar",
        title: "Monthly Revenue",
        position: { col: 1, row: 1, colSpan: 1, rowSpan: 1 },
        dataSource: {
          metrics: ["revenue"],
          dimensions: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        },
        xAxis: { field: "month", label: "Month" },
        yAxis: { field: "revenue", label: "Revenue (¥)" },
        series: [{ name: "Revenue", field: "revenue" }],
      },
      {
        id: "chart-users",
        chartType: "line",
        title: "User Growth",
        position: { col: 2, row: 1, colSpan: 1, rowSpan: 1 },
        dataSource: {
          metrics: ["userCount"],
          dimensions: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
        },
        xAxis: { field: "month", label: "Month" },
        yAxis: { field: "userCount", label: "Users" },
        series: [{ name: "Users", field: "userCount" }],
      },
    ],
    sharedFilters: [],
    dataBindings: [],
  };

  if (prompt.includes("extension assistant")) {
    return JSON.stringify({
      extension: {
        id: "mock-ext",
        description: "Mock dashboard extension for demo",
        newFields: [],
        newRules: [],
      },
      basePayload: mockDashboard,
      extensionPayload: {},
    });
  }

  return JSON.stringify(mockDashboard);
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
