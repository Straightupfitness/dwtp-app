import { redirect } from "next/navigation";

/** November 23 (Michael): the Progress tab folded into Today ("Your progress", near the bottom). Old links land there. */
export default function ProgressPage() {
  redirect("/today#progress");
}
