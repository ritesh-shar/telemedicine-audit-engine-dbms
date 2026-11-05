import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();

  if (!user) redirect("/login");
  if (user.role !== "ADMIN") {
    redirect(user.role === "PATIENT" ? "/patient" : "/doctor");
  }

  return children;
}
