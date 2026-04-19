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
        JSON.stringify({ success: false, error: "Missing RESEND_API_KEY secret" }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(apiKey);
    const { fullName, email, phone, jobTitle, hospital, department, heardFrom, approvalToken } = await req.json();

    if (!fullName || !email || !approvalToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const approvalUrl = `https://rotagen.co.uk/approve?token=${approvalToken}`;

    const subject = `RotaGen — New Access Request: ${escHtml(fullName)}, ${escHtml(department)}, ${escHtml(hospital)}`;

    const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
<h2 style="color:#2563eb;margin-bottom:16px">RotaGen — New Access Request</h2>
<p style="margin-bottom:16px">Someone has requested access to RotaGen. Review their details below.</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:24px">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;width:140px">Full name:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escHtml(fullName)}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Email:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escHtml(email)}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Phone:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escHtml(phone) || "—"}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Job title:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escHtml(jobTitle) || "—"}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Hospital / Trust:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escHtml(hospital) || "—"}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Department:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escHtml(department) || "—"}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Heard from:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escHtml(heardFrom) || "—"}</td></tr>
</table>
<div style="text-align:center;margin:32px 0">
  <a href="${approvalUrl}" style="display:inline-block;padding:14px 32px;background-color:#16a34a;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">✓ Approve Access</a>
</div>
<p style="font-size:13px;color:#6b7280">Clicking this button will open the RotaGen approval page. You will be asked to confirm before the account is created.</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
<p style="font-size:11px;color:#9ca3af;text-align:center">RotaGen · NHS Rota Management · Automated notification</p>
</div>`;

    const { error } = await resend.emails.send({
      from: "RotaGen <noreply@rotagen.co.uk>",
      to: ["hello@rotagen.co.uk"],
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
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
