import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({ children }) {
  const auth = await requireAuth();
  if (auth.error) {
    redirect("/login");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
