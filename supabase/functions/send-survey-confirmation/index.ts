import { Resend } from "https://esm.sh/resend@4.6.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function fmtRange(start: string | undefined, end: string | undefined): string {
  if (!start) return "—";
  if (!end || end === start) return fmtDate(start);
  return `${fmtDate(start)} → ${fmtDate(end)}`;
}

function renderLeaveRows(entries: any[], showReason = false): string {
  if (!entries || entries.length === 0) {
    return `<p style="font-size:14px;color:#999;margin:0 0 8px;font-style:italic;">None entered</p>`;
  }
  return entries
    .map((e) => {
      const range = fmtRange(e.startDate ?? e.start_date, e.endDate ?? e.end_date);
      const extra = showReason && e.reason ? ` <span style="color:#666;">(${escHtml(e.reason)})</span>` : "";
      return `<p style="font-size:14px;color:#1a1a1a;margin:0 0 4px;">· ${escHtml(range)}${extra}</p>`;
    })
    .join("");
}

function renderNocRows(entries: any[]): string {
  if (!entries || entries.length === 0) {
    return `<p style="font-size:14px;color:#999;margin:0 0 8px;font-style:italic;">None entered</p>`;
  }
  return entries
    .map((e) => {
      const start = e.startDate ?? e.start_date;
      const end = e.endDate ?? e.end_date;
      const label = (!end || end === start) ? fmtDate(start) : fmtRange(start, end);
      return `<p style="font-size:14px;color:#1a1a1a;margin:0 0 4px;">· ${escHtml(label)}</p>`;
    })
    .join("");
}

function sectionHeader(title: string): string {
  return `<p style="font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#666;margin:16px 0 8px;">${escHtml(title)}</p>`;
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

    const {
      to,
      doctorName,
      doctorId,
      surveyLink,
      submittedAt,
      departmentName,
      hospitalName,
      rotaStartDate,
      rotaEndDate,
      surveyDeadline,
      workingPattern,
      annualLeave,
      studyLeave,
      nocDates,
      rotations,
      parentalLeaveExpected,
      parentalLeaveStart,
      parentalLeaveEnd,
      parentalLeaveNotes,
      exemptFromNights,
      exemptFromWeekends,
      exemptFromOncall,
      exemptionDetails,
      otherSchedulingRestrictions,
      additionalNotes,
    } = await req.json();

    if (!to || !doctorName) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields: to, doctorName" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Look up coordinator email server-side using service role key
    let coordinatorEmail: string | null = null;
    if (doctorId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        const { data: doctorRow } = await supabaseAdmin
          .from("doctors")
          .select("rota_config_id")
          .eq("id", doctorId)
          .maybeSingle();

        if (doctorRow?.rota_config_id) {
          const { data: configRow } = await supabaseAdmin
            .from("rota_configs")
            .select("owned_by, contact_email")
            .eq("id", doctorRow.rota_config_id)
            .maybeSingle();

          if (configRow?.contact_email) {
            coordinatorEmail = configRow.contact_email;
          } else if (configRow?.owned_by) {
            const { data: userResult } = await supabaseAdmin.auth.admin.getUserById(configRow.owned_by);
            coordinatorEmail = userResult?.user?.email ?? null;
          }
        }
      } catch (lookupErr) {
        console.error("Coordinator email lookup failed (non-blocking):", lookupErr);
      }
    }

    // Build exemptions list
    const exemptions: string[] = [];
    if (exemptFromNights) exemptions.push("nights");
    if (exemptFromWeekends) exemptions.push("weekends");
    if (exemptFromOncall) exemptions.push("on-call");

    const subject = `Your rota preferences have been submitted — ${escHtml(departmentName)}, ${fmtDate(rotaStartDate)} to ${fmtDate(rotaEndDate)}`;

    const rotationsBlock = (rotations && rotations.length > 0)
      ? `${sectionHeader("Other unavailability / rotations")}${rotations
          .map((r: any) => {
            const range = fmtRange(r.startDate ?? r.start_date, r.endDate ?? r.end_date);
            const loc = r.location ? ` <span style="color:#666;">(${escHtml(r.location)})</span>` : "";
            return `<p style="font-size:14px;color:#1a1a1a;margin:0 0 4px;">· ${escHtml(range)}${loc}</p>`;
          })
          .join("")}`
      : "";

    const parentalBlock = parentalLeaveExpected
      ? `<p style="font-size:14px;color:#1a1a1a;margin:0 0 4px;">${escHtml(fmtRange(parentalLeaveStart, parentalLeaveEnd))}${parentalLeaveNotes ? ` — ${escHtml(parentalLeaveNotes)}` : ""}</p>`
      : `<p style="font-size:14px;color:#999;margin:0 0 4px;font-style:italic;">None</p>`;

    const exemptionsBlock = exemptions.length > 0
      ? `<p style="font-size:14px;color:#1a1a1a;margin:0 0 4px;">Exempt from: <strong>${exemptions.join(", ")}</strong>${exemptionDetails ? `<br/><span style="color:#666;">${escHtml(exemptionDetails)}</span>` : ""}</p>`
      : `<p style="font-size:14px;color:#999;margin:0 0 4px;font-style:italic;">None</p>`;

    const otherRestrictionsBlock = otherSchedulingRestrictions
      ? `${sectionHeader("Other scheduling restrictions")}<p style="font-size:14px;color:#1a1a1a;margin:0 0 4px;">${escHtml(otherSchedulingRestrictions)}</p>`
      : "";

    const additionalNotesBlock = additionalNotes
      ? `${sectionHeader("Additional notes")}<p style="font-size:14px;color:#1a1a1a;margin:0 0 4px;">${escHtml(additionalNotes)}</p>`
      : "";

    const surveyLinkBlock = surveyLink
      ? `<tr><td style="padding-top:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f7ff;border-radius:8px;">
<tr><td style="padding:18px 20px;">
<p style="font-size:14px;font-weight:bold;color:#1a1a1a;margin:0 0 8px;">View or edit your submission</p>
<p style="font-size:13px;color:#374151;line-height:1.6;margin:0 0 12px;">You can view your submission and make changes at any time before the deadline using your personal link below. After the deadline, contact your rota coordinator.</p>
<p style="margin:0;"><a href="${surveyLink}" style="color:#2563EB;text-decoration:none;font-weight:600;">View my submission →</a></p>
</td></tr>
</table>
</td></tr>`
      : "";

    const coordinatorBlock = coordinatorEmail
      ? `<p style="font-size:13px;color:#666;line-height:1.6;margin:0;">If anything above looks incorrect, contact your rota coordinator before the deadline: <a href="mailto:${escHtml(coordinatorEmail)}" style="color:#2563EB;text-decoration:none;">${escHtml(coordinatorEmail)}</a></p>`
      : `<p style="font-size:13px;color:#666;line-height:1.6;margin:0;">If anything above looks incorrect, contact your rota coordinator before the deadline.</p>`;

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

<tr><td style="padding-bottom:16px;text-align:center;">
<p style="font-size:20px;font-weight:bold;color:#2563EB;margin:0 0 4px;">RotaGen</p>
<p style="font-size:12px;color:#666;margin:0;">NHS Rota Management</p>
</td></tr>

<tr><td style="padding-bottom:16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5;border-radius:8px;border:1px solid #10b981;">
<tr><td style="padding:14px 18px;">
<p style="font-size:15px;font-weight:bold;color:#065f46;margin:0;">✓ Preferences submitted successfully</p>
</td></tr>
</table>
</td></tr>

<tr><td style="padding-bottom:16px;">
<p style="font-size:16px;line-height:1.6;margin:0 0 16px;">Hi ${escHtml(doctorName)},</p>
<p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Your rota preferences for <strong>${escHtml(departmentName)}</strong>, <strong>${escHtml(hospitalName)}</strong> have been received.</p>
</td></tr>

<tr><td style="padding-bottom:24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;border-radius:8px;">
<tr><td style="padding:20px 24px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.8;width:100%;">
<tr><td style="color:#666;padding-right:16px;width:130px;">Submitted:</td><td style="font-weight:600;">${escHtml(submittedAt)}</td></tr>
<tr><td style="color:#666;padding-right:16px;">Rota period:</td><td style="font-weight:600;">${fmtDate(rotaStartDate)} → ${fmtDate(rotaEndDate)}</td></tr>
<tr><td style="color:#666;padding-right:16px;">Deadline:</td><td style="font-weight:600;">${escHtml(surveyDeadline)}</td></tr>
</table>
</td></tr>
</table>
</td></tr>

<tr><td style="padding-bottom:8px;">
<h2 style="font-size:16px;font-weight:bold;margin:0 0 8px;color:#1a1a1a;">Summary of your submission</h2>
</td></tr>

<tr><td style="padding-bottom:16px;">
${sectionHeader("Working pattern")}
<p style="font-size:14px;color:#1a1a1a;margin:0 0 4px;">${escHtml(workingPattern ?? "Not specified")}</p>

${sectionHeader("Annual leave")}
${renderLeaveRows(annualLeave ?? [])}

${sectionHeader("Study leave")}
${renderLeaveRows(studyLeave ?? [], true)}

${sectionHeader("Prefer not on-call (NOC) dates")}
${renderNocRows(nocDates ?? [])}

${rotationsBlock}

${sectionHeader("Parental leave")}
${parentalBlock}

${sectionHeader("Exemptions")}
${exemptionsBlock}

${otherRestrictionsBlock}
${additionalNotesBlock}
</td></tr>

${surveyLinkBlock}

<tr><td style="padding-top:24px;">
${coordinatorBlock}
</td></tr>

<tr><td style="border-top:1px solid #e0e0e0;padding-top:20px;margin-top:24px;text-align:center;">
<p style="font-size:12px;color:#999;line-height:1.5;margin:20px 0 0;"><strong>RotaGen</strong> · NHS Rota Management<br/>${escHtml(departmentName)} · ${escHtml(hospitalName)}<br/>This is an automated message — please do not reply to this email.</p>
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
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
