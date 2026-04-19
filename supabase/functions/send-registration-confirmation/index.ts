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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(apiKey);
    const { to, firstName, email } = await req.json();

    if (!to || !firstName || !email) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: to, firstName, email" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const subject = `RotaGen — We've received your access request`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Request received</title>
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
<h1 style="font-size:22px;font-weight:bold;margin:0 0 16px;color:#1a1a1a;">Request received</h1>
<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${escHtml(firstName)},</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Thank you for requesting access to RotaGen. We have received your details and will review your request shortly.</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 16px;">You will hear back from us at <strong>${escHtml(email)}</strong> within 1–2 working days.</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 16px;">If you have any questions in the meantime, email <a href="mailto:hello@rotagen.co.uk" style="color:#2563EB;text-decoration:none;">hello@rotagen.co.uk</a>.</p>
<p style="font-size:15px;line-height:1.6;margin:24px 0 0;">The RotaGen team</p>
</td></tr>

<tr><td style="border-top:1px solid #e0e0e0;padding-top:20px;text-align:center;">
<p style="font-size:12px;color:#999;line-height:1.5;margin:0;"><strong>RotaGen</strong> · NHS Rota Management<br/>This is an automated message — please do not reply to this email.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const { error } = await resend.emails.send({
      from: "RotaGen <noreply@rotagen.co.uk>",
      to: [to],
      subject,
      html,
    });

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
