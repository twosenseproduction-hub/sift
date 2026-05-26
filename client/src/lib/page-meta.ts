const DEFAULT_TITLE =
  "Sift — Tell what matters from what is only loud";
const DEFAULT_DESCRIPTION =
  "Sift helps you tell what matters from what is only loud. Speak or type the tangle. Get back the signal underneath, and one next step you can actually take.";

function upsertMeta(
  selector: string,
  create: () => HTMLMetaElement,
  content: string,
) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

export function setPageMeta(meta: { title: string; description: string }) {
  if (typeof document === "undefined") return;
  document.title = meta.title;
  upsertMeta(
    'meta[name="description"]',
    () => {
      const tag = document.createElement("meta");
      tag.setAttribute("name", "description");
      return tag;
    },
    meta.description,
  );
  upsertMeta(
    'meta[property="og:title"]',
    () => {
      const tag = document.createElement("meta");
      tag.setAttribute("property", "og:title");
      return tag;
    },
    meta.title,
  );
  upsertMeta(
    'meta[property="og:description"]',
    () => {
      const tag = document.createElement("meta");
      tag.setAttribute("property", "og:description");
      return tag;
    },
    meta.description,
  );
  upsertMeta(
    'meta[name="twitter:title"]',
    () => {
      const tag = document.createElement("meta");
      tag.setAttribute("name", "twitter:title");
      return tag;
    },
    meta.title,
  );
  upsertMeta(
    'meta[name="twitter:description"]',
    () => {
      const tag = document.createElement("meta");
      tag.setAttribute("name", "twitter:description");
      return tag;
    },
    meta.description,
  );
}

export function resetPageMeta() {
  setPageMeta({ title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION });
}

export function dailySiftPageDescription(promptText: string): string {
  const trimmed = promptText.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 160) return trimmed;
  return `${trimmed.slice(0, 157)}…`;
}
