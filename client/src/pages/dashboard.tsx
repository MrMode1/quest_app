import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  FileText,
  ChevronRight,
  MoreVertical,
  Trash2,
  Plus,
  Files,
  Clock,
  Sparkles,
} from "lucide-react";
import type { Quote } from "@shared/schema";
import { useQuotes, useDeleteQuote } from "@/hooks/use-quotes";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { data: quotes = [], isLoading } = useQuotes();
  const deleteQuote = useDeleteQuote();
  const { toast } = useToast();
  const [target, setTarget] = useState<Quote | null>(null);

  const total = quotes.length;
  const pending = quotes.filter((q) => q.status === "pending" || q.status === "processing").length;

  const confirmDelete = () => {
    if (!target) return;
    deleteQuote.mutate(target.id, {
      onSuccess: () => toast({ title: "Quote deleted", description: target.filename }),
      onError: (e) =>
        toast({ title: "Delete failed", description: String(e), variant: "destructive" }),
    });
    setTarget(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Your converted distributor quotes</p>
        </div>
        <Button asChild>
          <Link href="/quotes/new">
            <Plus className="h-4 w-4" /> New Quote
          </Link>
        </Button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Files className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{total}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Total Quotes
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{pending}</div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Pending Review
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-primary to-teal-700 text-primary-foreground">
          <CardContent className="flex h-full flex-col justify-between p-5">
            <Sparkles className="h-5 w-5 opacity-90" />
            <div>
              <div className="text-base font-bold">Questivity Pro</div>
              <div className="text-xs opacity-90">AI extraction, unlimited quotes</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">Loading quotes…</div>
          ) : quotes.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No quotes yet. Upload a distributor quote to get started.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {quotes.map((q) => (
                <li key={q.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                  <Link
                    href={`/quotes/${q.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{q.filename}</div>
                      <div className="text-xs text-muted-foreground">
                        QT{String(q.id).padStart(5, "0")} ·{" "}
                        {q.createdAt ? format(new Date(q.createdAt), "MMM d, yyyy h:mm a") : "—"}
                      </div>
                    </div>
                    <StatusBadge status={q.status} />
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setTarget(q)}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quote?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes “{target?.filename}” and all of its line items. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
