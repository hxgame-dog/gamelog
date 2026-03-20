import { redirect } from "next/navigation";

import { LoginClient } from "@/components/login-client";
import { getCurrentUser } from "@/lib/server/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  return <LoginClient />;
}
