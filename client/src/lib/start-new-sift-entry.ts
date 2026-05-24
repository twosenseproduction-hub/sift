/** Guest has an unsaved sift in session — confirm before abandoning. */
export function confirmLeavingUnsavedGuestSift(): boolean {
  try {
    if (typeof sessionStorage === "undefined") return true;
    if (!sessionStorage.getItem("sift.unsavedGuestSift")) return true;
  } catch {
    return true;
  }
  return window.confirm(
    "This Sift is only temporary right now. Leave without saving it?",
  );
}

/** Clear the live composer session and focus the input. Returns false if cancelled. */
export function requestNewSiftEntry(): boolean {
  if (!confirmLeavingUnsavedGuestSift()) return false;
  window.dispatchEvent(new CustomEvent("sift:home-reset"));
  window.setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent("sift:focus-composer", { detail: { select: true } }),
    );
  }, 80);
  return true;
}
