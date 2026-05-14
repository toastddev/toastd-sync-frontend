import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-zinc-900 border border-zinc-800 rounded-lg ${className}`}>{children}</div>;
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  size = "md",
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md";
  type?: "button" | "submit";
  className?: string;
}) {
  const sz = size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm";
  const v =
    variant === "primary"
      ? "bg-emerald-600 hover:bg-emerald-500 text-white disabled:bg-zinc-700 disabled:text-zinc-400"
      : variant === "danger"
        ? "bg-red-600 hover:bg-red-500 text-white disabled:bg-zinc-700"
        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-100 disabled:bg-zinc-900 disabled:text-zinc-500";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${sz} ${v} rounded-md font-medium transition-colors ${className}`}>
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <span className="relative">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="block w-9 h-5 bg-zinc-700 rounded-full peer-checked:bg-emerald-600 transition-colors" />
        <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-4 transition-transform" />
      </span>
      {label && <span className="text-sm text-zinc-300">{label}</span>}
    </label>
  );
}

export function Pill({ children, color = "zinc" }: { children: ReactNode; color?: "zinc" | "green" | "yellow" | "red" | "blue" }) {
  const colors: Record<string, string> = {
    zinc: "bg-zinc-800 text-zinc-300",
    green: "bg-emerald-900/50 text-emerald-300 border border-emerald-800",
    yellow: "bg-yellow-900/40 text-yellow-300 border border-yellow-800",
    red: "bg-red-900/50 text-red-300 border border-red-800",
    blue: "bg-blue-900/40 text-blue-300 border border-blue-800",
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[color]}`}>{children}</span>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-sm focus:outline-none focus:border-emerald-600 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-md text-sm focus:outline-none focus:border-emerald-600 ${props.className ?? ""}`}
    />
  );
}

export function Loading({ children = "Loading..." }: { children?: ReactNode }) {
  return <div className="text-sm text-zinc-500">{children}</div>;
}
