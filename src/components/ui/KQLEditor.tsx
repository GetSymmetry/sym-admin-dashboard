"use client";

interface KQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  placeholder?: string;
}

export function KQLEditor({ value, onChange, onExecute, placeholder }: KQLEditorProps) {
  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onExecute?.(); }}
        placeholder={placeholder || "Enter KQL query..."}
        className="w-full h-32 px-3 py-2 bg-surface-secondary border border-border rounded-sds-100 font-mono text-code text-text-primary resize-y focus:outline-none focus:ring-2 focus:ring-brand-blue"
        spellCheck={false}
      />
      <div className="absolute bottom-2 right-2 text-body-small text-text-muted">
        {typeof navigator !== "undefined" && navigator?.platform?.includes("Mac") ? "Cmd" : "Ctrl"}+Enter to run
      </div>
    </div>
  );
}
