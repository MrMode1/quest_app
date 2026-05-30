import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { UploadCloud, Loader2 } from "lucide-react";
import { useCreateQuote } from "@/hooks/use-quotes";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.csv,.xlsx,.xls,.txt";

export default function NewQuote() {
  const [, navigate] = useLocation();
  const createQuote = useCreateQuote();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (file: File | undefined) => {
    if (!file || createQuote.isPending) return;
    createQuote.mutate(file, {
      onSuccess: (quote) => navigate(`/quotes/${quote.id}`),
      onError: (e) =>
        toast({ title: "Upload failed", description: String(e), variant: "destructive" }),
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">New Quote</h1>
        <p className="text-sm text-muted-foreground">
          Upload a distributor quote (PDF, Excel, CSV, or text). Extraction starts automatically.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => !createQuote.isPending && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !createQuote.isPending)
            inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex min-h-[18rem] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card p-10 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
          createQuote.isPending && "pointer-events-none opacity-90",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {createQuote.isPending ? (
          <>
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-primary" />
            <div className="text-base font-medium">Uploading &amp; Starting AI Extraction…</div>
            <div className="mt-1 text-sm text-muted-foreground">
              This only takes a moment. You&apos;ll be redirected automatically.
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadCloud className="h-7 w-7" />
            </div>
            <div className="text-base font-medium">
              Drag &amp; drop a quote file here, or click to browse
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Supports PDF, XLSX, XLS, CSV, and TXT
            </div>
          </>
        )}
      </div>
    </div>
  );
}
