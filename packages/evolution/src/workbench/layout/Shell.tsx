import type { ReactNode } from "react";

export interface ShellProps {
  sidebar: ReactNode;
  children: ReactNode;
}

export function Shell({ sidebar, children }: ShellProps) {
  return (
    <div className="flex h-screen">
      <aside className="w-[220px] shrink-0 border-r border-slate-200 bg-white">
        {sidebar}
      </aside>
      <main className="flex-1 overflow-auto bg-slate-50">
        <div className="max-w-[880px] mx-auto p-6">{children}</div>
      </main>
    </div>
  );
}
