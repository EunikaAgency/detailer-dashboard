import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({ children }) {
  const auth = await requireAdmin();
  if (auth.error) {
    redirect(auth.status === 401 ? "/login" : "/");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
