import { redirect } from "next/navigation";

/** The circles live in the Progress tab now (October 29). Old links land there. */
export default function CirclesPage() {
  redirect("/progress#circles");
}
