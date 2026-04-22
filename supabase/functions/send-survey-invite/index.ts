// SECTION 1 — Edge Function for sending survey invite emails via Resend
// IMPORTANT: Set RESEND_API_KEY in Supabase dashboard under:
//   Project Settings → Edge Functions → Secrets
// Or via Lovable Cloud → Backend → Secrets

import { Resend } from "npm:resend@4.6.0";

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

// SECTION 1 COMPLETE

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

    // SECTION 3 — Parse request body and send email
    const {
      to,
      doctorName,
      rotaPeriod,
      departmentName,
      hospitalName,
      surveyDeadline,
      surveyLink,
      isReminder,
      coordinatorEmail,
    } = await req.json();

    if (!to || !doctorName || !surveyLink) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: to, doctorName, surveyLink" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const subject = isReminder
      ? `Reminder: your rota survey is waiting — ${escHtml(departmentName)}, ${escHtml(hospitalName)}`
      : `Action required: Submit your rota preferences — ${escHtml(departmentName)}, ${escHtml(hospitalName)}, ${rotaPeriod.startDate} to ${rotaPeriod.endDate}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Survey Invite</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;">
<tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

<tr><td style="padding-bottom:24px;">
<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Dear ${escHtml(doctorName)},</p>
<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Your rota coordinator has opened the preference survey for the upcoming rota period at <strong>${escHtml(departmentName)}</strong>, <strong>${escHtml(hospitalName)}</strong>. Please complete your submission by the deadline below — the rota cannot be generated until all doctors have submitted.</p>
</td></tr>

<tr><td style="padding-bottom:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;border-radius:8px;">
<tr><td style="padding:20px 24px;">
<p style="font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#666;margin:0 0 12px;">Rota Period Details</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.8;">
<tr><td style="color:#666;padding-right:16px;">Department:</td><td style="font-weight:600;">${escHtml(departmentName)}</td></tr>
<tr><td style="color:#666;padding-right:16px;">Hospital:</td><td style="font-weight:600;">${escHtml(hospitalName)}</td></tr>
<tr><td style="color:#666;padding-right:16px;">Period:</td><td style="font-weight:600;">${rotaPeriod.startDate} – ${rotaPeriod.endDate}</td></tr>
<tr><td style="color:#666;padding-right:16px;">Duration:</td><td style="font-weight:600;">${rotaPeriod.durationWeeks} weeks</td></tr>
<tr><td style="color:#666;padding-right:16px;">Deadline:</td><td style="font-weight:600;color:#cc0000;">${escHtml(surveyDeadline)}</td></tr>
</table>
</td></tr>
</table>
</td></tr>

<tr><td style="padding-bottom:24px;">
<p style="font-size:14px;line-height:1.6;margin:0 0 8px;">In the survey you will be asked to provide:</p>
<ul style="font-size:14px;line-height:1.8;margin:0;padding-left:20px;">
<li>Your annual leave dates during this rota period</li>
<li>Any study leave or exam dates</li>
<li>Dates you would prefer not to be on-call</li>
<li>Your night shift flexibility around LTFT days (if applicable)</li>
<li>Any medical exemptions or special circumstances</li>
</ul>
<p style="font-size:14px;line-height:1.6;margin:16px 0 0;">This information is used to generate a fair, WTR-compliant rota that respects your requests as much as possible.</p>
</td></tr>

<tr><td align="center" style="padding-bottom:24px;">
<a href="${surveyLink}" style="display:inline-block;background-color:#0066FF;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 28px;border-radius:8px;">COMPLETE YOUR SURVEY →</a>
</td></tr>

<tr><td style="padding-bottom:24px;">
<p style="font-size:13px;color:#666;line-height:1.5;margin:0;">If the button above does not work, copy and paste this link into your browser:<br/>
<a href="${surveyLink}" style="color:#0066FF;word-break:break-all;">${surveyLink}</a></p>
</td></tr>

<tr><td style="border-top:1px solid #e0e0e0;padding-top:20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9f9f9;border-radius:8px;">
<tr><td style="padding:16px 20px;">
<p style="font-size:13px;color:#666;line-height:1.5;margin:0 0 8px;"><strong>Important:</strong> Please submit your preferences before <strong>${escHtml(surveyDeadline)}</strong>. Late submissions may not be accommodated.</p>
<p style="font-size:13px;color:#666;line-height:1.5;margin:0 0 8px;">If you have already submitted your preferences, you can safely ignore this email.</p>
<p style="font-size:13px;color:#666;line-height:1.5;margin:0;">If you believe you have received this in error, please contact your rota coordinator at ${escHtml(departmentName)}, ${escHtml(hospitalName)}.</p>
</td></tr>
</table>
</td></tr>

<tr><td style="padding-top:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f7ff;border-radius:8px;">
<tr><td style="padding:14px 18px;">
<p style="font-size:13px;color:#374151;line-height:1.6;margin:0;">Questions about the rota or your allocation? Contact your rota coordinator directly: ${
  coordinatorEmail
    ? `<a href="mailto:${escHtml(coordinatorEmail)}" style="color:#2563EB;text-decoration:none;">${escHtml(coordinatorEmail)}</a>`
    : `contact your department coordinator`
}.</p>
</td></tr>
</table>
</td></tr>

<tr><td style="padding-top:24px;text-align:center;">
<p style="font-size:12px;color:#999;line-height:1.5;margin:0;"><strong>RotaGen</strong> · NHS Rota Management<br/>${escHtml(departmentName)} · ${escHtml(hospitalName)}<br/>This survey link is unique to you — please do not share it. This is an automated message — do not reply to this email.</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

    const { error } = await resend.emails.send({
      from: "RotaGen <noreply@rotagen.co.uk>",
      replyTo: "support@rotagen.co.uk",
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
    // SECTION 3 COMPLETE
  } catch (err) {
    console.error("Edge function error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

// SECTION 2 — Survey link is constructed on the frontend as:
// `${import.meta.env.VITE_APP_URL ?? window.location.origin}/survey/doctor?id=${doctorId}`
// and passed to this function as `surveyLink` in the POST body.
// SECTION 2 COMPLETE
