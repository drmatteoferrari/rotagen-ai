import { runPreRotaValidation, type ValidationDoctor } from "./preRotaValidation";
import { buildPreRotaInput } from "./rotaGenInput";
import { buildCalendarData } from "./preRotaCalendar";
import { buildTargetsData } from "./preRotaTargets";
import { rebuildResolvedAvailability } from "./resolvedAvailability";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { PreRotaResult, PreRotaStatus } from "./preRotaTypes";

export async function generatePreRota(
  rotaConfigId: string,
  generatedBy: string,
): Promise<{ success: boolean; result?: PreRotaResult; error?: string }> {
  try {
    // ── 1. Fetch rota config (raw — needed for WTR, targets, calendar) ──
    const { data: config, error: configErr } = await supabase
      .from("rota_configs")
      .select("*")
      .eq("id", rotaConfigId)
      .single();
    if (configErr || !config) {
      return { success: false, error: "Rota config not found." };
    }

    // ── 2. Fetch WTR settings ──────────────────────────────────────────
    const { data: wtr } = await supabase.from("wtr_settings").select("*").eq("rota_config_id", rotaConfigId).single();
    if (!wtr) {
      return { success: false, error: "WTR settings not found. Complete WTR setup first." };
    }

    // ── 3. Fetch raw shift types (needed for buildTargetsData shape) ───
    // Also used as a guard — if no shifts defined, fail early before
    // hitting the DB for doctors and survey data.
    const { data: rawShiftTypes } = await supabase
      .from("shift_types")
      .select("*")
      .eq("rota_config_id", rotaConfigId)
      .order("sort_order", { ascending: true });
    if (!rawShiftTypes?.length) {
      return { success: false, error: "No shift types defined. Complete department setup first." };
    }

    // ── 4. Fetch bank holidays ─────────────────────────────────────────
    const { data: bhRows } = await supabase
      .from("bank_holidays")
      .select("date, is_active")
      .eq("rota_config_id", rotaConfigId);
    const bankHolidays: string[] = (bhRows ?? [])
      .filter((r: any) => r.is_active !== false)
      .map((r: any) => r.date as string);

    // ── 5. Fetch active doctors ────────────────────────────────────────
    const { data: doctors } = await supabase
      .from("doctors")
      .select("*")
      .eq("rota_config_id", rotaConfigId)
      .eq("is_active", true);
    if (!doctors?.length) {
      return { success: false, error: "No doctors in roster." };
    }

    // ── 6. Fetch survey responses ──────────────────────────────────────
    const { data: surveyResponses } = await supabase
      .from("doctor_survey_responses")
      .select("*")
      .eq("rota_config_id", rotaConfigId);

    // ── 7. Fetch relational availability data (parallel) ──────────────
    const [{ data: unavailabilityBlocks }, { data: ltftPatterns }] = await Promise.all([
      supabase.from("unavailability_blocks").select("*").eq("rota_config_id", rotaConfigId),
      supabase.from("ltft_patterns").select("*").eq("rota_config_id", rotaConfigId),
    ]);

    // ── 8. Fetch account settings (for display names in calendar) ──────
    const { data: accountSettings } = await supabase
      .from("account_settings")
      .select("department_name, trust_name")
      .eq("owned_by", config.owned_by)
      .maybeSingle();

    // ── 9. Build per-day shift slots via buildPreRotaInput ─────────────
    // This handles both the new path (shift_day_slots exist) and the
    // fallback path (no day slots yet — synthesise from shift_types defaults).
    // Returns ShiftSlotEntry[] — the shape ValidationInputs.shiftSlots expects.
    const preRotaInput = await buildPreRotaInput(rotaConfigId);
    const shiftSlots = preRotaInput.shiftSlots;

    // ── 10. Map doctors + surveys → ValidationDoctor[] ─────────────────
    const doctorsWithSurveys: ValidationDoctor[] = doctors.map((doctor: any) => {
      const survey = (surveyResponses ?? []).find((r: any) => r.doctor_id === doctor.id) ?? null;

      const doctorBlocks = (unavailabilityBlocks ?? []).filter((b: any) => b.doctor_id === doctor.id);
      const doctorLtft = (ltftPatterns ?? []).filter((p: any) => p.doctor_id === doctor.id);

      // ── Build leave arrays from unavailability_blocks ──
      const annualLeave = doctorBlocks
        .filter((b: any) => b.reason === "annual")
        .map((b: any) => ({ startDate: b.start_date as string, endDate: b.end_date as string }));
      const studyLeave = doctorBlocks
        .filter((b: any) => b.reason === "study")
        .map((b: any) => ({ startDate: b.start_date as string, endDate: b.end_date as string }));
      const nocDates = doctorBlocks
        .filter((b: any) => b.reason === "noc")
        .map((b: any) => ({ startDate: b.start_date as string, endDate: b.end_date as string }));
      const rotations = doctorBlocks
        .filter((b: any) => b.reason === "rotation")
        .map((b: any) => ({
          startDate: b.start_date as string,
          endDate: b.end_date as string,
          location: (b.location as string) || "",
        }));

      // ── Parental leave from unavailability_blocks ──
      const parentalBlock = doctorBlocks.find((b: any) => b.reason === "parental");
      const parentalLeaveExpected = !!parentalBlock;
      const parentalLeaveStart = (parentalBlock?.start_date as string | null) ?? null;
      const parentalLeaveEnd = (parentalBlock?.end_date as string | null) ?? null;

      // ── LTFT from ltft_patterns ──
      const ltftDaysOff = doctorLtft.filter((p: any) => p.is_day_off).map((p: any) => p.day as string);
      const ltftNightFlex = doctorLtft
        .filter((p: any) => p.is_day_off)
        .map((p: any) => ({
          day: p.day as string,
          canStart: (p.can_start_nights as boolean | null) ?? null,
          canEnd: (p.can_end_nights as boolean | null) ?? null,
        }));

      // ── Competencies: flat booleans first, JSONB fallback ──
      // Flat columns are populated by handle_survey_normalization RPC on submit.
      // JSONB fallback covers in-progress / un-normalised surveys.
      const hasFlat =
        (survey?.iac_achieved !== null && survey?.iac_achieved !== undefined) ||
        (survey?.iaoc_achieved !== null && survey?.iaoc_achieved !== undefined) ||
        (survey?.icu_achieved !== null && survey?.icu_achieved !== undefined) ||
        (survey?.transfer_achieved !== null && survey?.transfer_achieved !== undefined);

      const competencies = hasFlat
        ? {
            iacAchieved: (survey?.iac_achieved as boolean | null) ?? null,
            iaocAchieved: (survey?.iaoc_achieved as boolean | null) ?? null,
            icuAchieved: (survey?.icu_achieved as boolean | null) ?? null,
            transferAchieved: (survey?.transfer_achieved as boolean | null) ?? null,
          }
        : (() => {
            const cj = (survey?.competencies_json ?? {}) as Record<string, any>;
            return {
              iacAchieved: (cj?.iac?.achieved as boolean | null) ?? null,
              iaocAchieved: (cj?.iaoc?.achieved as boolean | null) ?? null,
              icuAchieved: (cj?.icu?.achieved as boolean | null) ?? null,
              transferAchieved: (cj?.transfer?.achieved as boolean | null) ?? null,
            };
          })();

      // ── Decide whether to use relational or JSONB fallback data ──
      // hasNormalized = true when the doctor has submitted and data has been
      // written to relational tables by handle_survey_normalization.
      const hasNormalized = doctorBlocks.length > 0 || doctorLtft.length > 0 || doctor.survey_status === "submitted";

      const fallbackAL = hasNormalized
        ? annualLeave
        : ((Array.isArray(survey?.annual_leave) ? survey.annual_leave : []) as {
            startDate: string;
            endDate: string;
          }[]);

      const fallbackSL = hasNormalized
        ? studyLeave
        : ((Array.isArray(survey?.study_leave) ? survey.study_leave : []) as { startDate: string; endDate: string }[]);

      const fallbackNOC = hasNormalized
        ? nocDates
        : ((Array.isArray(survey?.noc_dates) ? survey.noc_dates : []) as { startDate: string; endDate: string }[]);

      const fallbackRot = hasNormalized
        ? rotations
        : ((Array.isArray(survey?.other_unavailability) ? survey.other_unavailability : []) as {
            startDate: string;
            endDate: string;
            location: string;
          }[]);

      const fallbackLtftDays = hasNormalized
        ? ltftDaysOff
        : ((Array.isArray(survey?.ltft_days_off) ? survey.ltft_days_off : []) as string[]);

      const fallbackLtftFlex = hasNormalized
        ? ltftNightFlex
        : ((Array.isArray(survey?.ltft_night_flexibility) ? survey.ltft_night_flexibility : []) as {
            day: string;
            canStart: boolean | null;
            canEnd: boolean | null;
          }[]);

      const fallbackParentalExpected = hasNormalized
        ? parentalLeaveExpected
        : (survey?.parental_leave_expected ?? false);
      const fallbackParentalStart = hasNormalized
        ? parentalLeaveStart
        : ((survey?.parental_leave_start as string | null) ?? null);
      const fallbackParentalEnd = hasNormalized
        ? parentalLeaveEnd
        : ((survey?.parental_leave_end as string | null) ?? null);

      // ── Return ValidationDoctor ──
      return {
        id: doctor.id as string,
        firstName: doctor.first_name as string,
        lastName: doctor.last_name as string,
        grade: (survey?.grade ?? doctor.grade ?? null) as string | null,
        surveyStatus: (doctor.survey_status ?? "not_started") as string,
        survey: survey
          ? {
              wtePercent: Number(survey.wte_percent ?? 100),
              annualLeave: fallbackAL,
              studyLeave: fallbackSL,
              nocDates: fallbackNOC,
              rotations: fallbackRot,
              ltftDaysOff: fallbackLtftDays,
              ltftNightFlexibility: fallbackLtftFlex,
              alEntitlement: (survey.al_entitlement as number | null) ?? null,
              parentalLeaveExpected: fallbackParentalExpected,
              parentalLeaveStart: fallbackParentalStart,
              parentalLeaveEnd: fallbackParentalEnd,
              competencies,
            }
          : null,
      };
    });

    // ── 11. Run validation ─────────────────────────────────────────────
    const validationIssues = runPreRotaValidation({
      rotaConfig: {
        startDate: config.rota_start_date as string,
        endDate: config.rota_end_date as string,
        durationWeeks: Number(config.rota_duration_weeks ?? 0),
        globalOncallPct: Number(config.global_oncall_pct ?? 50),
        globalNonOncallPct: Number(config.global_non_oncall_pct ?? 50),
        surveyDeadline: (config.survey_deadline as string | null) ?? null,
      },
      shiftSlots, // ← new: ShiftSlotEntry[] from buildPreRotaInput
      doctors: doctorsWithSurveys,
      bankHolidays,
    });

    const hasCritical = validationIssues.some((i) => i.severity === "critical");
    const hasWarning = validationIssues.some((i) => i.severity === "warning");
    const status: PreRotaStatus = hasCritical ? "blocked" : hasWarning ? "complete_with_warnings" : "complete";

    // ── 12. If blocked: save issues only and return early ──────────────
    if (hasCritical) {
      const { data: saved } = await supabase
        .from("pre_rota_results")
        .upsert(
          [
            {
              rota_config_id: rotaConfigId,
              generated_at: new Date().toISOString(),
              generated_by: generatedBy,
              status: "blocked",
              validation_issues: validationIssues as unknown as Json,
              calendar_data: {} as Json,
              targets_data: {} as Json,
            },
          ],
          { onConflict: "rota_config_id" },
        )
        .select()
        .single();

      return {
        success: true,
        result: {
          id: (saved as any)?.id ?? "",
          rotaConfigId,
          generatedAt: new Date().toISOString(),
          generatedBy,
          status: "blocked",
          validationIssues,
          calendarData: {} as any,
          targetsData: {} as any,
          isStale: false,
        },
      };
    }

    // ── 13. Build calendar data ────────────────────────────────────────
    const calendarData = buildCalendarData({
      rotaStartDate: config.rota_start_date as string,
      rotaEndDate: config.rota_end_date as string,
      rotaWeeks: Number(config.rota_duration_weeks ?? 0),
      departmentName: accountSettings?.department_name ?? (config.department_name as string) ?? "",
      hospitalName: accountSettings?.trust_name ?? (config.trust_name as string) ?? "",
      bankHolidays,
      doctors: doctorsWithSurveys.map((d) => ({
        id: d.id,
        firstName: d.firstName,
        lastName: d.lastName,
        grade: d.grade ?? "",
        wte: d.survey?.wtePercent ?? 100,
        survey: d.survey
          ? {
              ltftDaysOff: d.survey.ltftDaysOff,
              annualLeave: d.survey.annualLeave,
              studyLeave: d.survey.studyLeave,
              nocDates: d.survey.nocDates,
              rotations: d.survey.rotations,
              parentalLeaveExpected: d.survey.parentalLeaveExpected ?? false,
              parentalLeaveStart: d.survey.parentalLeaveStart ?? null,
              parentalLeaveEnd: d.survey.parentalLeaveEnd ?? null,
            }
          : null,
      })),
    });

    // ── 14. Build targets data ─────────────────────────────────────────
    // buildTargetsData still takes the flat shift types shape.
    // We map from rawShiftTypes which are already fetched in step 3.
    const targetsData = buildTargetsData({
      wtrMaxHoursPerWeek: Number(wtr.max_hours_per_week ?? 48),
      wtrMaxHoursPer168h: Number(wtr.max_hours_per_168h ?? 72),
      weekendFrequency: (wtr.weekend_frequency as number) ?? 3,
      rotaWeeks: Number(config.rota_duration_weeks ?? 0),
      globalOncallPct: Number(config.global_oncall_pct ?? 50),
      globalNonOncallPct: Number(config.global_non_oncall_pct ?? 50),
      shiftTypes: rawShiftTypes.map((s: any) => ({
        id: s.id as string,
        name: s.name as string,
        shiftKey: s.shift_key as string,
        isOncall: (s.is_oncall as boolean) ?? false,
        targetPercentage: Number(s.target_percentage ?? 0),
        durationHours: Number(s.duration_hours),
      })),
      doctors: doctorsWithSurveys.map((d) => ({
        id: d.id,
        firstName: d.firstName,
        lastName: d.lastName,
        grade: d.grade,
        wte: d.survey?.wtePercent ?? 100,
      })),
      calendarDoctors: calendarData.doctors,
    });

    // ── 15. Save to DB (UPSERT on rota_config_id) ──────────────────────
    const { data: saved } = await supabase
      .from("pre_rota_results")
      .upsert(
        [
          {
            rota_config_id: rotaConfigId,
            generated_at: new Date().toISOString(),
            generated_by: generatedBy,
            status,
            validation_issues: validationIssues as unknown as Json,
            calendar_data: calendarData as unknown as Json,
            targets_data: targetsData as unknown as Json,
          },
        ],
        { onConflict: "rota_config_id" },
      )
      .select()
      .single();

    // ── 16. Rebuild resolved_availability (non-fatal) ──────────────────
    // This populates the per-doctor per-date availability table used by
    // the pre-rota calendar. Failure here does not block the result.
    try {
      await rebuildResolvedAvailability(rotaConfigId, calendarData);
    } catch (err) {
      console.error("rebuildResolvedAvailability failed (non-fatal):", err);
    }

    return {
      success: true,
      result: {
        id: (saved as any)?.id ?? "",
        rotaConfigId,
        generatedAt: (saved as any)?.generated_at ?? new Date().toISOString(),
        generatedBy,
        status,
        validationIssues,
        calendarData,
        targetsData,
        isStale: false,
      },
    };
  } catch (err) {
    console.error("Pre-rota generation error:", err);
    return {
      success: false,
      error: "Unexpected error during generation. Check the browser console.",
    };
  }
}
