export type TagVariant = "success" | "warning" | "error" | "neutral" | "info";

export interface TagProps {
  label: string;
  variant?: TagVariant;
  className?: string;
}

const variantClasses: Record<TagVariant, string> = {
  success: "bg-green-100 text-green-800",
  warning: "bg-orange-100 text-orange-800",
  error: "bg-red-100 text-red-800",
  neutral: "bg-slate-100 text-slate-600",
  info: "bg-blue-100 text-blue-800",
};

export function Tag({ label, variant = "neutral", className = "" }: TagProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {label}
    </span>
  );
}
