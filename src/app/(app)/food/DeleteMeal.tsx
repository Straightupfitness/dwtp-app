"use client";
import { useState, useTransition } from "react";
import { deleteMeal } from "./actions";

export default function DeleteMeal({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState(false);
  return (
    <button type="button" aria-label="Delete meal" disabled={pending} onClick={() => (ask ? start(() => deleteMeal(id)) : setAsk(true))}
      className="min-h-9 px-1 text-xs text-dim disabled:opacity-40">{ask ? "Tap to delete" : "Delete"}</button>
  );
}
