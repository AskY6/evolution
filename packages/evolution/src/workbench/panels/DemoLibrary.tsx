import { useState } from "react";
import type { Demonstration, Schema } from "../../types/index.js";
import type { DemosState } from "../hooks/useDemos.js";
import { Card } from "../shared/Card.js";
import { Tag } from "../shared/Tag.js";
import { JsonView } from "../shared/JsonView.js";

export interface DemoLibraryProps {
  demos: DemosState;
  schema: Schema;
  onSelectDemo?: (demo: Demonstration) => void;
}

export function DemoLibrary({ demos, schema, onSelectDemo }: DemoLibraryProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedDemo = selectedId ? demos.get(selectedId) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Demo Library</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          {showAddForm ? "Cancel" : "Add Demo"}
        </button>
      </div>

      {showAddForm && (
        <AddDemoForm
          schema={schema}
          onAdd={(demo) => {
            demos.add(demo);
            setShowAddForm(false);
          }}
        />
      )}

      {demos.demos.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500 text-center py-4">
            No demonstrations yet. Add one to get started.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {demos.demos.map((demo) => (
            <Card key={demo.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <div
                className="flex items-center justify-between"
                onClick={() => setSelectedId(selectedId === demo.id ? null : demo.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-700">
                    {demo.source.type}
                  </span>
                  <Tag
                    label={demo.source.uri ?? demo.id}
                    variant="neutral"
                  />
                  <SchemaTag demo={demo} schema={schema} />
                </div>
                <div className="flex items-center gap-2">
                  {onSelectDemo && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDemo(demo);
                      }}
                      className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                    >
                      Try
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      demos.remove(demo.id);
                      if (selectedId === demo.id) setSelectedId(null);
                    }}
                    className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {selectedId === demo.id && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">Observed Behavior</div>
                  <JsonView data={demo.observedBehavior.fingerprint} defaultExpanded={true} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SchemaTag({ demo, schema }: { demo: Demonstration; schema: Schema }) {
  // Simple heuristic: check if the demo's fingerprint keys are a subset of schema fields
  const fieldNames = new Set(schema.fields.map((f) => f.name));
  const fpKeys = Object.keys(demo.observedBehavior.fingerprint);
  const isSchemaIn = fpKeys.length > 0 && fpKeys.every((k) => fieldNames.has(k));

  return (
    <Tag
      label={isSchemaIn ? "Schema-in" : "Schema-out"}
      variant={isSchemaIn ? "success" : "warning"}
    />
  );
}

function AddDemoForm({
  schema,
  onAdd,
}: {
  schema: Schema;
  onAdd: (demo: Demonstration) => void;
}) {
  const [sourceType, setSourceType] = useState("manual");
  const [sourceJson, setSourceJson] = useState("{}");
  const [behaviorJson, setBehaviorJson] = useState("{}");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    try {
      const raw = JSON.parse(sourceJson);
      const fingerprint = JSON.parse(behaviorJson);
      const demo: Demonstration = {
        id: `demo-${Date.now()}`,
        timestamp: new Date().toISOString(),
        source: { type: sourceType, raw },
        observedBehavior: { fingerprint },
      };
      onAdd(demo);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    }
  };

  return (
    <Card accent="blue" title="Add Demonstration">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Source Type
          </label>
          <input
            type="text"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Source Data (JSON)
          </label>
          <textarea
            value={sourceJson}
            onChange={(e) => setSourceJson(e.target.value)}
            rows={3}
            className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Observed Behavior Fingerprint (JSON)
          </label>
          <textarea
            value={behaviorJson}
            onChange={(e) => setBehaviorJson(e.target.value)}
            rows={3}
            className="w-full px-3 py-1.5 text-sm font-mono border border-slate-300 rounded-md"
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          onClick={handleSubmit}
          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Add
        </button>
      </div>
    </Card>
  );
}
