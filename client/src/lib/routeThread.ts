// Lightweight client mirror of the server's routeThread() heuristic
// (server/routes.ts). The composer uses this to show a quiet preview pill
// of which mode the input will likely route to. The server remains the
// source of truth — this is a visual hint only, not an override.
//
// Keep in sync with the server regex set. If the server changes its
// heuristic, this should change too; small drift is acceptable because
// the user can always see the routed mode on the result.

export type ClientRoutedMode = "personal" | "operator" | "auto";

export function previewModeFromInput(input: string): "personal" | "operator" {
  const L = input.toLowerCase();
  if (
    /\b(project|deadline|launch|ship|revenue|customer|mvp|pitch|investor|roadmap)\b/.test(
      L,
    ) &&
    /\b(team|busy|overwhelmed|stuck|behind|paralyzed|scattered)\b/.test(L)
  ) {
    return "operator";
  }
  if (
    /\b(decision|choosing|deciding|option a|option b|vs \.|versus |either .+ or|should i|which one)\b/.test(
      L,
    )
  ) {
    return "operator";
  }
  if (
    /\b(partner|client|boss|cofounder|investor|team member|board|collaborator|spouse|member)\b/.test(
      L,
    ) &&
    /\b(frustrat|tension|friction|misalign|trust|accountability|expectations|communication)\b/.test(
      L,
    )
  ) {
    return "operator";
  }
  if (
    /\b(clarify|structure|organize|restructure|simplify|sequence|untangle|streamline)\b/.test(
      L,
    )
  ) {
    return "operator";
  }
  // Default: personal.
  return "personal";
}
