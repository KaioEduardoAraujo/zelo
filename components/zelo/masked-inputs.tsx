"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { formatCentavos } from "@/lib/format";
import { maskCpf, maskPhone, onlyDigits, parseMoneyInput } from "@/lib/masks";

type BaseProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "defaultValue" | "onChange" | "type"
>;

// O valor limpo vai num input hidden; o servidor revalida.

export function CpfInput({
  name,
  defaultValue = "",
  onValueChange,
  ...props
}: BaseProps & { defaultValue?: string; onValueChange?: (digits: string) => void }) {
  const [value, setValue] = useState(maskCpf(defaultValue));
  return (
    <>
      <Input
        {...props}
        inputMode="numeric"
        autoComplete="off"
        placeholder="000.000.000-00"
        value={value}
        onChange={(e) => {
          const masked = maskCpf(e.target.value);
          setValue(masked);
          onValueChange?.(onlyDigits(masked));
        }}
      />
      <input type="hidden" name={name} value={onlyDigits(value)} />
    </>
  );
}

export function PhoneInput({
  name,
  defaultValue = "",
  onValueChange,
  ...props
}: BaseProps & { defaultValue?: string; onValueChange?: (digits: string) => void }) {
  const [value, setValue] = useState(maskPhone(defaultValue));
  return (
    <>
      <Input
        {...props}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="(11) 98765-4321"
        value={value}
        onChange={(e) => {
          const masked = maskPhone(e.target.value);
          setValue(masked);
          onValueChange?.(onlyDigits(masked));
        }}
      />
      <input type="hidden" name={name} value={onlyDigits(value)} />
    </>
  );
}

export function MoneyInput({
  name,
  defaultCentavos = 0,
  onValueChange,
  ...props
}: BaseProps & { defaultCentavos?: number; onValueChange?: (centavos: number) => void }) {
  const [centavos, setCentavos] = useState(defaultCentavos);
  return (
    <>
      <Input
        {...props}
        inputMode="numeric"
        autoComplete="off"
        className="tabular text-right"
        value={formatCentavos(centavos)}
        onChange={(e) => {
          const next = parseMoneyInput(e.target.value);
          setCentavos(next);
          onValueChange?.(next);
        }}
      />
      <input type="hidden" name={name} value={centavos} />
    </>
  );
}
