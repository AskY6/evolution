import type { PanelId } from "../types.js";

export interface NavProps {
  activePanel: PanelId;
  onNavigate: (panel: PanelId) => void;
  schemaVersion: string;
}

interface NavItem {
  id: PanelId;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: "demos", label: "Demo Library", icon: "📂" },
  { id: "playground", label: "Playground", icon: "🧪" },
  { id: "training", label: "Training Ground", icon: "🏋️" },
  { id: "boundary", label: "Boundary", icon: "📊" },
  { id: "versions", label: "Versions", icon: "📋" },
];

export function Nav({ activePanel, onNavigate, schemaVersion }: NavProps) {
  return (
    <nav className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-slate-200">
        <h1 className="text-sm font-bold text-slate-800">Evolution</h1>
        <p className="text-xs text-slate-500 mt-0.5">Workbench</p>
      </div>

      <div className="flex-1 py-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
              activePanel === item.id
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-slate-200">
        <div className="text-xs text-slate-400">Schema</div>
        <div className="text-xs font-mono text-slate-600 mt-0.5">
          v{schemaVersion}
        </div>
      </div>
    </nav>
  );
}
