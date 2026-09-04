import { redirect } from "next/navigation";

export default function LearnIndexRedirect() {
  redirect("/?view=training");
}
