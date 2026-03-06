"use client";

import { BackButton } from "@/components/BackButton";
import { useEffect, useState } from "react";

export default function DebugPage(): React.JSX.Element {
  const [raw, setRaw] = useState<string>("Loading...");

  useEffect(() => {
    const run = async (): Promise<void> => {
      try {
        const response = await fetch("/api/debug/raw", { cache: "no-store" });
        const body = await response.json();
        setRaw(JSON.stringify(body, null, 2));
      } catch (error) {
        setRaw(`Failed to load raw cache: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    void run();
  }, []);

  return (
    <main style={{ minHeight: "100vh", padding: "1rem", background: "#020611", color: "#dce8ff" }}>
      <div style={{ marginBottom: "0.75rem" }}>
        <BackButton label="Back" fallbackHref="/" />
      </div>
      <h1>Raw Scraped JSON</h1>
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{raw}</pre>
    </main>
  );
}
