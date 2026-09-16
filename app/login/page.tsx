"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const DEMO_EMAIL = "admin@demo.com";
const DEMO_PASSWORD = "demo123";
const RAY_EMAIL = "ray@gmail.com";
const RAY_PASSWORD = "ray123";
const ADMIN_EMAIL = "admin@demo.com";
const ADMIN_KEYWORD = "rayy";

function setSignedInCookie(email: string) {
  document.cookie = `business-tracker-demo-user=${encodeURIComponent(email)}; path=/; max-age=86400`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isAdminUser = (value: string) => {
    const normalized = value.trim().toLowerCase();
    return normalized === ADMIN_EMAIL || normalized.includes(ADMIN_KEYWORD);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const hasSupabaseConfig =
      !!supabaseUrl &&
      !!supabaseAnonKey &&
      !supabaseUrl.includes("your-project-id");

    if (!hasSupabaseConfig) {
      const normalizedEmail = email.trim().toLowerCase();
      const isValidDemoLogin =
        (normalizedEmail === DEMO_EMAIL && password === DEMO_PASSWORD) ||
        (normalizedEmail === RAY_EMAIL && password === RAY_PASSWORD);

      if (isValidDemoLogin) {
        setSignedInCookie(normalizedEmail);
        router.push(isAdminUser(normalizedEmail) ? "/admin/profit" : "/dashboard");
        setIsSubmitting(false);
        return;
      }

      setError("Use admin@demo.com / demo123 or ray@gmail.com / ray123 in local mode.");
      setIsSubmitting(false);
      return;
    }

    try {
      const supabase = createClient();

      if (!supabase) {
        setError("Supabase is not configured. Please check your .env.local values.");
        setIsSubmitting(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setIsSubmitting(false);
        return;
      }

      setSignedInCookie(email);
      router.push(isAdminUser(email) ? "/admin/profit" : "/dashboard");
    } catch {
      setError("Unable to contact Supabase. Check your environment variables.");
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-10 text-black">
      <div className="w-full max-w-md">
        <Card className="border-2 border-black bg-white">
          <CardHeader className="space-y-4 border-b border-black pb-5">
            <div className="flex h-12 w-12 items-center justify-center border border-black bg-black text-white">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-neutral-600">
                Partner access
              </p>
              <CardTitle className="mt-2 text-3xl font-semibold tracking-[-0.06em]">
                Business Tracker
              </CardTitle>
            </div>
            <CardDescription className="text-sm text-neutral-600">
              Secure access for daily inventory and sales tracking.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-700">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-xs font-medium uppercase tracking-[0.2em] text-neutral-700">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              {error ? (
                <p className="border border-black bg-neutral-100 px-3 py-2 text-sm text-black">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-between gap-3 pt-2 text-xs uppercase tracking-[0.18em] text-neutral-600">
                <span>Local demo only</span>
                <span>admin@demo.com / demo123</span>
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Sign in"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
