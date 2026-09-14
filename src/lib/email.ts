import { Resend } from "resend";

// Same "optional integration, never breaks the feature it's attached to"
// pattern as push.ts's VAPID check — except email failures here are
// swallowed (logged, not thrown) rather than thrown, because sending a
// welcome email is a side effect of signup, not something that should ever
// fail the signup itself. Without RESEND_API_KEY set, this just no-ops.
let client: Resend | null | undefined;
function getClient(): Resend | null {
  if (client !== undefined) return client;
  const apiKey = process.env.RESEND_API_KEY;
  client = apiKey ? new Resend(apiKey) : null;
  if (!client) console.warn("RESEND_API_KEY is not set — emails will be logged, not sent.");
  return client;
}

const EMAIL_FROM = process.env.EMAIL_FROM || "Proudly <onboarding@resend.dev>";

// A minimal shared layout — inline styles only, since email clients strip
// <style> tags and ignore most CSS beyond that. Kept close to the app's own
// warm/terracotta palette so an email actually looks like it came from
// Proudly rather than a generic transactional-email template.
function layout(bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:32px 16px;background-color:#fbf6ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#2b2420;">
    <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background-color:#fffdfa;border-radius:16px;border:1px solid #e9ddcc;">
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 24px;font-size:22px;font-weight:700;color:#c1592f;">Proudly</p>
          ${bodyHtml}
        </td>
      </tr>
    </table>
    <p style="max-width:480px;margin:16px auto 0;text-align:center;font-size:12px;color:#85786a;">
      You're receiving this because you have a Proudly account.
    </p>
  </body>
</html>`.trim();
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  const resend = getClient();
  if (!resend) {
    console.log(`[email:not-configured] to=${to} subject="${subject}"`);
    return;
  }

  try {
    await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
  } catch (err) {
    // Never let an email provider outage take down the flow that triggered
    // it (signup, password change, …) — log and move on.
    console.error(`Failed to send email "${subject}" to ${to}:`, err);
  }
}

export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const firstName = name.trim().split(/\s+/)[0] || name;
  await sendEmail({
    to,
    subject: "Welcome to Proudly",
    html: layout(`
      <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Hi ${firstName},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2b2420;">
        Your account is set up. Proudly is where you'll journal what you're proud of, track goals,
        time your study sessions, and log workouts — all in one place.
      </p>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#2b2420;">
        First thing worth doing: write today's journal entry, or set up a goal you want to keep track of.
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#85786a;">
        If you didn't create this account, you can ignore this email.
      </p>
    `),
  });
}

export async function sendPasswordChangedEmail(to: string, name: string): Promise<void> {
  const firstName = name.trim().split(/\s+/)[0] || name;
  await sendEmail({
    to,
    subject: "Your Proudly password was changed",
    html: layout(`
      <p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Hi ${firstName},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#2b2420;">
        This is a confirmation that your Proudly account password was just changed.
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#85786a;">
        If this wasn't you, your account may be compromised — sign in and change your password again
        right away.
      </p>
    `),
  });
}
