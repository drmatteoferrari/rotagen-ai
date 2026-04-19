import { Resend } from "https://esm.sh/resend@4.6.0";

const ALLOWED_ORIGINS = [
  "https://rotagen.co.uk",
  "https://rotagen-ai.lovable.app",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("RESEND_API_KEY not configured");

    const resend = new Resend(apiKey);
    const { to, fullName, email, username, tempPassword, hospital, department } = await req.json();

    if (!to || !fullName || !email || !tempPassword) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const subject = `Welcome to RotaGen — your login details`;

    const orgLine = (department || hospital)
      ? `<br/>${escHtml(department || "")}${department && hospital ? " · " : ""}${escHtml(hospital || "")}`
      : "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Welcome to RotaGen</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<tr><td style="padding-bottom:24px;text-align:center;">
<p style="font-size:20px;font-weight:bold;color:#2563EB;margin:0 0 4px;">RotaGen</p>
<p style="font-size:12px;color:#666;margin:0;">NHS Rota Management</p>
</td></tr>

<tr><td style="padding-bottom:16px;">
<h1 style="font-size:22px;font-weight:bold;margin:0 0 16px;color:#1a1a1a;">Welcome to RotaGen</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${escHtml(fullName)},</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Your RotaGen account has been activated. Here are your login details:</p>
</td></tr>

<tr><td style="padding-bottom:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;border-radius:8px;">
<tr><td style="padding:20px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.8;width:100%;">
<tr><td style="color:#666;padding-right:16px;width:160px;">Login URL:</td><td style="font-weight:600;"><a href="https://rotagen.co.uk/login" style="color:#2563EB;text-decoration:none;">rotagen.co.uk/login</a></td></tr>
<tr><td style="color:#666;padding-right:16px;">Email:</td><td style="font-weight:600;font-family:monospace;">${escHtml(email)}</td></tr>
<tr><td style="color:#666;padding-right:16px;">Temporary password:</td><td style="font-weight:600;font-family:monospace;">${escHtml(tempPassword)}</td></tr>
${username ? `<tr><td style="color:#666;padding-right:16px;">Display name:</td><td style="font-weight:600;">${escHtml(username)}</td></tr>` : ""}
</table>
</td></tr>
</table>
</td></tr>

<tr><td style="padding-bottom:24px;">
<p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#374151;">You will be asked to set a new password the first time you log in. Use the email address and temporary password above to sign in — keep this email until you have done so.</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#374151;">Your first step is to complete your department setup — this takes around 10–15 minutes. A setup guide will appear automatically when you first sign in.</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#374151;">If you need any help, email <a href="mailto:support@rotagen.co.uk" style="color:#2563EB;text-decoration:none;">support@rotagen.co.uk</a>.</p>
<p style="font-size:15px;line-height:1.6;margin:24px 0 0;">The RotaGen team</p>
</td></tr>

<tr><td style="border-top:1px solid #e0e0e0;padding-top:20px;text-align:center;">
<p style="font-size:12px;color:#999;line-height:1.5;margin:0;"><strong>RotaGen</strong> · NHS Rota Management${orgLine}<br/>This is an automated message — please do not reply to this email.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const { error } = await resend.emails.send({
      from: "RotaGen <noreply@rotagen.co.uk>",
      to: [to],
      bcc: ["hello@rotagen.co.uk"],
      subject,
      html,
    });

    if (error) throw new Error(error.message);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
