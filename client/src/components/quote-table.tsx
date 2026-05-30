import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import type { QuoteItem } from "@shared/schema";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUpdateQuoteItem } from "@/hooks/use-quotes";
import { formatCurrency, num } from "@/lib/utils";

interface EditState {
  partNumber: string;
  description: string;
  eligibilityPercent: string;
  quantity: string;
  listPrice: string;
  discountedPrice: string;
}

function toEditState(item: QuoteItem): EditState {
  return {
    partNumber: item.partNumber ?? "",
    description: item.description ?? "",
    eligibilityPercent: String(item.eligibilityPercent ?? 100),
    quantity: String(item.quantity ?? 1),
    listPrice: item.listPrice != null ? String(item.listPrice) : "",
    discountedPrice: item.discountedPrice != null ? String(item.discountedPrice) : "",
  };
}

export function QuoteTable({ quoteId, items }: { quoteId: number; items: QuoteItem[] }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<EditState | null>(null);
  const updateItem = useUpdateQuoteItem();

  const startEdit = (item: QuoteItem) => {
    setEditingId(item.id);
    setDraft(toEditState(item));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = (itemId: number) => {
    if (!draft) return;
    const qty = parseInt(draft.quantity || "0", 10) || 0;
    const listPrice = num(draft.listPrice);
    const discountedPrice = num(draft.discountedPrice);
    // Recalculate extended values on save.
    const extendedListPrice = qty * listPrice;
    const extendedDiscountedPrice = qty * discountedPrice;

    updateItem.mutate(
      {
        quoteId,
        itemId,
        patch: {
          partNumber: draft.partNumber,
          description: draft.description,
          eligibilityPercent: parseInt(draft.eligibilityPercent || "100", 10) || 100,
          quantity: qty,
          listPrice: String(listPrice),
          discountedPrice: String(discountedPrice),
          extendedListPrice: String(extendedListPrice),
          extendedDiscountedPrice: String(extendedDiscountedPrice),
        },
      },
      { onSuccess: cancelEdit },
    );
  };

  const set = (key: keyof EditState, value: string) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  // Totals
  const subtotal = items.reduce((sum, it) => {
    const ext =
      it.extendedDiscountedPrice != null
        ? num(it.extendedDiscountedPrice)
        : num(it.quantity ?? 0) * num(it.discountedPrice);
    return sum + ext;
  }, 0);
  const salesTax = 0;
  const shipping = 0;
  const grandTotal = subtotal + salesTax + shipping;

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
        No line items were extracted from this quote.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part #</TableHead>
              <TableHead className="min-w-[14rem]">Description</TableHead>
              <TableHead className="text-right">Elig %</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">List Price</TableHead>
              <TableHead className="text-right">Ext. List</TableHead>
              <TableHead className="text-right">Disc. Price</TableHead>
              <TableHead className="text-right">Ext. Disc.</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const editing = editingId === item.id && draft;
              const qty = editing ? parseInt(draft!.quantity || "0", 10) || 0 : item.quantity ?? 0;
              const listPrice = editing ? num(draft!.listPrice) : num(item.listPrice);
              const discPrice = editing ? num(draft!.discountedPrice) : num(item.discountedPrice);
              const extList = editing ? qty * listPrice : num(item.extendedListPrice);
              const extDisc = editing ? qty * discPrice : num(item.extendedDiscountedPrice);

              return (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">
                    {editing ? (
                      <Input
                        value={draft!.partNumber}
                        onChange={(e) => set("partNumber", e.target.value)}
                        className="h-8"
                      />
                    ) : (
                      item.partNumber || "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {editing ? (
                      <Input
                        value={draft!.description}
                        onChange={(e) => set("description", e.target.value)}
                        className="h-8"
                      />
                    ) : (
                      <span className="line-clamp-2">{item.description || "—"}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editing ? (
                      <Input
                        type="number"
                        value={draft!.eligibilityPercent}
                        onChange={(e) => set("eligibilityPercent", e.target.value)}
                        className="h-8 w-16 text-right"
                      />
                    ) : (
                      `${item.eligibilityPercent ?? 100}%`
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editing ? (
                      <Input
                        type="number"
                        value={draft!.quantity}
                        onChange={(e) => set("quantity", e.target.value)}
                        className="h-8 w-16 text-right"
                      />
                    ) : (
                      qty
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {editing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={draft!.listPrice}
                        onChange={(e) => set("listPrice", e.target.value)}
                        className="h-8 w-24 text-right"
                      />
                    ) : (
                      formatCurrency(listPrice)
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatCurrency(extList)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {editing ? (
                      <Input
                        type="number"
                        step="0.01"
                        value={draft!.discountedPrice}
                        onChange={(e) => set("discountedPrice", e.target.value)}
                        className="h-8 w-24 text-right"
                      />
                    ) : (
                      formatCurrency(discPrice)
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(extDisc)}
                  </TableCell>
                  <TableCell className="text-right">
                    {editing ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-emerald-600"
                          onClick={() => saveEdit(item.id)}
                          disabled={updateItem.isPending}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground"
                          onClick={cancelEdit}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => startEdit(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Totals panel */}
      <div className="flex justify-end">
        <div className="w-full max-w-xs rounded-lg border bg-card p-4 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="tabular-nums">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Sales Tax</span>
            <span className="tabular-nums">{formatCurrency(salesTax)}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">Shipping</span>
            <span className="tabular-nums">{formatCurrency(shipping)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t pt-2 font-bold">
            <span>GRAND TOTAL</span>
            <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
