// Minimal analytics hook.
//
// We do not have a real analytics pipeline yet. This helper exists so that
// product event names live in the codebase and we can wire them up later
// without rewriting call sites. In dev it logs; in prod it is a no-op.
//
// TODO(events): replace this with a real client (PostHog / Plausible / etc.)
// when we add one. Keep the signature stable: `track(name, props?)`.

export type SiftEventName =
  // Signal / Noise practice
  | "sn.shown"
  | "sn.card_placed.matters"
  | "sn.card_placed.noise"
  | "sn.card_placed.unsure"
  | "sn.completed"
  | "sn.skipped"
  | "sn.next_step_generated"
  | "sn.expand_now"
  | "sn.come_back_later";

export function track(
  name: SiftEventName,
  props?: Record<string, string | number | boolean | undefined>,
): void {
  if (typeof window === "undefined") return;
  // In dev, log so we can see the funnel. In prod, no-op.
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[track]", name, props ?? {});
  }
  // TODO(events): forward to a real analytics client.
}
