import { Resend } from "resend";

export type DailyPromptEmailInput = {
  to: string;
  firstName?: string | null;
  promptText: string;
  themeName: string;
  promptId: number;
  ctaUrl: string;
};

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  if (!resendClient) resendClient = new Resend(key);
  return resendClient;
}

export function dailyPromptEmailFromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Sift <prompts@siftnow.io>"
  );
}

export function dailyPromptCtaBaseUrl(): string {
  const base =
    process.env.APP_BASE_URL?.trim() ||
    process.env.PUBLIC_APP_URL?.trim() ||
    "https://app.siftnow.io";
  return base.replace(/\/$/, "");
}

export function buildDailyPromptCtaUrl(promptId: number): string {
  const base = dailyPromptCtaBaseUrl();
  return `${base}/#/sift?dailyPrompt=1&promptId=${promptId}`;
}

function pickSubject(promptId: number): string {
  const subjects = [
    "Your Sift prompt for today",
    "A small clarity check-in for today",
  ];
  return subjects[promptId % subjects.length];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderDailyPromptEmailHtml(input: DailyPromptEmailInput): string {
  const greeting = input.firstName?.trim()
    ? `Hi ${escapeHtml(input.firstName.trim())},`
    : "Hi,";
  const prompt = escapeHtml(input.promptText);
  const theme = escapeHtml(input.themeName);
  const cta = escapeHtml(input.ctaUrl);
  const settingsUrl = escapeHtml(`${dailyPromptCtaBaseUrl()}/#/library`);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f1e5;font-family:Georgia,'Times New Roman',serif;color:#2f2a22;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f1e5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#fbf7ef;border:1px solid #d7c8b4;border-radius:16px;padding:28px 24px;">
        <tr><td style="font-size:15px;line-height:1.6;padding-bottom:16px;">${greeting}</td></tr>
        <tr><td style="font-size:14px;line-height:1.6;color:#675d4f;padding-bottom:20px;">
          One small prompt — based on what you&apos;ve been circling, when there&apos;s enough signal to use it.
        </td></tr>
        <tr><td style="font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:#8a7f70;padding-bottom:8px;">${theme}</td></tr>
        <tr><td style="font-size:18px;line-height:1.55;padding-bottom:24px;">${prompt}</td></tr>
        <tr><td style="padding-bottom:28px;">
          <a href="${cta}" style="display:inline-block;background:#3d5a45;color:#fbf7ef;text-decoration:none;font-family:system-ui,-apple-system,sans-serif;font-size:14px;font-weight:600;padding:12px 20px;border-radius:999px;">Open in Sift</a>
        </td></tr>
        <tr><td style="font-size:12px;line-height:1.6;color:#8a7f70;border-top:1px solid #e8ddd0;padding-top:16px;">
          You&apos;re receiving this because daily prompt emails are on for your account.
          <a href="${settingsUrl}" style="color:#675d4f;">Turn off or change the time</a> in Settings.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export type DailyPromptEmailSendResult =
  | { ok: true; id: string }
  | { ok: false; error: string; skipped?: boolean };

export async function sendDailyPromptEmail(
  input: DailyPromptEmailInput,
): Promise<DailyPromptEmailSendResult> {
  const resend = getResend();
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY not configured", skipped: true };
  }

  const subject = pickSubject(input.promptId);
  const html = renderDailyPromptEmailHtml(input);

  try {
    const { data, error } = await resend.emails.send({
      from: dailyPromptEmailFromAddress(),
      to: input.to,
      subject,
      html,
    });
    if (error) {
      return { ok: false, error: error.message || "Resend send failed" };
    }
    return { ok: true, id: data?.id ?? "unknown" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown send error";
    return { ok: false, error: message };
  }
}
