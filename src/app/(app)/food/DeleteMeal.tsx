"use client";
import { useTransition } from "react";
import { deleteMeal } from "./actions";

export default function DeleteMeal({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button aria-label="Delete meal" disabled={pending} onClick={() => start(() => deleteMeal(id))}
      className="self-start px-2 text-dim disabled:opacity-40">✕</button>
  );
}
