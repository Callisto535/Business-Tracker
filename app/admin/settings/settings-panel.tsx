"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, RotateCcw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const RESET_PHRASE = "RESET";

export default function SettingsPanel() {
  const supabase = useMemo(() => createClient(), []);
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const resetData = async () => {
    if (!window.confirm("This will permanently delete every product, sale, and investor. Continue?")) {
      return;
    }

    setIsResetting(true);
    if (!supabase) {
      window.localStorage.removeItem("business-tracker-investors");
      setMessage("Local demo data reset.");
      setConfirmation("");
      setIsResetting(false);
      return;
    }

    const salesResult = await supabase.from("sales").delete().not("id", "is", null);
    if (salesResult.error) {
      setMessage(`Unable to delete sales: ${salesResult.error.message}`);
      setIsResetting(false);
      return;
    }

    const productResult = await supabase.from("products").delete().not("id", "is", null);
    if (productResult.error) {
      setMessage(`Unable to delete products: ${productResult.error.message}`);
      setIsResetting(false);
      return;
    }

    const investmentResult = await supabase.from("investments").delete().not("id", "is", null);
    if (investmentResult.error) {
      setMessage(`Unable to delete investors: ${investmentResult.error.message}`);
      setIsResetting(false);
      return;
    }

    setMessage("All products, sales, and investors were permanently deleted.");
    setConfirmation("");
    setIsResetting(false);
  };

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-black md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-3 border-b border-black pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-neutral-600">Admin only</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.08em] md:text-4xl">Settings</h1>
          </div>
          <Button variant="secondary" asChild>
            <Link href="/admin/profit"><ArrowLeft className="mr-2 h-4 w-4" />Back to admin</Link>
          </Button>
        </header>

        {message ? <p className="border border-black bg-neutral-100 px-3 py-2 text-sm" role="status">{message}</p> : null}

        <Card className="border-2 border-red-700">
          <CardHeader className="border-b border-red-700 bg-red-50">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-1 h-5 w-5 shrink-0 text-red-700" />
              <div>
                <CardTitle className="text-2xl tracking-[-0.06em] text-red-800">Danger zone</CardTitle>
                <CardDescription className="mt-1 text-red-900">Permanent actions cannot be undone.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div>
              <h2 className="font-semibold">Delete all business data</h2>
              <p className="mt-1 text-sm text-neutral-600">Removes every product, sale, and investor from the current workspace.</p>
            </div>
            <div className="max-w-md space-y-2">
              <label htmlFor="reset-confirmation" className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Type RESET to unlock</label>
              <Input id="reset-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="RESET" autoComplete="off" />
            </div>
            <Button type="button" variant="outline" className="border-red-700 text-red-700 hover:bg-red-50" onClick={() => void resetData()} disabled={isResetting || confirmation !== RESET_PHRASE}>
              <RotateCcw className="mr-2 h-4 w-4" />{isResetting ? "Deleting..." : "Delete all data"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}