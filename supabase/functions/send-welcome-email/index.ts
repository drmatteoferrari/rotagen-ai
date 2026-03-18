import { Resend } from "https://esm.sh/resend@4.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://rotagen-ai.lovable.app",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("RESEND_API_KEY not configured");

    const resend = new Resend(apiKey);
    const { to, fullName, email, tempPassword, hospital, department, jobTitle } = await req.json();

    if (!to || !fullName || !email || !tempPassword) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
<h2 style="color:#2563eb;margin-bottom:16px">New RotaGen Account Created</h2>
<p style="margin-bottom:8px;font-size:14px;color:#6b7280">A new coordinator account has been activated.</p>

<table style="width:100%;border-collapse:collapse;margin-bottom:24px">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;width:180px">Name:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escHtml(fullName)}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Email:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:monospace">${escHtml(email)}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Hospital:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escHtml(hospital) || "—"}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Department:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escHtml(department) || "—"}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Job title:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${escHtml(jobTitle) || "—"}</td></tr>
</table>

<p style="font-size:13px;color:#b45309;background:#fef3c7;padding:12px;border-radius:6px;margin-bottom:24px">
<strong>Temporary password:</strong> <code style="font-family:monospace">${escHtml(tempPassword)}</code>
</p>

<p style="font-size:13px;color:#374151;margin-bottom:16px">
They can log in at <a href="https://rotagen-ai.lovable.app/login" style="color:#2563eb">rotagen-ai.lovable.app/login</a> and will be prompted to change their password on first login.
</p>

<p style="font-size:13px;color:#374151">Share these credentials with the new coordinator directly.</p>

<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
<p style="font-size:11px;color:#9ca3af;text-align:center">RotaGen · NHS Rota Management · For authorised users only</p>
</div>`;

    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: [to],
      subject: `New RotaGen account created — ${escHtml(fullName)}`,
      html,
    });

    if (error) throw new Error(error.message);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
