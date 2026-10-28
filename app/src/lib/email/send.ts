import { env, requireEnv } from "@/lib/env";
import { absoluteUrl } from "@/lib/seo/metadata";
import { createTransport } from "nodemailer";

/**
 * Outbound email.
 *
 * The development transport prints the message — **including the link** — to the
 * terminal. That is not a stub: it makes the entire verification and reset flow
 * testable with no SMTP server, no mail account and no network, which is the
 * difference between these flows being exercised constantly and being exercised
 * once before launch.
 *
 * There is no HTML templating engine here on purpose. These are five short
 * transactional messages; a layout function and template literals are easier to
 * read, easier to keep accessible, and do not add a dependency that renders
 * untrusted input.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  /** Plain text. Always sent — some people read mail in a terminal, and every
   * spam filter wants it. */
  text: string;
  html: string;
};

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (env.EMAIL_TRANSPORT === "console") {
    const line = "─".repeat(72);
    console.log(
      [
        "",
        line,
        `  EMAIL → ${message.to}`,
        `  ${message.subject}`,
        line,
        message.text
          .split("\n")
          .map((row) => `  ${row}`)
          .join("\n"),
        line,
        "",
      ].join("\n"),
    );
    return;
  }

  const port = requireEnv("SMTP_PORT", "SMTP email delivery");
  const transport = createTransport({
    host: requireEnv("SMTP_HOST", "SMTP email delivery"),
    port,
    secure: port === 465,
    auth: {
      user: requireEnv("SMTP_USER", "SMTP email delivery"),
      pass: requireEnv("SMTP_PASSWORD", "SMTP email delivery"),
    },
  });

  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

/* --------------------------------------------------------------- templates */

function layout(heading: string, body: string, action?: { label: string; url: string }): string {
  const button = action
    ? `<p style="margin:32px 0"><a href="${action.url}" style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600">${action.label}</a></p>
       <p style="color:#52525b;font-size:14px">If the button does not work, paste this into your browser:<br><span style="word-break:break-all">${action.url}</span></p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#fafaf9;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#27272a">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px">
      <p style="font-weight:700;font-size:18px;letter-spacing:-0.01em;margin:0 0 32px">Nexivora</p>
      <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px">${heading}</h1>
      ${body}
      ${button}
      <hr style="border:none;border-top:1px solid #e4e4e7;margin:40px 0 16px">
      <p style="color:#71717a;font-size:13px;margin:0">You received this because someone used this address on Nexivora. If it was not you, no action is needed.</p>
    </div>
  </body></html>`;
}

export function verificationEmail(to: string, name: string, token: string): EmailMessage {
  const url = absoluteUrl(`/verify-email/${token}`);

  return {
    to,
    subject: "Confirm your Nexivora address",
    text: `Hello ${name},\n\nConfirm this address to finish setting up your account:\n\n${url}\n\nThe link expires in 24 hours. Until it is confirmed you can look around, but you cannot post or create work.`,
    html: layout(
      `Confirm your address`,
      `<p style="line-height:1.6">Hello ${name} — confirm this address to finish setting up your account. Until it is confirmed you can look around, but you cannot post or create work.</p>
       <p style="color:#52525b;font-size:14px">The link expires in 24 hours.</p>`,
      { label: "Confirm my address", url },
    ),
  };
}

export function passwordResetEmail(to: string, name: string, token: string): EmailMessage {
  const url = absoluteUrl(`/reset-password/${token}`);

  return {
    to,
    subject: "Reset your Nexivora password",
    text: `Hello ${name},\n\nUse this link to choose a new password:\n\n${url}\n\nThe link works once and expires in 30 minutes. If you did not ask for it, ignore this message — your password has not changed.`,
    html: layout(
      "Choose a new password",
      `<p style="line-height:1.6">Hello ${name} — use the button below to choose a new password. The link works <strong>once</strong> and expires in 30 minutes.</p>
       <p style="line-height:1.6">If you did not ask for this, you can ignore it. Your password has not changed.</p>`,
      { label: "Choose a new password", url },
    ),
  };
}

export function passwordChangedEmail(to: string, name: string): EmailMessage {
  return {
    to,
    subject: "Your Nexivora password was changed",
    // Sent after the fact and deliberately actionable: if this was not them,
    // this message is how they find out.
    text: `Hello ${name},\n\nYour password was just changed and every other signed-in device was signed out.\n\nIf that was not you, reset your password immediately: ${absoluteUrl("/forgot-password")}`,
    html: layout(
      "Your password was changed",
      `<p style="line-height:1.6">Hello ${name} — your password was just changed, and every other signed-in device was signed out.</p>
       <p style="line-height:1.6"><strong>If that was not you</strong>, reset your password immediately.</p>`,
      { label: "Reset my password", url: absoluteUrl("/forgot-password") },
    ),
  };
}

export function accountLockedEmail(to: string, name: string, minutes: number): EmailMessage {
  return {
    to,
    subject: "Unusual sign-in attempts on your Nexivora account",
    text: `Hello ${name},\n\nThere have been repeated failed sign-in attempts on your account, so it is locked for ${minutes} minutes.\n\nIf that was you and you have forgotten your password, reset it: ${absoluteUrl("/forgot-password")}`,
    html: layout(
      "Repeated failed sign-in attempts",
      `<p style="line-height:1.6">Hello ${name} — there have been repeated failed sign-in attempts on your account, so it is locked for ${minutes} minutes.</p>
       <p style="line-height:1.6">If that was you and you have forgotten your password, reset it instead.</p>`,
      { label: "Reset my password", url: absoluteUrl("/forgot-password") },
    ),
  };
}

export function invitationEmail(
  to: string,
  collegeName: string,
  inviterName: string,
  code: string,
): EmailMessage {
  const url = absoluteUrl(`/register?invite=${code}`);

  return {
    to,
    subject: `${inviterName} invited you to ${collegeName} on Nexivora`,
    text: `${inviterName} has invited you to join ${collegeName} on Nexivora.\n\nAccept the invitation:\n\n${url}`,
    html: layout(
      `${inviterName} invited you to ${collegeName}`,
      `<p style="line-height:1.6">Nexivora is where ${collegeName} keeps its project work — the archive, the teams and the record of who built what.</p>`,
      { label: "Accept the invitation", url },
    ),
  };
}
