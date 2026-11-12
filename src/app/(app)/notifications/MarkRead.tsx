"use client";
import { useEffect, useRef } from "react";
import { markAllRead } from "./actions";

export default function MarkRead({ any }: { any: boolean }) {
  const done = useRef(false);
  useEffect(() => {
    if (!any || done.current) return;
    done.current = true;
    markAllRead();
  }, [any]);
  return null;
}
