"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, BriefcaseBusiness, Clock3, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Investor = { id: string; partner_name: string; amount_invested: number; created_at?: string };
type SaleRow = { id: string; quantity: number; total_amount: number; unit_cost_price: number | null; transaction_type: "sale" | "adjustment"; created_at: string; products: { name: string; cost_price: number } | { name: string; cost_price: number }[] | null };
type ProductRow = { id: string; name: string; selling_price: number; created_at: string };
type HistoryItem = { id: string; category: "Inventory" | "Money" | "Investors"; title: string; detail: string; createdAt: string };
type FormState = { name: string; amount: string };

const emptyForm: FormState = { name: "", amount: "" };
const demoInvestors: Investor[] = [
  { id: "demo-1", partner_name: "Partner 1", amount_invested: 180000 },
  { id: "demo-2", partner_name: "Partner 2", amount_invested: 120000 },
];

const money = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ProfitCalculator() {
  const supabase = useMemo(() => createClient(), []);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [cogs, setCogs] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("Loading investor data...");
  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"All" | HistoryItem["category"]>("All");

  const loadData = useCallback(async () => {
    if (!supabase) {
      const stored = window.localStorage.getItem("business-tracker-investors");
      setInvestors(stored ? JSON.parse(stored) : demoInvestors);
      setRevenue(324500);
      setCogs(201300);
      setHistory([]);
      setMessage("Local demo data loaded.");
      return;
    }

    const [investmentResult, salesResult, productResult] = await Promise.all([
      supabase.from("investments").select("id,partner_name,amount_invested").order("partner_name"),
      supabase.from("sales").select("id,quantity,total_amount,unit_cost_price,transaction_type,created_at,products(name,cost_price)"),
      supabase.from("products").select("id,name,selling_price,cost_price,created_at").order("created_at", { ascending: false }),
    ]);

    if (investmentResult.error) {
      setMessage(`Unable to load investors: ${investmentResult.error.message}. Check the investments table and RLS policies in Supabase.`);
      return;
    }
    if (salesResult.error) {
      setMessage(`Unable to load sales: ${salesResult.error.message}`);
      return;
    }
    if (productResult.error) {
      setMessage(`Unable to load inventory history: ${productResult.error.message}`);
      return;
    }

    const sales = (salesResult.data ?? []) as SaleRow[];
    const nextInvestors = (investmentResult.data ?? []) as Investor[];
    const products = (productResult.data ?? []) as ProductRow[];
    setInvestors(nextInvestors);
    const saleTransactions = sales.filter((sale) => sale.transaction_type !== "adjustment");
    setRevenue(saleTransactions.reduce((sum, sale) => sum + Number(sale.total_amount), 0));
    setCogs(saleTransactions.reduce((sum, sale) => {
      const product = Array.isArray(sale.products) ? sale.products[0] : sale.products;
      const unitCost = sale.unit_cost_price ?? product?.cost_price ?? 0;
      return sum + Number(sale.quantity) * Number(unitCost);
    }, 0));
    setHistory([
      ...products.map((product) => ({ id: `product-${product.id}`, category: "Inventory" as const, title: `Added ${product.name}`, detail: `Selling price ${money(Number(product.selling_price))}`, createdAt: product.created_at })),
      ...sales.map((sale) => { const product = Array.isArray(sale.products) ? sale.products[0] : sale.products; const isAdjustment = sale.transaction_type === "adjustment"; return { id: `sale-${sale.id}`, category: isAdjustment ? "Inventory" as const : "Money" as const, title: isAdjustment ? `Removed stock: ${product?.name ?? "Unknown item"}` : `Sale: ${product?.name ?? "Unknown item"}`, detail: isAdjustment ? `${sale.quantity} unit${sale.quantity === 1 ? "" : "s"} removed` : `${sale.quantity} unit${sale.quantity === 1 ? "" : "s"} · ${money(Number(sale.total_amount))}`, createdAt: sale.created_at }; }),
      ...nextInvestors.map((investor) => ({ id: `investor-${investor.id}`, category: "Investors" as const, title: `Added ${investor.partner_name}`, detail: `Investment ${money(Number(investor.amount_invested))}`, createdAt: investor.created_at ?? new Date().toISOString() })),
    ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()));
    setMessage("Live sales and investor data loaded.");
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const totalInvested = investors.reduce((sum, investor) => sum + Number(investor.amount_invested), 0);
  const netProfit = revenue - cogs;
  const visibleHistory = historyFilter === "All" ? history : history.filter((item) => item.category === historyFilter);

  const saveInvestor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = form.name.trim();
    const amount = Number(form.amount);
    if (!name || !Number.isFinite(amount) || amount < 0) {
      setMessage("Enter an investor name and a valid non-negative amount.");
      return;
    }

    setIsSaving(true);
    if (!supabase) {
      const next = editingId
        ? investors.map((investor) => investor.id === editingId ? { ...investor, partner_name: name, amount_invested: amount } : investor)
        : [...investors, { id: crypto.randomUUID(), partner_name: name, amount_invested: amount }];
      setInvestors(next);
      window.localStorage.setItem("business-tracker-investors", JSON.stringify(next));
      setMessage(editingId ? "Investor updated." : "Investor added.");
    } else {
      const result = editingId
        ? await supabase.from("investments").update({ partner_name: name, amount_invested: amount }).eq("id", editingId)
        : await supabase.from("investments").insert({ partner_name: name, amount_invested: amount });
      if (result.error) {
        setMessage(`Unable to save investor: ${result.error.message}`);
        setIsSaving(false);
        return;
      }
      setMessage(editingId ? "Investor updated." : "Investor added.");
      await loadData();
    }
    setForm(emptyForm);
    setEditingId(null);
    setIsSaving(false);
  };

  const deleteInvestor = async (id: string) => {
    setIsSaving(true);
    if (!supabase) {
      const next = investors.filter((investor) => investor.id !== id);
      setInvestors(next);
      window.localStorage.setItem("business-tracker-investors", JSON.stringify(next));
    } else {
      const { error } = await supabase.from("investments").delete().eq("id", id);
      if (error) {
        setMessage(`Unable to delete investor: ${error.message}`);
        setIsSaving(false);
        return;
      }
      await loadData();
    }
    setMessage("Investor deleted.");
    setIsSaving(false);
  };

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-black md:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-col gap-3 border-b border-black pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-neutral-600">Admin only</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.08em] md:text-4xl">Profit calculator</h1>
          </div>
          <div className="flex flex-wrap gap-2"><Button variant="secondary" asChild><Link href="/dashboard">Back to dashboard</Link></Button><Button variant="secondary" asChild><Link href="/admin/settings">Settings</Link></Button></div>
        </header>
        <p className="border border-black bg-neutral-100 px-3 py-2 text-sm">{message}</p>
        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-2 border-black"><CardHeader className="pb-3"><CardDescription className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Total sales revenue</CardDescription></CardHeader><CardContent><p className="text-3xl font-semibold tracking-[-0.08em]">{money(revenue)}</p></CardContent></Card>
          <Card className="border-2 border-black"><CardHeader className="pb-3"><CardDescription className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Cost of goods sold</CardDescription></CardHeader><CardContent><p className="text-3xl font-semibold tracking-[-0.08em]">{money(cogs)}</p></CardContent></Card>
          <Card className="border-2 border-black"><CardHeader className="pb-3"><CardDescription className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Net profit</CardDescription></CardHeader><CardContent><p className="text-3xl font-semibold tracking-[-0.08em]">{money(netProfit)}</p></CardContent></Card>
        </section>
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-2 border-black"><CardHeader className="border-b border-black"><CardTitle className="text-2xl tracking-[-0.06em]">Investors</CardTitle><CardDescription>Add contributions and manage each investor&apos;s share.</CardDescription></CardHeader><CardContent className="space-y-5 pt-5">
            <form onSubmit={saveInvestor} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><Input aria-label="Investor name" placeholder="Investor name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /><Input aria-label="Investment amount" type="number" min="0" step="0.01" placeholder="Amount" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /><Button type="submit" disabled={isSaving}>{editingId ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{editingId ? "Update" : "Add"}</Button></form>
            <div className="space-y-3">{investors.length === 0 ? <p className="text-sm text-neutral-600">No investors added yet.</p> : investors.map((investor) => { const ratio = totalInvested ? Number(investor.amount_invested) / totalInvested : 0; return <div key={investor.id} className="border border-black p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{investor.partner_name}</p><p className="text-sm text-neutral-600">{money(Number(investor.amount_invested))} · {(ratio * 100).toFixed(1)}%</p></div><div className="flex gap-2"><Button type="button" variant="secondary" size="icon" aria-label={`Edit ${investor.partner_name}`} onClick={() => { setEditingId(investor.id); setForm({ name: investor.partner_name, amount: String(investor.amount_invested) }); }}><Pencil className="h-4 w-4" /></Button><Button type="button" variant="secondary" size="icon" aria-label={`Delete ${investor.partner_name}`} onClick={() => void deleteInvestor(investor.id)}><Trash2 className="h-4 w-4" /></Button></div></div><div className="mt-3 h-2 border border-black bg-neutral-100"><div className="h-full bg-black" style={{ width: `${ratio * 100}%` }} /></div></div>; })}</div>
            <div className="border border-black bg-neutral-100 p-4 text-sm"><span className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Total invested</span><p className="mt-1 text-2xl font-semibold">{money(totalInvested)}</p></div>
          </CardContent></Card>
          <Card className="border-2 border-black"><CardHeader className="border-b border-black"><CardTitle className="text-2xl tracking-[-0.06em]">Payouts</CardTitle><CardDescription>Net profit follows each investor&apos;s contribution ratio.</CardDescription></CardHeader><CardContent className="space-y-3 pt-5">{investors.map((investor) => { const ratio = totalInvested ? Number(investor.amount_invested) / totalInvested : 0; return <div key={investor.id} className="flex items-center justify-between border border-black p-4"><div className="flex items-center gap-3"><BriefcaseBusiness className="h-5 w-5" /><div><p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">{investor.partner_name}</p><p className="text-xl font-semibold">{money(netProfit * ratio)}</p></div></div><ArrowRight className="h-4 w-4" /></div>; })}<div className="border border-black bg-black p-4 text-white"><p className="text-[10px] uppercase tracking-[0.2em] text-neutral-300">Formula</p><p className="mt-2 text-lg font-medium">Net profit = revenue - COGS</p><p className="mt-1 text-lg font-medium">Payout = net profit x contribution ratio</p></div><div className="flex items-center gap-2 text-sm text-neutral-600"><TrendingUp className="h-4 w-4" />Live calculations update after every change.</div></CardContent></Card>
        </section>
        <Card className="border-2 border-black"><CardHeader className="border-b border-black"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><CardTitle className="text-2xl tracking-[-0.06em]">History</CardTitle><CardDescription>Recent inventory, money, and investor activity.</CardDescription></div><Clock3 className="h-5 w-5" /></div></CardHeader><CardContent className="p-0"><div className="flex flex-wrap gap-2 border-b border-black p-4">{(["All", "Inventory", "Money", "Investors"] as const).map((filter) => <Button key={filter} type="button" size="sm" variant={historyFilter === filter ? "default" : "secondary"} onClick={() => setHistoryFilter(filter)}>{filter}</Button>)}</div>{visibleHistory.length === 0 ? <p className="p-5 text-sm text-neutral-600">No history yet. Add an item, record a sale, or add an investor.</p> : <div className="divide-y divide-black">{visibleHistory.map((item) => <div key={item.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{item.title}</p><p className="text-sm text-neutral-600">{item.detail}</p></div><div className="text-left text-xs uppercase tracking-[0.14em] text-neutral-500 sm:text-right"><p>{item.category}</p><p>{new Date(item.createdAt).toLocaleString()}</p></div></div>)}</div>}</CardContent></Card>
      </div>
    </main>
  );
}
