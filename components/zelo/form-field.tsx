import { CircleAlert } from "lucide-react";
import * as React from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (a11y: {
    id: string;
    "aria-invalid": boolean | undefined;
    "aria-describedby": string | undefined;
  }) => React.ReactNode;
};

export function FormField({
  id,
  label,
  hint,
  error,
  optional,
  className,
  children,
}: FormFieldProps) {
  const hintId = hint ? `${id}-dica` : undefined;
  const errorId = error ? `${id}-erro` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {optional && <span className="font-medium text-slate-600"> (opcional)</span>}
      </Label>
      {hint && (
        <p id={hintId} className="text-support text-slate-600">
          {hint}
        </p>
      )}
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-support text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
