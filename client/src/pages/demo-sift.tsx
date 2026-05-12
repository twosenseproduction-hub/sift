import { Header, Footnote } from "@/components/brand";
import { Link } from "wouter";
import { Result } from "@/components/sift-ui";
import { DEMO_SIFT_PREVIEW } from "@/lib/demo-sift-preview";

export default function DemoSiftPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 md:px-8 pb-16 pt-10 md:pt-14">
          <p className="text-[11px] tracking-[0.22em] uppercase font-medium text-primary/80 mb-2">
            Preview
          </p>
          <h1 className="font-serif text-2xl md:text-3xl text-foreground leading-snug mb-3">
            Sample sift layout
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-xl">
            This card is static—no saved thread. Signal and noise stay tucked under{" "}
            <strong className="text-foreground/90 font-medium">Show signal &amp; noise</strong>{" "}
            until you choose to open them.
          </p>
          <Result result={DEMO_SIFT_PREVIEW} readOnly />
          <div className="mt-10 pt-8 border-t border-border/55">
            <Link href="/">
              <a className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border/70 hover:decoration-foreground transition-colors">
                Back to Sift
              </a>
            </Link>
          </div>
        </div>
      </main>
      <Footnote />
    </div>
  );
}
