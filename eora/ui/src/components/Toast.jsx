import { createPortal } from "react-dom";

const TYPE_STYLES = {
  error:   { bg: "bg-rose-50 border-rose-200",   text: "text-rose-900",   icon: "bg-rose-500",   label: "✕" },
  warning: { bg: "bg-amber-50 border-amber-200",  text: "text-amber-900",  icon: "bg-amber-500",  label: "!" },
  success: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-900", icon: "bg-emerald-500", label: "✓" },
  info:    { bg: "bg-blue-50 border-blue-200",    text: "text-blue-900",   icon: "bg-blue-500",   label: "i" },
};

function ToastItem({ id, type, message, exiting, onDismiss }) {
  const s = TYPE_STYLES[type] || TYPE_STYLES.info;
  return (
    <div
      className={`toast-item ${s.bg} ${s.text} border ${exiting ? "toast-exit" : "toast-enter"}`}
      role="alert"
      aria-live="assertive"
    >
      <span className={`toast-icon ${s.icon}`}>{s.label}</span>
      <p className="text-sm leading-snug flex-1">{message}</p>
      <button
        onClick={() => onDismiss(id)}
        className="opacity-40 hover:opacity-70 text-lg leading-none flex-shrink-0 ml-1"
        aria-label="Закрыть"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return createPortal(
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} onDismiss={onDismiss} />
      ))}
    </div>,
    document.body
  );
}
