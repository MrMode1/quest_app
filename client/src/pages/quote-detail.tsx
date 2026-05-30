import { useEffect, useRef } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Download, FileSpreadsheet, Loader2, Play, RefreshCw } from "lucide-react";
import type { QuoteItem } from "@shared/schema";
import { useQuote, useProcessQuote } from "@/hooks/use-quotes";
import { StatusBadge } from "@/components/status-badge";
import { QuoteTable } from "@/components/quote-table";
import { Button } from "@/components/ui/button";
import { num } from "@/lib/utils";

function downloadCsv(filename: string, items: QuoteItem[]) {
  const headers = [
    "Part #",
    "Description",
    "E-Rate Eligibility %",
    "Qty",
    "List Price",
    "Extended List Price",
    "Discounted Price",
    "Extended Discounted Price",
    "Manufacturer",
  ];
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = items.map((it) =>
    [
      it.partNumber ?? "",
      it.description ?? "",
      it.eligibilityPercent ?? 100,
      it.quantity ?? 0,
      num(it.listPrice).toFixed(2),
      num(it.extendedListPrice).toFixed(2),
      num(it.discountedPrice).toFixed(2),
      num(it.extendedDiscountedPrice).toFixed(2),
      it.manufacturer ?? "",
    ]
      .map(escape)
      .join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function QuoteDetail() {
  const [, params] = useRoute("/quotes/:id");
  const id = params ? Number(params.id) : undefined;
  const { data, isLoading } = useQuote(id);
  const processQuote = useProcessQuote();
  const autoProcessTriggered = useRef(false);

  useEffect(() => {
    if (!data?.quote || data.quote.status !== "pending" || autoProcessTriggered.current) return;
    autoProcessTriggered.current = true;
    processQuote.mutate(data.quote.id);
  }, [data?.quote?.id, data?.quote?.status, processQuote]);

  if (isLoading || !data) {
    return (
      <div className="flex h-full items-center justify-center p-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading quote…
      </div>
    );
  }

  const { quote, items } = data;
  const isProcessing = quote.status === "processing";

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild size="icon" variant="ghost" className="h-9 w-9">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{quote.filename}</h1>
              <StatusBadge status={quote.status} />
            </div>
            <div className="text-xs text-muted-foreground">
              QT{String(quote.id).padStart(5, "0")}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {quote.status === "pending" && (
            <Button
              variant="secondary"
              onClick={() => processQuote.mutate(quote.id)}
              disabled={processQuote.isPending}
            >
              <Play className="h-4 w-4" /> Process
            </Button>
          )}
          {quote.status === "error" && (
            <Button
              variant="secondary"
              onClick={() => processQuote.mutate(quote.id)}
              disabled={processQuote.isPending}
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => downloadCsv(`Questivity_Quote_QT${String(quote.id).padStart(5, "0")}.csv`, items)}
            disabled={isProcessing}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button
            onClick={() => {
              window.location.href = `/api/quotes/${quote.id}/export`;
            }}
            disabled={isProcessing}
          >
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </Button>
        </div>
      </div>

      {isProcessing || quote.status === "pending" ? (
        <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-xl border bg-card p-12 text-center">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
          <div className="text-base font-medium">AI Processing in Progress</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Extracting and standardizing line items. This page refreshes automatically.
          </div>
        </div>
      ) : quote.status === "error" ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
          Something went wrong while processing this quote. Use “Retry” to run extraction again.
        </div>
      ) : (
        <QuoteTable quoteId={quote.id} items={items} />
      )}
    </div>
  );
}
