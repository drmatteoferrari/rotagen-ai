import { Resend } from "npm:resend";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing RESEND_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(apiKey);
    const { to, fullName, username } = await req.json();

    if (!to || !fullName || !username) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const temporaryPassword = username;

    const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
<h2 style="color:#2563eb;margin-bottom:16px">Your RotaGen account is ready</h2>
<p style="margin-bottom:8px;font-size:14px;color:#6b7280">Welcome to RotaGen — NHS Rota Management</p>
<p style="margin-bottom:16px">Dear ${fullName},</p>
<p style="margin-bottom:16px">Your account has been approved. Here are your login credentials:</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:24px">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;width:180px">Username:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:monospace">${username}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Temporary password:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:monospace">${temporaryPassword}</td></tr>
</table>
<p style="font-size:13px;color:#b45309;background:#fef3c7;padding:12px;border-radius:6px;margin-bottom:24px">⚠ You will be required to set a new password immediately on your first login.</p>
<div style="text-align:center;margin:24px 0">
  <a href="https://rotagen-ai.lovable.app/login" style="display:inline-block;padding:14px 32px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">Sign in to RotaGen</a>
</div>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
<p style="font-size:11px;color:#9ca3af;text-align:center">RotaGen · NHS Rota Management · For authorised users only</p>
</div>`;

    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: [to],
      subject: "Your RotaGen account is ready — action required",
      html,
    });

    if (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
