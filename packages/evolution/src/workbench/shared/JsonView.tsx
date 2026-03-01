import { useState } from "react";

export interface JsonViewProps {
  data: unknown;
  name?: string;
  defaultExpanded?: boolean;
  className?: string;
}

export function JsonView({
  data,
  name,
  defaultExpanded = true,
  className = "",
}: JsonViewProps) {
  return (
    <div className={`font-mono text-xs ${className}`}>
      <JsonNode data={data} name={name} depth={0} defaultExpanded={defaultExpanded} />
    </div>
  );
}

interface JsonNodeProps {
  data: unknown;
  name?: string;
  depth: number;
  defaultExpanded: boolean;
}

function JsonNode({ data, name, depth, defaultExpanded }: JsonNodeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded && depth < 3);

  if (data === null) return <Leaf name={name} value="null" color="text-slate-400" />;
  if (data === undefined) return <Leaf name={name} value="undefined" color="text-slate-400" />;
  if (typeof data === "boolean") return <Leaf name={name} value={String(data)} color="text-purple-600" />;
  if (typeof data === "number") return <Leaf name={name} value={String(data)} color="text-blue-600" />;
  if (typeof data === "string") return <Leaf name={name} value={`"${data}"`} color="text-green-700" />;

  if (Array.isArray(data)) {
    if (data.length === 0) return <Leaf name={name} value="[]" color="text-slate-500" />;
    return (
      <CollapsibleNode
        name={name}
        bracket={["[", "]"]}
        count={data.length}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      >
        {data.map((item, i) => (
          <JsonNode key={i} data={item} name={String(i)} depth={depth + 1} defaultExpanded={defaultExpanded} />
        ))}
      </CollapsibleNode>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <Leaf name={name} value="{}" color="text-slate-500" />;
    return (
      <CollapsibleNode
        name={name}
        bracket={["{", "}"]}
        count={entries.length}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
      >
        {entries.map(([key, val]) => (
          <JsonNode key={key} data={val} name={key} depth={depth + 1} defaultExpanded={defaultExpanded} />
        ))}
      </CollapsibleNode>
    );
  }

  return <Leaf name={name} value={String(data)} color="text-slate-500" />;
}

function Leaf({ name, value, color }: { name?: string; value: string; color: string }) {
  return (
    <div className="leading-5">
      {name !== undefined && <span className="text-slate-500">{name}: </span>}
      <span className={color}>{value}</span>
    </div>
  );
}

function CollapsibleNode({
  name,
  bracket,
  count,
  expanded,
  onToggle,
  children,
}: {
  name?: string;
  bracket: [string, string];
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span
        className="cursor-pointer select-none hover:bg-slate-100 rounded px-0.5"
        onClick={onToggle}
      >
        <span className="text-slate-400 mr-1">{expanded ? "▾" : "▸"}</span>
        {name !== undefined && <span className="text-slate-500">{name}: </span>}
        <span className="text-slate-600">{bracket[0]}</span>
        {!expanded && (
          <span className="text-slate-400"> {count} items {bracket[1]}</span>
        )}
      </span>
      {expanded && (
        <>
          <div className="ml-4 border-l border-slate-200 pl-2">{children}</div>
          <span className="text-slate-600">{bracket[1]}</span>
        </>
      )}
    </div>
  );
}
