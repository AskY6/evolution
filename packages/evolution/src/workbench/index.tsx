/**
 * Workbench — framework-provided training interface.
 *
 * Entry point: <Workbench adapter={...} registry={...} engine={...} demoStore={...} />
 *
 * Renders a sidebar navigation + main content area with 5 panels:
 * - Demo Library: manage demonstrations
 * - Playground: test current schema capability
 * - Training Ground: full evolution with promote control
 * - Boundary View: evolution statistics
 * - Version Management: schema history + rollback
 */

import { useState } from "react";
import type { PanelId, WorkbenchProps } from "./types.js";
import { Shell } from "./layout/Shell.js";
import { Nav } from "./layout/Nav.js";
import { DemoLibrary } from "./panels/DemoLibrary.js";
import { Playground } from "./panels/Playground.js";
import { TrainingGround } from "./panels/TrainingGround.js";
import { BoundaryView } from "./panels/BoundaryView.js";
import { VersionPanel } from "./panels/VersionPanel.js";
import { useSchemaRegistry } from "./hooks/useSchemaRegistry.js";
import { useDemos } from "./hooks/useDemos.js";
import { usePipeline } from "./hooks/usePipeline.js";

export function Workbench({ adapter, registry, engine, demoStore }: WorkbenchProps) {
  const [activePanel, setActivePanel] = useState<PanelId>("demos");
  const schemaRegistry = useSchemaRegistry(registry);
  const demos = useDemos(demoStore);
  const pipeline = usePipeline(engine);

  const preview = adapter.preview;

  return (
    <Shell
      sidebar={
        <Nav
          activePanel={activePanel}
          onNavigate={setActivePanel}
          schemaVersion={schemaRegistry.current.version}
        />
      }
    >
      {activePanel === "demos" && (
        <DemoLibrary
          demos={demos}
          schema={schemaRegistry.current}
          onSelectDemo={(demo) => {
            setActivePanel("playground");
          }}
        />
      )}
      {activePanel === "playground" && (
        <Playground
          schema={schemaRegistry.current}
          pipeline={pipeline}
          preview={preview}
        />
      )}
      {activePanel === "training" && (
        <TrainingGround
          demos={demos}
          pipeline={pipeline}
          schemaRegistry={schemaRegistry}
          preview={preview}
        />
      )}
      {activePanel === "boundary" && (
        <BoundaryView records={registry.history().flatMap(() => [])} />
      )}
      {activePanel === "versions" && (
        <VersionPanel schemaRegistry={schemaRegistry} />
      )}
    </Shell>
  );
}

// Barrel exports
export type {
  WorkbenchProps,
  WorkbenchAdapter,
  EvolutionEngine,
  EvolutionRunResult,
  DemoStore,
  PanelId,
  PreviewConfig,
  PreviewCapability,
  DiffViewData,
  LogLine,
  PipelineEvent,
  PipelineEventListener,
} from "./types.js";

export { createEvolutionEngine, type EngineConfig } from "./engine.js";

export { Card, Tag, JsonView, Terminal, PipelineFlow, PreviewSlot, SplitDiff } from "./shared/index.js";
export { Shell, Nav } from "./layout/index.js";
export { useSchemaRegistry, useDemos, usePipeline } from "./hooks/index.js";
