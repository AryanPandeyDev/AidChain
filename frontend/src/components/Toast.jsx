import { useState, useCallback, createContext, useContext } from "react";

const ToastContext = createContext(null);

const ICONS = {
  success: "check_circle",
  error: "error",
  info: "info",
  warning: "warning",
};

const COLORS = {
  success: "bg-primary text-on-primary",
  error: "bg-error text-on-error",
  info: "bg-secondary text-on-secondary",
  warning: "bg-secondary-fixed text-on-secondary-fixed",
};

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info", duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    {
      success: (msg, dur) => addToast(msg, "success", dur),
      error: (msg, dur) => addToast(msg, "error", dur ?? 6000),
      info: (msg, dur) => addToast(msg, "info", dur),
      warning: (msg, dur) => addToast(msg, "warning", dur),
    },
    [addToast]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`${COLORS[t.type]} px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 pointer-events-auto animate-slide-up min-w-[280px] max-w-[420px]`}
            role="alert"
          >
            <span
              className="material-symbols-outlined text-xl flex-shrink-0"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {ICONS[t.type]}
            </span>
            <span className="text-sm font-medium flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Hook to access the toast API.
 * Usage: const toast = useToast(); toast.success("Done!"); toast.error("Failed");
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Fallback if used outside provider — won't crash, just logs
    return {
      success: (msg) => console.log("[toast:success]", msg),
      error: (msg) => console.error("[toast:error]", msg),
      info: (msg) => console.log("[toast:info]", msg),
      warning: (msg) => console.warn("[toast:warning]", msg),
    };
  }
  return ctx;
}
