import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FolderOpen, Grid3x3, GalleryHorizontal, FileImage, Loader2, X } from "lucide-react";
import { parseCrm, type CrmFile } from "@/lib/crm";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CRM Viewer — Visualizador de fundos .crm" },
      { name: "description", content: "Importe pastas com arquivos .crm e visualize os fundos em grade ou portfólio." },
      { property: "og:title", content: "CRM Viewer" },
      { property: "og:description", content: "Visualize os fundos contidos em arquivos .crm." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Flat = { file: CrmFile; imgIndex: number };

function Index() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<CrmFile[]>([]);
  const [loading, setLoading] = useState<{ done: number; total: number } | null>(null);
  const [mode, setMode] = useState<"grid" | "portfolio">("grid");
  const [current, setCurrent] = useState(0);

  const flat = useMemo<Flat[]>(
    () => files.flatMap((f) => f.images.map((_, i) => ({ file: f, imgIndex: i }))),
    [files],
  );

  const onPick = async (list: FileList | null) => {
    if (!list) return;
    const crms = Array.from(list)
      .filter((f) => f.name.toLowerCase().endsWith(".crm"))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    files.forEach((f) => f.images.forEach((i) => URL.revokeObjectURL(i.url)));
    setFiles([]);
    setCurrent(0);
    setLoading({ done: 0, total: crms.length });
    const out: CrmFile[] = [];
    for (const f of crms) {
      const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      out.push(await parseCrm(f, path));
      setFiles([...out]);
      setLoading({ done: out.length, total: crms.length });
    }
    setLoading(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const go = useCallback(
    (d: number) => setCurrent((c) => (flat.length ? (c + d + flat.length) % flat.length : 0)),
    [flat.length],
  );

  useEffect(() => {
    if (mode !== "portfolio") return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Escape") setMode("grid");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [mode, go]);

  const open = (file: CrmFile, imgIndex: number) => {
    const idx = flat.findIndex((f) => f.file === file && f.imgIndex === imgIndex);
    setCurrent(Math.max(0, idx));
    setMode("portfolio");
  };

  const cur = flat[current];
  const totalImgs = flat.length;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-background/90 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <FileImage className="h-5 w-5 text-primary" />
          <h1 className="font-mono text-sm font-semibold tracking-widest uppercase">CRM Viewer</h1>
        </div>
        {files.length > 0 && (
          <span className="font-mono text-xs text-muted-foreground">
            {files.length} arquivos · {totalImgs} imagens
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {files.length > 0 && (
            <div className="flex rounded-md border border-border p-0.5">
              <button
                onClick={() => setMode("grid")}
                className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-colors ${mode === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Grid3x3 className="h-3.5 w-3.5" /> Grade
              </button>
              <button
                onClick={() => setMode("portfolio")}
                disabled={!totalImgs}
                className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs transition-colors ${mode === "portfolio" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <GalleryHorizontal className="h-3.5 w-3.5" /> Portfólio
              </button>
            </div>
          )}
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <FolderOpen className="h-4 w-4" /> Importar pasta
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          />
        </div>
      </header>

      {loading && (
        <div className="flex items-center gap-2 border-b border-border px-6 py-2 font-mono text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lendo {loading.done}/{loading.total}…
        </div>
      )}

      {files.length === 0 && !loading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <button
            onClick={() => inputRef.current?.click()}
            className="flex h-48 w-full max-w-md flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <FolderOpen className="h-10 w-10" />
            <span className="text-sm">Selecione uma pasta com arquivos .crm</span>
          </button>
        </div>
      )}

      {mode === "grid" && files.length > 0 && (
        <main className="flex flex-col gap-8 p-6">
          {files.map((f) => (
            <section key={f.path}>
              <h2 className="mb-3 font-mono text-sm text-foreground">
                {f.name}
                <span className="ml-2 text-muted-foreground">
                  {f.error ? `— ${f.error}` : `${f.images.length} ${f.images.length === 1 ? "imagem" : "imagens"}`}
                </span>
              </h2>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 border-l border-border pl-4">
                {f.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => open(f, i)}
                    className="group overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-primary"
                  >
                    <div className="checker flex aspect-video items-center justify-center overflow-hidden">
                      <img src={img.url} alt={`${f.name} ${img.name}`} className="h-full w-full object-contain transition-transform group-hover:scale-105" loading="lazy" />
                    </div>
                    <div className="flex justify-between px-3 py-2 font-mono text-xs">
                      <span>{img.name}</span>
                      <span className="text-muted-foreground">{img.width}×{img.height}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </main>
      )}

      {mode === "portfolio" && cur && (
        <main className="relative flex flex-1 flex-col">
          <div className="flex items-center justify-between px-6 py-3 font-mono text-xs">
            <span>
              {cur.file.name} <span className="text-muted-foreground">/ {cur.file.images[cur.imgIndex].name}</span>
            </span>
            <span className="text-muted-foreground">
              {current + 1} / {totalImgs} · {cur.file.images[cur.imgIndex].width}×{cur.file.images[cur.imgIndex].height}
            </span>
            <button onClick={() => setMode("grid")} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-20 pb-4">
            <button onClick={() => go(-1)} aria-label="Anterior" className="absolute left-4 rounded-full border border-border bg-card p-3 transition-colors hover:border-primary">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <img
              key={current}
              src={cur.file.images[cur.imgIndex].url}
              alt=""
              className="max-h-[calc(100vh-220px)] max-w-full animate-in fade-in object-contain shadow-2xl duration-300"
            />
            <button onClick={() => go(1)} aria-label="Próxima" className="absolute right-4 rounded-full border border-border bg-card p-3 transition-colors hover:border-primary">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto border-t border-border px-6 py-3">
            {flat.map((f, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-14 shrink-0 overflow-hidden rounded border-2 transition-colors ${i === current ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
              >
                <img src={f.file.images[f.imgIndex].url} alt="" className="h-full w-auto" />
              </button>
            ))}
          </div>
        </main>
      )}
    </div>
  );
}
