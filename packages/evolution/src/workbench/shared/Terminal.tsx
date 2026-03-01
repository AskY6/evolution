import { useEffect, useRef } from "react";
import type { LogLine } from "../types.js";

export interface TerminalProps {
  lines: LogLine[];
  maxHeight?: string;
  className?: string;
}

const levelColors: Record<LogLine["level"], string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
  debug: "text-slate-500",
};

export function Terminal({ lines, maxHeight = "300px", className = "" }: TerminalProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  return (
    <div
      className={`bg-slate-900 rounded-lg text-xs font-mono overflow-auto ${className}`}
      style={{ maxHeight }}
    >
      <div className="p-3 space-y-0.5">
        {lines.length === 0 && (
          <div className="text-slate-600">Waiting for pipeline events...</div>
        )}
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2 leading-5">
            <span className="text-slate-600 shrink-0">
              {new Date(line.timestamp).toLocaleTimeString()}
            </span>
            <span className={`shrink-0 uppercase w-12 ${levelColors[line.level]}`}>
              {line.level}
            </span>
            {line.stage && (
              <span className="text-cyan-400 shrink-0">[{line.stage}]</span>
            )}
            <span className="text-slate-300">{line.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
