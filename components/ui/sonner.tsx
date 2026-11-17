"use client";

import { CircleAlert, CircleCheck, Info, LoaderCircle } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Toaster as Sonner } from "sonner";

const query = "(min-width: 768px)";
const subscribe = (cb: () => void) => {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
};

function Toaster() {
  const isDesktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );

  return (
    <Sonner
      theme="light"
      position={isDesktop ? "top-right" : "bottom-center"}
      duration={5000}
      closeButton
      offset={isDesktop ? 24 : 16}
      mobileOffset={{ bottom: 88 }}
      icons={{
        success: <CircleCheck className="size-5 text-success" />,
        error: <CircleAlert className="size-5 text-danger" />,
        info: <Info className="size-5 text-info" />,
        loading: <LoaderCircle className="size-5 animate-spin text-slate-600" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-[var(--radius-card)] !border !border-line !bg-surface !text-navy-900 !shadow-[var(--shadow-overlay)] !font-sans",
          title: "!text-support !font-semibold",
          description: "!text-support !text-slate-600",
          closeButton: "!border-line !bg-surface",
        },
      }}
    />
  );
}

export { Toaster };
