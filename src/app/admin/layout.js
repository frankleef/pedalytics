import { getSessionUser } from "@/lib/auth";
import AdminShell from "./AdminShell";

export default async function AdminLayout({ children }) {
  const gebruiker = await getSessionUser();
  return <AdminShell gebruiker={gebruiker}>{children}</AdminShell>;
}
