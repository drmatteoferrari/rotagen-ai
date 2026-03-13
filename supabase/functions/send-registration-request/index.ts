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
    const matteoEmail = Deno.env.get("MATTEO_EMAIL");

    if (!apiKey || !matteoEmail) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing RESEND_API_KEY or MATTEO_EMAIL secret" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(apiKey);
    const { fullName, email, phone, jobTitle, hospital, department, heardFrom } = await req.json();

    if (!fullName || !email || !phone || !jobTitle || !hospital || !department) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subject = `RotaGen — New Access Request: ${fullName}, ${department}, ${hospital}`;

    const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
<h2 style="color:#2563eb;margin-bottom:16px">RotaGen — New Access Request</h2>
<p style="margin-bottom:16px">Someone has requested access to RotaGen. Review their details below.</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:24px">
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;width:140px">Full name:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${fullName}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Email:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${email}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Phone:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${phone}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Job title:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${jobTitle}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Hospital / Trust:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${hospital}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Department:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${department}</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600">Heard from:</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${heardFrom || '—'}</td></tr>
</table>
<p style="font-size:13px;color:#6b7280">To activate this account: go to the RotaGen Supabase dashboard → Table Editor → coordinator_accounts → insert a new row with their username, a temporary password, status = active.</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
<p style="font-size:11px;color:#9ca3af;text-align:center">RotaGen · NHS Rota Management · Automated notification</p>
</div>`;

    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: [matteoEmail],
      subject,
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
