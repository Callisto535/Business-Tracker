"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
};

type ProductRow = {
  id: string;
  name: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
};

type SaleRow = {
  id: string;
  quantity: number;
  total_amount: number;
  created_at: string;
  products: { name: string } | { name: string }[] | null;
  transaction_type?: "sale" | "adjustment";
};

type TodaySale = {
  id: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  createdAt: string;
  status: "Sold" | "Potential missing stock";
};

const emptyForm = {
  name: "",
  costPrice: "",
  sellingPrice: "",
  stock: "",
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [todaySales, setTodaySales] = useState<TodaySale[]>([]);
  const [draft, setDraft] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saleProductId, setSaleProductId] = useState("");
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [saleUnitPrice, setSaleUnitPrice] = useState("");
  const [message, setMessage] = useState("Loading data from Supabase...");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const mapRowToProduct = (row: ProductRow): Product => ({
    id: row.id,
    name: row.name,
    costPrice: Number(row.cost_price),
    sellingPrice: Number(row.selling_price),
    stock: Number(row.stock_quantity),
  });

  const mapRowToTodaySale = (row: SaleRow): TodaySale => {
    const productName = Array.isArray(row.products)
      ? row.products[0]?.name ?? "Unknown item"
      : row.products?.name ?? "Unknown item";

    const totalAmount = Number(row.total_amount);

    return {
      id: row.id,
      productName,
      quantity: Number(row.quantity),
      totalAmount,
      createdAt: row.created_at,
      status: row.transaction_type === "adjustment" ? "Potential missing stock" : "Sold",
    };
  };

  const loadDashboardData = useCallback(async () => {
    if (!supabase) {
      setMessage("Supabase is not configured. Check your .env.local values.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [productsResult, salesResult] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,cost_price,selling_price,stock_quantity")
        .order("created_at", { ascending: false }),
      supabase
        .from("sales")
        .select("id,quantity,total_amount,transaction_type,created_at,products(name)")
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false }),
    ]);

    if (productsResult.error) {
      setMessage(`Unable to load products: ${productsResult.error.message}`);
      setIsLoading(false);
      return;
    }

    if (salesResult.error) {
      setMessage(`Unable to load today's sales: ${salesResult.error.message}`);
      setIsLoading(false);
      return;
    }

    const nextProducts = ((productsResult.data ?? []) as ProductRow[]).map(mapRowToProduct);
    const nextSales = ((salesResult.data ?? []) as SaleRow[]).map(mapRowToTodaySale);

    setProducts(nextProducts);
    setTodaySales(nextSales);
    setIsLoading(false);
    setMessage("Ready to track inventory and today's sales.");
  }, [supabase]);

  useEffect(() => {
    const checkSession = async () => {
      if (!supabase) {
        const hasDemoSession = document.cookie
          .split("; ")
          .some((cookie) => cookie.startsWith("business-tracker-demo-user="));

        if (!hasDemoSession) {
          router.replace("/login");
        }

        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        router.replace("/login");
      }
    };

    void checkSession();
  }, [router, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadDashboardData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboardData]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (products.length === 0) {
        setSaleProductId("");
      } else if (!products.some((product) => product.id === saleProductId)) {
        setSaleProductId(products[0].id);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [products, saleProductId]);

  const selectedSaleProduct = products.find((product) => product.id === saleProductId);
  const maxSaleQuantity = selectedSaleProduct?.stock ?? 0;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (maxSaleQuantity <= 0 || saleQuantity < 1) {
        setSaleQuantity(1);
      } else if (saleQuantity > maxSaleQuantity) {
        setSaleQuantity(maxSaleQuantity);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [maxSaleQuantity, saleQuantity]);

  const totalInventoryValue = products.reduce(
    (sum, product) => sum + product.stock * product.costPrice,
    0
  );

  const totalRevenue = products.reduce(
    (sum, product) => sum + product.stock * product.sellingPrice,
    0
  );

  const totalSalesToday = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalUnitsSoldToday = todaySales.reduce((sum, sale) => sum + sale.quantity, 0);
  const potentialLossCount = todaySales.filter(
    (sale) => sale.status === "Potential missing stock"
  ).length;

  const handleSaveProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      setMessage("Supabase is not configured. Check your .env.local values.");
      return;
    }

    const nextProduct = {
      name: draft.name.trim(),
      costPrice: Number(draft.costPrice),
      sellingPrice: Number(draft.sellingPrice),
      stock: Number(draft.stock),
    };

    if (
      !nextProduct.name ||
      !Number.isFinite(nextProduct.costPrice) ||
      !Number.isFinite(nextProduct.sellingPrice) ||
      !Number.isInteger(nextProduct.stock) ||
      nextProduct.costPrice < 0 ||
      nextProduct.sellingPrice < 0 ||
      nextProduct.stock < 0
    ) {
      setMessage("Please complete all fields with valid values.");
      return;
    }

    setIsSaving(true);

    if (editingId) {
      const currentProduct = products.find((product) => product.id === editingId);

      const { error } = await supabase
        .from("products")
        .update({
          name: nextProduct.name,
          cost_price: nextProduct.costPrice,
          selling_price: nextProduct.sellingPrice,
          stock_quantity: nextProduct.stock,
        })
        .eq("id", editingId);

      if (error) {
        setMessage(`Unable to update product: ${error.message}`);
        setIsSaving(false);
        return;
      }

      if (currentProduct && nextProduct.stock < currentProduct.stock) {
        const decrease = currentProduct.stock - nextProduct.stock;
        const { error: missingError } = await supabase.from("sales").insert({
          product_id: editingId,
          quantity: decrease,
          total_amount: 0,
          unit_cost_price: currentProduct.costPrice,
          unit_selling_price: currentProduct.sellingPrice,
          transaction_type: "adjustment",
        });

        if (missingError) {
          setMessage(`Updated ${nextProduct.name}, but failed to log stock loss: ${missingError.message}`);
          setIsSaving(false);
          await loadDashboardData();
          return;
        }
      }

      setMessage(`Updated ${nextProduct.name}.`);
    } else {
      const { error } = await supabase.from("products").insert({
        name: nextProduct.name,
        cost_price: nextProduct.costPrice,
        selling_price: nextProduct.sellingPrice,
        stock_quantity: nextProduct.stock,
      });

      if (error) {
        setMessage(`Unable to add product: ${error.message}`);
        setIsSaving(false);
        return;
      }

      setMessage(`Added ${nextProduct.name} to inventory.`);
    }

    setDraft(emptyForm);
    setEditingId(null);
    await loadDashboardData();
    setIsSaving(false);
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setDraft({
      name: product.name,
      costPrice: String(product.costPrice),
      sellingPrice: String(product.sellingPrice),
      stock: String(product.stock),
    });
  };

  const handleDelete = async (productId: string) => {
    if (!supabase) {
      setMessage("Supabase is not configured. Check your .env.local values.");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase.from("products").delete().eq("id", productId);

    if (error) {
      setMessage(`Unable to delete product: ${error.message}`);
      setIsSaving(false);
      return;
    }

    setMessage("Product removed from inventory.");
    await loadDashboardData();
    setIsSaving(false);
  };

  const handleSale = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      setMessage("Supabase is not configured. Check your .env.local values.");
      return;
    }

    const selectedProduct = products.find((product) => product.id === saleProductId);
    const quantity = Number(saleQuantity);
    const unitSellingPrice = Number(saleUnitPrice || selectedProduct?.sellingPrice);

    if (!selectedProduct) {
      setMessage("Please pick a product before logging a sale.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setMessage("Quantity must be greater than zero.");
      return;
    }

    if (quantity > selectedProduct.stock) {
      setMessage(`Not enough stock for ${selectedProduct.name}.`);
      return;
    }

    if (!Number.isFinite(unitSellingPrice) || unitSellingPrice < 0) {
      setMessage("Sold price must be a valid non-negative amount.");
      return;
    }

    setIsSaving(true);

    const nextStock = selectedProduct.stock - quantity;

    const { data: updatedRows, error: stockError } = await supabase
      .from("products")
      .update({ stock_quantity: nextStock })
      .eq("id", selectedProduct.id)
      .gte("stock_quantity", quantity)
      .select("id");

    if (stockError) {
      setMessage(`Unable to update stock: ${stockError.message}`);
      setIsSaving(false);
      return;
    }

    if (!updatedRows || updatedRows.length === 0) {
      setMessage("Stock changed on the server. Refresh and try again.");
      setIsSaving(false);
      return;
    }

    const totalAmount = unitSellingPrice * quantity;
    const { error: saleError } = await supabase.from("sales").insert({
      product_id: selectedProduct.id,
      quantity,
      total_amount: totalAmount,
      unit_cost_price: selectedProduct.costPrice,
      unit_selling_price: unitSellingPrice,
      transaction_type: "sale",
    });

    if (saleError) {
      await supabase
        .from("products")
        .update({ stock_quantity: selectedProduct.stock })
        .eq("id", selectedProduct.id);

      setMessage(`Unable to record sale: ${saleError.message}`);
      setIsSaving(false);
      return;
    }

    setSaleQuantity(1);
    setSaleUnitPrice("");
    setMessage(`Recorded sale: ${quantity} ${selectedProduct.name} sold.`);
    await loadDashboardData();
    setIsSaving(false);
  };

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-black md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-3 border-b border-black pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-neutral-600">
              Shared view
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.08em] md:text-4xl">
              Inventory & sales
            </h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => router.push("/login")}>Log out</Button>
            <Button onClick={() => router.push("/admin/profit")}>Admin Profit</Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <Card className="border-2 border-black">
            <CardHeader className="pb-3">
              <CardDescription className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                Inventory value
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-[-0.08em]">${totalInventoryValue.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-black">
            <CardHeader className="pb-3">
              <CardDescription className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                Gross sales value
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-[-0.08em]">${totalRevenue.toLocaleString()}</p>
            </CardContent>
          </Card>

          <Card className="border-2 border-black">
            <CardHeader className="pb-3">
              <CardDescription className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                Current stock units
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-[-0.08em]">{products.reduce((sum, product) => sum + product.stock, 0)}</p>
            </CardContent>
          </Card>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="border-2 border-black">
            <CardHeader className="border-b border-black">
              <CardTitle className="text-2xl tracking-[-0.06em]">Inventory</CardTitle>
              <CardDescription>Products, cost profile, and live stock count.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                  <thead className="bg-neutral-100 text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                    <tr>
                      <th className="border-b border-black px-4 py-3">Product</th>
                      <th className="border-b border-black px-4 py-3">Cost</th>
                      <th className="border-b border-black px-4 py-3">Selling</th>
                      <th className="border-b border-black px-4 py-3">Stock</th>
                      <th className="border-b border-black px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id} className="border-b border-black last:border-b-0">
                        <td className="px-4 py-3 font-medium">{product.name}</td>
                        <td className="px-4 py-3">${product.costPrice}</td>
                        <td className="px-4 py-3">${product.sellingPrice}</td>
                        <td className="px-4 py-3">{product.stock}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button variant="secondary" size="sm" onClick={() => handleEdit(product)} disabled={isSaving}>
                              <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => void handleDelete(product.id)} disabled={isSaving}>
                              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-2 border-black">
              <CardHeader className="border-b border-black">
                <CardTitle className="text-2xl tracking-[-0.06em]">
                  {editingId ? "Edit product" : "Add product"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                <form onSubmit={handleSaveProduct} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Product name</label>
                    <Input
                      value={draft.name}
                      onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                      placeholder="New product"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Buying price</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.costPrice}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, costPrice: event.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Starting price</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.sellingPrice}
                        onChange={(event) =>
                          setDraft((current) => ({ ...current, sellingPrice: event.target.value }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Stock</label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={draft.stock}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, stock: event.target.value }))
                      }
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isSaving}>
                    <Plus className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : editingId ? "Save changes" : "Add to inventory"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="border-2 border-black">
              <CardHeader className="border-b border-black">
                <CardTitle className="text-2xl tracking-[-0.06em]">Quick sale</CardTitle>
                <CardDescription>Choose a quantity and set the exact price for this customer.</CardDescription>
              </CardHeader>
              <CardContent className="pt-5">
                <form onSubmit={handleSale} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Product</label>
                    <select
                      value={saleProductId}
                      onChange={(event) => {
                        const nextProductId = event.target.value;
                        const nextProduct = products.find((product) => product.id === nextProductId);
                        setSaleProductId(nextProductId);
                        setSaleQuantity(1);
                        setSaleUnitPrice(nextProduct ? String(nextProduct.sellingPrice) : "");
                      }}
                      className="flex h-11 w-full border border-black bg-white px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-black"
                      disabled={products.length === 0 || isSaving || isLoading}
                    >
                      {products.length === 0 ? (
                        <option value="">No products available</option>
                      ) : (
                        products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Quantity sold</label>
                    <Input
                      type="number"
                      min="1"
                      max={Math.max(1, maxSaleQuantity)}
                      value={saleQuantity}
                      onChange={(event) => setSaleQuantity(Number(event.target.value))}
                      disabled={products.length === 0 || isSaving || isLoading}
                    />
                    <p className="text-xs text-neutral-600">
                      Remaining stock: {maxSaleQuantity}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                      Sold price per item
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={saleUnitPrice || (selectedSaleProduct ? String(selectedSaleProduct.sellingPrice) : "")}
                      onChange={(event) => setSaleUnitPrice(event.target.value)}
                      disabled={products.length === 0 || isSaving || isLoading}
                    />
                    <p className="text-xs text-neutral-600">
                      Starting price: ${selectedSaleProduct?.sellingPrice.toFixed(2) ?? "0.00"}. You can change this for each customer.
                    </p>
                  </div>

                  <div className="border border-black bg-neutral-100 p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Sale total</p>
                    <p className="mt-1 text-2xl font-semibold tracking-[-0.06em]">
                      ${(saleQuantity * Number(saleUnitPrice || selectedSaleProduct?.sellingPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={products.length === 0 || isSaving || isLoading}>
                    <ArrowUpRight className="mr-2 h-4 w-4" /> {isSaving ? "Saving..." : "Log sale"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border-2 border-black">
          <CardHeader className="border-b border-black">
            <CardTitle className="text-2xl tracking-[-0.06em]">Today&apos;s sales tracking</CardTitle>
            <CardDescription>
              Every sold item is listed here with quantity, amount, and time.
              Zero-amount entries are flagged for potential missing stock.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-0">
            <div className="grid gap-3 border-b border-black p-4 md:grid-cols-3">
              <div className="border border-black p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Units sold today</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.06em]">{totalUnitsSoldToday}</p>
              </div>
              <div className="border border-black p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Revenue today</p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.06em]">${totalSalesToday.toLocaleString()}</p>
              </div>
              <div className="border border-black p-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-600">Potential missing items</p>
                <p className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-[-0.06em]">
                  <ShieldAlert className="h-5 w-5" /> {potentialLossCount}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead className="bg-neutral-100 text-[10px] uppercase tracking-[0.2em] text-neutral-600">
                  <tr>
                    <th className="border-b border-black px-4 py-3">Item</th>
                    <th className="border-b border-black px-4 py-3">Qty</th>
                    <th className="border-b border-black px-4 py-3">Amount</th>
                    <th className="border-b border-black px-4 py-3">Time</th>
                    <th className="border-b border-black px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todaySales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-neutral-600">
                        No sales logged today yet.
                      </td>
                    </tr>
                  ) : (
                    todaySales.map((sale) => (
                      <tr key={sale.id} className="border-b border-black last:border-b-0">
                        <td className="px-4 py-3 font-medium">{sale.productName}</td>
                        <td className="px-4 py-3">{sale.quantity}</td>
                        <td className="px-4 py-3">${sale.totalAmount.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          {new Date(sale.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex border border-black px-2 py-1 text-xs uppercase tracking-[0.12em]">
                            {sale.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="border border-black bg-neutral-100 px-4 py-3 text-sm text-black">
          {message}
        </div>
      </div>
    </main>
  );
}
