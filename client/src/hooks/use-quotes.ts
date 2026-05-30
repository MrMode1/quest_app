import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Quote, QuoteItem, InsertQuoteItem } from "@shared/schema";

export interface QuoteDetail {
  quote: Quote;
  items: QuoteItem[];
}

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export function useQuotes() {
  return useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
    queryFn: () => jsonFetch<Quote[]>("/api/quotes"),
  });
}

export function useQuote(id: number | undefined) {
  return useQuery<QuoteDetail>({
    queryKey: [`/api/quotes/${id}`],
    queryFn: () => jsonFetch<QuoteDetail>(`/api/quotes/${id}`),
    enabled: id != null && !Number.isNaN(id),
    // Auto-poll every 3s while the quote is still pending or processing.
    refetchInterval: (query) => {
      const status = query.state.data?.quote.status;
      return status === "processing" || status === "pending" ? 3000 : false;
    },
  });
}

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      // Plain fetch — multipart upload must not set Content-Type manually.
      const res = await fetch("/api/quotes", { method: "POST", body: form, credentials: "include" });
      if (!res.ok) {
        let detail = await res.text().catch(() => res.statusText);
        try {
          const parsed = JSON.parse(detail) as { message?: string };
          if (parsed.message) detail = parsed.message;
        } catch {
          /* keep raw text */
        }
        throw new Error(detail || `Upload failed (${res.status})`);
      }
      return res.json() as Promise<Quote>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/quotes"] }),
  });
}

export function useProcessQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      jsonFetch(`/api/quotes/${id}/process`, { method: "POST" }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: [`/api/quotes/${id}`] });
      qc.invalidateQueries({ queryKey: ["/api/quotes"] });
    },
  });
}

export function useUpdateQuoteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      quoteId,
      itemId,
      patch,
    }: {
      quoteId: number;
      itemId: number;
      patch: Partial<InsertQuoteItem>;
    }) =>
      jsonFetch<QuoteItem>(`/api/quotes/${quoteId}/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: [`/api/quotes/${vars.quoteId}`] }),
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => jsonFetch(`/api/quotes/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/quotes"] }),
  });
}
