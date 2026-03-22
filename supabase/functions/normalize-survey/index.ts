import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { doctor_id, rota_config_id } = await req.json();
    if (!doctor_id || !rota_config_id) {
      return new Response(
        JSON.stringify({ success: false, error: "doctor_id and rota_config_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // 1. Read the survey response row
    const { data: survey, error: fetchErr } = await sb
      .from("doctor_survey_responses")
      .select("*")
      .eq("doctor_id", doctor_id)
      .eq("rota_config_id", rota_config_id)
      .single();

    if (fetchErr || !survey) {
      return new Response(
        JSON.stringify({ success: false, error: "Survey response not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Delete existing normalized data for this doctor+config
    await Promise.all([
      sb.from("unavailability_blocks").delete().eq("doctor_id", doctor_id).eq("rota_config_id", rota_config_id),
      sb.from("ltft_patterns").delete().eq("doctor_id", doctor_id).eq("rota_config_id", rota_config_id),
      sb.from("training_requests").delete().eq("doctor_id", doctor_id).eq("rota_config_id", rota_config_id),
      sb.from("dual_specialties").delete().eq("doctor_id", doctor_id).eq("rota_config_id", rota_config_id),
    ]);

    // 3. Parse JSONB → insert into relational tables

    // --- Unavailability blocks ---
    const blocks: any[] = [];

    const annualLeave = Array.isArray(survey.annual_leave) ? survey.annual_leave : [];
    for (const e of annualLeave) {
      if (e.startDate && e.endDate) {
        blocks.push({
          doctor_id, rota_config_id,
          reason: "annual",
          start_date: e.startDate,
          end_date: e.endDate,
          notes: e.reason || null,
        });
      }
    }

    const studyLeave = Array.isArray(survey.study_leave) ? survey.study_leave : [];
    for (const e of studyLeave) {
      if (e.startDate && e.endDate) {
        blocks.push({
          doctor_id, rota_config_id,
          reason: "study",
          start_date: e.startDate,
          end_date: e.endDate,
          notes: e.reason || null,
        });
      }
    }

    const nocDates = Array.isArray(survey.noc_dates) ? survey.noc_dates : [];
    for (const e of nocDates) {
      if (e.startDate && e.endDate) {
        blocks.push({
          doctor_id, rota_config_id,
          reason: "noc",
          start_date: e.startDate,
          end_date: e.endDate,
          notes: e.reason || null,
        });
      }
    }

    const rotations = Array.isArray(survey.other_unavailability) ? survey.other_unavailability : [];
    for (const e of rotations) {
      if (e.startDate && e.endDate) {
        blocks.push({
          doctor_id, rota_config_id,
          reason: "rotation",
          start_date: e.startDate,
          end_date: e.endDate,
          notes: null,
          location: e.location || null,
        });
      }
    }

    // Parental leave
    if (survey.parental_leave_expected && survey.parental_leave_start && survey.parental_leave_end) {
      blocks.push({
        doctor_id, rota_config_id,
        reason: "parental",
        start_date: survey.parental_leave_start,
        end_date: survey.parental_leave_end,
        notes: survey.parental_leave_notes || null,
      });
    }

    if (blocks.length > 0) {
      const { error: blockErr } = await sb.from("unavailability_blocks").insert(blocks);
      if (blockErr) console.error("unavailability_blocks insert error:", blockErr);
    }

    // --- LTFT patterns ---
    const ltftDaysOff: string[] = Array.isArray(survey.ltft_days_off) ? survey.ltft_days_off : [];
    const ltftFlex: any[] = Array.isArray(survey.ltft_night_flexibility) ? survey.ltft_night_flexibility : [];

    if (ltftDaysOff.length > 0 && !ltftDaysOff.includes("flexible")) {
      const patterns = ltftDaysOff.map((day: string) => {
        const flex = ltftFlex.find((f: any) => f.day === day);
        return {
          doctor_id, rota_config_id,
          day: day.toLowerCase(),
          is_day_off: true,
          can_start_nights: flex?.canStart ?? null,
          can_end_nights: flex?.canEnd ?? null,
        };
      });

      if (patterns.length > 0) {
        const { error: ltftErr } = await sb.from("ltft_patterns").insert(patterns);
        if (ltftErr) console.error("ltft_patterns insert error:", ltftErr);
      }
    }

    // --- Training requests ---
    const requests: any[] = [];

    const specialties = Array.isArray(survey.specialties_requested) ? survey.specialties_requested : [];
    for (const s of specialties) {
      const name = typeof s === "string" ? s : s?.name;
      const notes = typeof s === "string" ? null : s?.notes || null;
      if (name) requests.push({ doctor_id, rota_config_id, category: "specialty", name, notes });
    }

    const sessions: string[] = Array.isArray(survey.special_sessions) ? survey.special_sessions : [];
    for (const s of sessions) {
      // Deserialise "Name: Notes" format
      const colonIdx = s.indexOf(": ");
      const name = colonIdx === -1 ? s : s.slice(0, colonIdx);
      const notes = colonIdx === -1 ? null : s.slice(colonIdx + 2);
      if (name) requests.push({ doctor_id, rota_config_id, category: "session", name, notes });
    }

    const interests = Array.isArray(survey.other_interests) ? survey.other_interests : [];
    for (const i of interests) {
      const name = typeof i === "string" ? i : i?.name;
      const notes = typeof i === "string" ? null : i?.notes || null;
      if (name) requests.push({ doctor_id, rota_config_id, category: "interest", name, notes });
    }

    if (requests.length > 0) {
      const { error: reqErr } = await sb.from("training_requests").insert(requests);
      if (reqErr) console.error("training_requests insert error:", reqErr);
    }

    // --- Dual specialties ---
    const dualTypes: string[] = Array.isArray(survey.dual_specialty_types) ? survey.dual_specialty_types : [];
    if (dualTypes.length > 0) {
      const dualRows = dualTypes.map((name: string) => ({ doctor_id, rota_config_id, specialty_name: name }));
      const { error: dualErr } = await sb.from("dual_specialties").insert(dualRows);
      if (dualErr) console.error("dual_specialties insert error:", dualErr);
    }

    // 4. Flatten competencies_json → update flat boolean columns
    const cj = survey.competencies_json || {};
    const { error: compErr } = await sb
      .from("doctor_survey_responses")
      .update({
        iac_achieved: cj.iac?.achieved ?? null,
        iac_working: cj.iac?.workingTowards ?? null,
        iac_remote: cj.iac?.remoteSupervision ?? null,
        iaoc_achieved: cj.iaoc?.achieved ?? null,
        iaoc_working: cj.iaoc?.workingTowards ?? null,
        iaoc_remote: cj.iaoc?.remoteSupervision ?? null,
        icu_achieved: cj.icu?.achieved ?? null,
        icu_working: cj.icu?.workingTowards ?? null,
        icu_remote: cj.icu?.remoteSupervision ?? null,
        transfer_achieved: cj.transfer?.achieved ?? null,
        transfer_working: cj.transfer?.workingTowards ?? null,
        transfer_remote: cj.transfer?.remoteSupervision ?? null,
      })
      .eq("doctor_id", doctor_id)
      .eq("rota_config_id", rota_config_id);

    if (compErr) console.error("competency flatten error:", compErr);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("normalize-survey error:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
