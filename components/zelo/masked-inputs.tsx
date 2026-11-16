"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { formatCentavos } from "@/lib/format";
import { maskCpf, maskPhone, onlyDigits, parseMoneyInput } from "@/lib/masks";

type BaseProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "defaultValue" | "onChange" | "type"
>;

/*
 * Inputs com máscara (DESIGN.md 6). O que a pessoa vê é formatado; o que vai no formulário
 * (input hidden com o `name`) é o valor limpo: só dígitos ou centavos. O servidor revalida.
 */

export function CpfInput({
  name,
  defaultValue = "",
  ...props
}: BaseProps & { defaultValue?: string }) {
  const [value, setValue] = useState(maskCpf(defaultValue));
  return (
    <>
      <Input
        {...props}
        inputMode="numeric"
        autoComplete="off"
        placeholder="000.000.000-00"
        value={value}
        onChange={(e) => setValue(maskCpf(e.target.value))}
      />
      <input type="hidden" name={name} value={onlyDigits(value)} />
    </>
  );
}

export function PhoneInput({
  name,
  defaultValue = "",
  ...props
}: BaseProps & { defaultValue?: string }) {
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
        onChange={(e) => setValue(maskPhone(e.target.value))}
      />
      <input type="hidden" name={name} value={onlyDigits(value)} />
    </>
  );
}

/** Valor em reais digitado "pela direita" (1 → R$ 0,01). Envia centavos inteiros. */
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
