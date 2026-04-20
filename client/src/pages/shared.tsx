import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Header, Footnote } from "@/components/brand";
import { Result, Thinking } from "@/components/sift-ui";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import type { SiftResult } from "@shared/schema";

export default function Shared() {
  const [, params] = useRoute("/s/:id");
  const id = params?.id ?? "";

  const { data, isLoading, isError } = useQuery<SiftResult>({
    queryKey: ["/api/sift", id],
    enabled: !!id,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 md:px-8 pb-16 pt-8 md:pt-12">
          {isLoading && <Thinking />}

          {isError && (
            <div className="text-center py-20">
              <p className="font-serif text-2xl mb-3">This sift isn't here.</p>
              <p className="text-muted-foreground mb-8">
                It may have been removed, or the link is off by a character.
              </p>
              <Link href="/" data-testid="link-home-fallback">
                <a>
                  <Button variant="default" className="gap-2">
                    Start fresh <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
              </Link>
            </div>
          )}

          {data && (
            <>
              <div className="mb-10 md:mb-12">
                <p className="text-[11px] tracking-[0.25em] uppercase text-primary/80 font-medium">
                  A shared sift
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {new Date(data.createdAt).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
              <Result result={data} readOnly />
              <div className="pt-12 mt-12 border-t border-border/60 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Have a tangle of your own?
                </p>
                <Link href="/" data-testid="link-start-own">
                  <a>
                    <Button variant="default" className="gap-2">
                      Sift something of your own
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </a>
                </Link>
              </div>
            </>
          )}
        </div>
      </main>

      <Footnote />
    </div>
  );
}
