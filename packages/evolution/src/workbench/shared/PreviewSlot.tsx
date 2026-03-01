import type { PreviewConfig } from "../types.js";
import { JsonView } from "./JsonView.js";

export interface PreviewSlotProps {
  config?: PreviewConfig;
  data?: unknown;
  label?: string;
  className?: string;
}

export function PreviewSlot({ config, data, label, className = "" }: PreviewSlotProps) {
  return (
    <div className={`border border-slate-200 rounded-lg overflow-hidden ${className}`}>
      {label && (
        <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500">
          {label}
        </div>
      )}
      <div className="p-3">{renderContent(config, data)}</div>
    </div>
  );
}

function renderContent(config?: PreviewConfig, data?: unknown): React.ReactNode {
  if (!config) {
    // Fallback: render data as JSON
    if (data !== undefined) {
      return <JsonView data={data} defaultExpanded={true} />;
    }
    return <div className="text-xs text-slate-400">No preview available</div>;
  }

  switch (config.type) {
    case "json":
      return (
        <JsonView
          data={typeof config.content === "string" ? JSON.parse(config.content) : config.content}
          defaultExpanded={true}
        />
      );

    case "html":
      return (
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{
            __html: typeof config.content === "string" ? config.content : "",
          }}
        />
      );

    case "iframe":
      return (
        <iframe
          srcDoc={typeof config.content === "string" ? config.content : ""}
          className="w-full h-64 border-0"
          sandbox="allow-scripts"
          title="Preview"
        />
      );

    case "image":
      return (
        <img
          src={typeof config.content === "string" ? config.content : ""}
          alt="Preview"
          className="max-w-full h-auto"
        />
      );

    case "custom": {
      const Component = config.component;
      if (Component) {
        return <Component data={config.content} />;
      }
      return <JsonView data={config.content} defaultExpanded={true} />;
    }

    default:
      return <JsonView data={config.content} defaultExpanded={true} />;
  }
}
