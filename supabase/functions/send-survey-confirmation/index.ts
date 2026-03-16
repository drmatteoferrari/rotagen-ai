// ✅ Section 11 complete — send-survey-confirmation Edge Function

import { Resend } from "npm:resend";

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
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(apiKey);

    const {
      to,
      doctorName,
      submittedAt,
      departmentName,
      hospitalName,
      rotaStartDate,
      rotaEndDate,
      surveyDeadline,
      workingPattern,
      annualLeaveSummary,
      studyLeaveSummary,
      nocSummary,
      parentalLeave,
    } = await req.json();

    if (!to || !doctorName) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subject = `Your rota preferences have been submitted — ${escHtml(departmentName)}, ${rotaStartDate} to ${rotaEndDate}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Survey Confirmation</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<tr><td style="padding-bottom:24px;">
<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Dear ${escHtml(doctorName)},</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Your preference survey has been successfully submitted to RotaGen.</p>
</td></tr>

<tr><td style="padding-bottom:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;border-radius:8px;">
<tr><td style="padding:20px 24px;">
<p style="font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#666;margin:0 0 12px;">SUBMISSION SUMMARY</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.8;">
<tr><td style="color:#666;padding-right:16px;">Submitted:</td><td style="font-weight:600;">${escHtml(submittedAt)}</td></tr>
<tr><td style="color:#666;padding-right:16px;">Department:</td><td style="font-weight:600;">${escHtml(departmentName)}</td></tr>
<tr><td style="color:#666;padding-right:16px;">Hospital:</td><td style="font-weight:600;">${escHtml(hospitalName)}</td></tr>
<tr><td style="color:#666;padding-right:16px;">Rota period:</td><td style="font-weight:600;">${rotaStartDate} – ${rotaEndDate}</td></tr>
</table>
</td></tr>
</table>
</td></tr>

<tr><td style="padding-bottom:24px;">
<p style="font-size:14px;font-weight:bold;margin:0 0 12px;">YOUR KEY SUBMISSIONS:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:2;">
<tr><td style="color:#666;padding-right:16px;">Working pattern:</td><td>${escHtml(workingPattern)}</td></tr>
<tr><td style="color:#666;padding-right:16px;">Annual leave:</td><td>${escHtml(annualLeaveSummary)}</td></tr>
<tr><td style="color:#666;padding-right:16px;">Study leave:</td><td>${escHtml(studyLeaveSummary)}</td></tr>
<tr><td style="color:#666;padding-right:16px;">Prefer not on-call:</td><td>${escHtml(nocSummary)}</td></tr>
<tr><td style="color:#666;padding-right:16px;">Parental leave:</td><td>${escHtml(parentalLeave)}</td></tr>
</table>
</td></tr>

<tr><td style="border-top:1px solid #e0e0e0;padding-top:20px;padding-bottom:20px;">
<p style="font-size:13px;color:#666;line-height:1.6;margin:0 0 8px;">If anything above is incorrect, contact your rota coordinator as soon as possible — they can edit your responses before the survey deadline.</p>
<p style="font-size:13px;color:#666;line-height:1.6;margin:0;"><strong>Deadline:</strong> ${escHtml(surveyDeadline)}</p>
</td></tr>

<tr><td style="text-align:center;padding-top:16px;">
<p style="font-size:12px;color:#999;line-height:1.5;margin:0;"><strong>RotaGen</strong> · NHS Rota Management<br/>${escHtml(departmentName)} · ${escHtml(hospitalName)}<br/>This is an automated confirmation — do not reply to this email.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
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
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
