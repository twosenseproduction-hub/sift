import { useState } from "react";
import { Header, Footnote } from "@/components/brand";
import { Composer, Result } from "@/components/sift-ui";
import type { SiftResult } from "@shared/schema";

export default function Home() {
  const [result, setResult] = useState<SiftResult | null>(null);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 md:px-8 pb-16">
          {!result ? (
            <div className="pt-10 md:pt-16">
              <div className="text-center mb-10 md:mb-14">
                <p className="text-[11px] tracking-[0.25em] uppercase text-primary/80 mb-4 font-medium">
                  Clarity over comfort
                </p>
                <h1 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight">
                  What are you holding
                  <br />
                  <em className="text-primary not-italic" style={{ fontStyle: "italic" }}>
                    right now?
                  </em>
                </h1>
                <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
                  Speak it or type it. Sift strips away the noise and returns
                  the themes, the real want, and one next step you can take.
                </p>
              </div>

              <Composer onResult={setResult} />
            </div>
          ) : (
            <div className="pt-8 md:pt-12">
              <Result result={result} onReset={() => setResult(null)} />
            </div>
          )}
        </div>
      </main>

      <Footnote />
    </div>
  );
}
