import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";

export default function Audit() {
  const [md, setMd] = useState("");

  useEffect(() => {
    fetch(new URL("../docs/app-audit.md", import.meta.url).href)
      .then((r) => r.text())
      .then(setMd)
      .catch(() => setMd("# Error loading audit document"));
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <article className="prose prose-slate dark:prose-invert max-w-none
          prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-h2:border-b prose-h2:pb-2 prose-h2:mt-10
          prose-h3:text-lg prose-h3:mt-8
          prose-table:text-sm prose-th:text-left prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-1.5
          prose-table:border prose-th:border prose-td:border prose-th:bg-muted/50
          prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-muted prose-pre:border prose-pre:border-border
          prose-hr:border-border
          prose-a:text-primary
        ">
          <ReactMarkdown>{md}</ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
