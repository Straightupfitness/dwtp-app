"use client";
import { useState } from "react";

/**
 * November 20 (Michael): a number box she can fully clear. Backspace removes every digit (no stuck "0" left at the
 * front on her iPhone), and tapping into it selects the number so she can just type the new one. An empty box counts
 * as 0 until she types.
 */
export default function NumberField({ value, onChange, ...rest }: { value: number; onChange: (n: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  // The number changed from outside (e.g. she changed the amount and everything scaled): show the new number.
  if (value !== seen) { setSeen(value); if (Number(text || 0) !== value) setText(String(value)); }
  return (
    <input {...rest} type="text" inputMode="decimal" value={text}
      onFocus={(e) => { const el = e.currentTarget; setTimeout(() => el.select(), 0); rest.onFocus?.(e); }}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".").replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
        setText(t);
        const n = t === "" || t === "." ? 0 : Number(t);
        setSeen(n); onChange(n);
      }} />
  );
}
