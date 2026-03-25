// IMPORTANT: JWT verification must be disabled for this function.
// After deploying, go to Lovable Cloud → Backend → Functions → send-feedback-notification → disable JWT verification.
// This function is called from a public page with no coordinator session. The supabasePublic client
// sends the anon key as apikey header but no Authorization bearer — JWT must be off for this to work.

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

function stars(n: number): string {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) throw new Error("RESEND_API_KEY not configured");

    const resend = new Resend(apiKey);
    const { feedback } = await req.json();

    if (!feedback) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing feedback payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rows: string[] = [];
    const addRow = (label: string, value: string | null | undefined) => {
      if (value == null || value === "") return;
      rows.push(
        `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-weight:600;width:200px">${escHtml(label)}</td><td style="padding:8px;border-bottom:1px solid #e5e7eb">${value}</td></tr>`
      );
    };

    if (feedback.rating_overall) addRow("Overall experience", `${stars(feedback.rating_overall)} (${feedback.rating_overall}/5)`);
    if (feedback.rating_clarity) addRow("Clarity", `${stars(feedback.rating_clarity)} (${feedback.rating_clarity}/5)`);
    if (feedback.rating_ui) addRow("Visual design", `${stars(feedback.rating_ui)} (${feedback.rating_ui}/5)`);
    if (feedback.rating_speed) addRow("Speed", `${stars(feedback.rating_speed)} (${feedback.rating_speed}/5)`);
    if (feedback.quicker_than_before) addRow("Quicker than before?", escHtml(feedback.quicker_than_before));
    if (feedback.previous_method) addRow("Previous method", escHtml(feedback.previous_method));
    if (feedback.more_accurate) addRow("More accurate?", escHtml(feedback.more_accurate));
    if (feedback.rota_creators && feedback.rota_creators.length > 0) addRow("Rota creators", escHtml(feedback.rota_creators.join(", ")));
    if (feedback.improvements) addRow("Improvements", escHtml(feedback.improvements));
    if (feedback.bugs) addRow("Bugs", escHtml(feedback.bugs));
    if (feedback.comment) addRow("Comment", escHtml(feedback.comment));
    if (feedback.responder_name) addRow("Name", escHtml(feedback.responder_name));
    if (feedback.responder_email) addRow("Email", escHtml(feedback.responder_email));
    if (feedback.responder_trust) addRow("Trust / Hospital", escHtml(feedback.responder_trust));
    if (feedback.happy_to_contact != null) addRow("Happy to contact?", feedback.happy_to_contact ? "Yes" : "No");
    if (feedback.contact_method) addRow("Contact method", escHtml(feedback.contact_method));

    const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
<h2 style="color:#2563eb;margin-bottom:16px">New RotaGen Feedback</h2>
<p style="margin-bottom:8px;font-size:14px;color:#6b7280">A new feedback submission has been received.</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:24px">
${rows.join("\n")}
</table>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
<p style="font-size:11px;color:#9ca3af;text-align:center">RotaGen · NHS Rota Management</p>
</div>`;

    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: ["matteferro31@gmail.com"],
      subject: "RotaGen — New Feedback Submitted",
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
