import type { ReactNode } from "react";

export interface CardProps {
  children: ReactNode;
  title?: string;
  accent?: "blue" | "green" | "orange" | "red" | "neutral";
  className?: string;
}

const accentColors: Record<string, string> = {
  blue: "border-l-blue-500",
  green: "border-l-green-500",
  orange: "border-l-orange-500",
  red: "border-l-red-500",
  neutral: "border-l-slate-400",
};

export function Card({ children, title, accent, className = "" }: CardProps) {
  const accentClass = accent ? `border-l-4 ${accentColors[accent]}` : "";

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-slate-200 ${accentClass} ${className}`}
    >
      {title && (
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
