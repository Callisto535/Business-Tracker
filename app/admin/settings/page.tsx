import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import SettingsPanel from "./settings-panel";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ADMIN_EMAIL = "admin@demo.com";
const RAY_EMAIL = "ray@gmail.com";
const ADMIN_KEYWORD = "rayy";

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const demoUser = cookieStore.get("business-tracker-demo-user")?.value;
  const supabase = await createServerSupabaseClient();
  const userResult = supabase ? await supabase.auth.getUser() : null;
  const signedInEmail = userResult?.data.user?.email?.toLowerCase() ?? "";
  const isSupabaseAdmin =
    signedInEmail === ADMIN_EMAIL ||
    signedInEmail === RAY_EMAIL ||
    signedInEmail.includes(ADMIN_KEYWORD);

  if (demoUser !== ADMIN_EMAIL && demoUser !== RAY_EMAIL && !isSupabaseAdmin) {
    redirect("/login");
  }

  return <SettingsPanel />;
}