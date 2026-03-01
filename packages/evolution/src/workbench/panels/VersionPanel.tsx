import type { Schema } from "../../types/schema.js";
import type { SchemaRegistryState } from "../hooks/useSchemaRegistry.js";
import { Card } from "../shared/Card.js";
import { Tag } from "../shared/Tag.js";
import { JsonView } from "../shared/JsonView.js";
import { useState } from "react";

export interface VersionPanelProps {
  schemaRegistry: SchemaRegistryState;
}

export function VersionPanel({ schemaRegistry }: VersionPanelProps) {
  const { current, history } = schemaRegistry;
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Version Management</h2>
      <p className="text-sm text-slate-500">
        Schema version history with promote and rollback controls.
      </p>

      {/* Current version */}
      <Card accent="green" title="Current Schema">
        <div className="flex items-center gap-2 mb-3">
          <span className="font-mono text-sm font-medium text-slate-800">
            {current.id}@{current.version}
          </span>
          <Tag label="Active" variant="success" />
        </div>
        <div className="text-xs text-slate-500 mb-2">
          {current.fields.length} fields, {current.rules.length} rules
        </div>
        <JsonView data={schemaToSummary(current)} defaultExpanded={false} />
      </Card>

      {/* Version timeline */}
      <Card title="Version History">
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">No schema versions loaded.</p>
        ) : (
          <div className="space-y-2">
            {[...history].reverse().map((schema) => {
              const isCurrent = schema.version === current.version && schema.id === current.id;
              const isExpanded = expandedVersion === `${schema.id}@${schema.version}`;

              return (
                <div
                  key={`${schema.id}@${schema.version}`}
                  className={`border rounded-lg p-3 ${isCurrent ? "border-green-300 bg-green-50" : "border-slate-200"}`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={() =>
                        setExpandedVersion(
                          isExpanded ? null : `${schema.id}@${schema.version}`,
                        )
                      }
                    >
                      <span className="text-xs text-slate-400">
                        {isExpanded ? "▾" : "▸"}
                      </span>
                      <span className="font-mono text-sm text-slate-700">
                        v{schema.version}
                      </span>
                      {isCurrent && <Tag label="Current" variant="success" />}
                      <span className="text-xs text-slate-500">
                        {schema.fields.length} fields
                      </span>
                    </div>

                    {!isCurrent && (
                      <button
                        onClick={() =>
                          schemaRegistry.rollback(schema.id, schema.version)
                        }
                        className="px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded"
                      >
                        Rollback
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-slate-100">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500">Fields</span>
                          <div className="mt-1 space-y-0.5">
                            {schema.fields.map((f) => (
                              <div key={f.name} className="flex items-center gap-1">
                                <span className="font-mono text-slate-700">{f.name}</span>
                                <span className="text-slate-400">({f.type.kind})</span>
                                {f.required && (
                                  <Tag label="required" variant="info" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500">Rules</span>
                          <div className="mt-1">
                            {schema.rules.length > 0 ? (
                              <JsonView data={schema.rules} defaultExpanded={false} />
                            ) : (
                              <span className="text-slate-400">No rules</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function schemaToSummary(schema: Schema) {
  return {
    fields: schema.fields.map((f) => ({
      name: f.name,
      type: f.type.kind,
      required: f.required,
    })),
    rules: schema.rules.map((r) => r.kind),
  };
}
