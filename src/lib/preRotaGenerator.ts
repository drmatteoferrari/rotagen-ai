// ✅ Section 7 complete — refactored for relational tables

import { runPreRotaValidation } from './preRotaValidation'
import { buildCalendarData } from './preRotaCalendar'
import { buildTargetsData } from './preRotaTargets'
import { supabase } from '@/integrations/supabase/client'
import type { Json } from '@/integrations/supabase/types'
import type { PreRotaResult, PreRotaStatus } from './preRotaTypes'

export async function generatePreRota(
  rotaConfigId: string,
  generatedBy: string
): Promise<{ success: boolean; result?: PreRotaResult; error?: string }> {
  try {
    // 1. Fetch rota config
    const { data: config, error: configErr } = await supabase
      .from('rota_configs').select('*').eq('id', rotaConfigId).single()
    if (configErr || !config) return { success: false, error: 'Rota config not found.' }

    // 2. Fetch WTR settings
    const { data: wtr } = await supabase
      .from('wtr_settings').select('*').eq('rota_config_id', rotaConfigId).single()
    if (!wtr) return { success: false, error: 'WTR settings not found. Complete WTR setup first.' }

    // 3. Fetch shift types
    const { data: shiftTypes } = await supabase
      .from('shift_types').select('*').eq('rota_config_id', rotaConfigId)
    if (!shiftTypes?.length) return { success: false, error: 'No shift types defined.' }

    // 4. Fetch bank holidays
    const { data: bhRows } = await supabase
      .from('bank_holidays')
      .select('date, is_active')
      .eq('rota_config_id', rotaConfigId)
    const bankHolidays = (bhRows ?? [])
      .filter(r => r.is_active !== false)
      .map(r => r.date as string)

    // 5. Fetch doctors
    const { data: doctors } = await supabase
      .from('doctors').select('*').eq('rota_config_id', rotaConfigId)
    if (!doctors?.length) return { success: false, error: 'No doctors in roster.' }

    // 6. Fetch survey responses (scalar fields + flat competency bools)
    const { data: surveyResponses } = await supabase
      .from('doctor_survey_responses').select('*').eq('rota_config_id', rotaConfigId)

    // 7. Fetch relational data from normalized tables
    const [
      { data: unavailabilityBlocks },
      { data: ltftPatterns },
    ] = await Promise.all([
      supabase.from('unavailability_blocks').select('*').eq('rota_config_id', rotaConfigId),
      supabase.from('ltft_patterns').select('*').eq('rota_config_id', rotaConfigId),
    ])

    // 8. Fetch account settings
    const { data: accountSettings } = await supabase
      .from('account_settings').select('department_name, trust_name')
      .eq('owned_by', config.owned_by).maybeSingle()

    // 9. Map doctors + surveys using relational data
    const doctorsWithSurveys = doctors.map(doctor => {
      const survey = surveyResponses?.find(r => r.doctor_id === doctor.id) ?? null
      const doctorBlocks = (unavailabilityBlocks ?? []).filter(b => b.doctor_id === doctor.id)
      const doctorLtft = (ltftPatterns ?? []).filter(p => p.doctor_id === doctor.id)

      // Build leave arrays from unavailability_blocks
      const annualLeave = doctorBlocks
        .filter(b => b.reason === 'annual')
        .map(b => ({ startDate: b.start_date, endDate: b.end_date }))
      const studyLeave = doctorBlocks
        .filter(b => b.reason === 'study')
        .map(b => ({ startDate: b.start_date, endDate: b.end_date }))
      const nocDates = doctorBlocks
        .filter(b => b.reason === 'noc')
        .map(b => ({ startDate: b.start_date, endDate: b.end_date }))
      const rotations = doctorBlocks
        .filter(b => b.reason === 'rotation')
        .map(b => ({ startDate: b.start_date, endDate: b.end_date, location: b.location || '' }))

      // Parental leave from unavailability_blocks
      const parentalBlock = doctorBlocks.find(b => b.reason === 'parental')
      const parentalLeaveExpected = !!parentalBlock
      const parentalLeaveStart = parentalBlock?.start_date ?? null
      const parentalLeaveEnd = parentalBlock?.end_date ?? null

      // LTFT from ltft_patterns
      const ltftDaysOff = doctorLtft.filter(p => p.is_day_off).map(p => p.day)
      const ltftNightFlex = doctorLtft.filter(p => p.is_day_off).map(p => ({
        day: p.day,
        canStart: p.can_start_nights,
        canEnd: p.can_end_nights,
      }))

      // Competencies from flat boolean columns (fall back to JSONB for un-normalized data)
      const hasFlat = survey?.iac_achieved !== null || survey?.iaoc_achieved !== null ||
                      survey?.icu_achieved !== null || survey?.transfer_achieved !== null
      let competencies
      if (hasFlat) {
        competencies = {
          iacAchieved: survey?.iac_achieved ?? null,
          iaocAchieved: survey?.iaoc_achieved ?? null,
          icuAchieved: survey?.icu_achieved ?? null,
          transferAchieved: survey?.transfer_achieved ?? null,
        }
      } else {
        const compJson = survey?.competencies_json as Record<string, any> | null
        competencies = {
          iacAchieved: compJson?.iac?.achieved ?? null,
          iaocAchieved: compJson?.iaoc?.achieved ?? null,
          icuAchieved: compJson?.icu?.achieved ?? null,
          transferAchieved: compJson?.transfer?.achieved ?? null,
        }
      }

      // For survey status: if doctor has submitted AND has normalized data, use relational
      // Otherwise fall back to JSONB for draft/un-normalized surveys
      const hasNormalized = doctorBlocks.length > 0 || doctorLtft.length > 0 || doctor.survey_status === 'submitted'

      // Fall back to JSONB if not normalized yet
      const fallbackAL = hasNormalized ? annualLeave :
        (Array.isArray(survey?.annual_leave) ? survey.annual_leave : []) as { startDate: string; endDate: string }[]
      const fallbackSL = hasNormalized ? studyLeave :
        (Array.isArray(survey?.study_leave) ? survey.study_leave : []) as { startDate: string; endDate: string }[]
      const fallbackNOC = hasNormalized ? nocDates :
        (Array.isArray(survey?.noc_dates) ? survey.noc_dates : []) as { startDate: string; endDate: string }[]
      const fallbackRot = hasNormalized ? rotations :
        (Array.isArray(survey?.other_unavailability) ? survey.other_unavailability : []) as { startDate: string; endDate: string; location: string }[]
      const fallbackLtftDays = hasNormalized ? ltftDaysOff :
        (Array.isArray(survey?.ltft_days_off) ? survey.ltft_days_off : []) as string[]
      const fallbackLtftFlex = hasNormalized ? ltftNightFlex :
        (Array.isArray(survey?.ltft_night_flexibility) ? survey.ltft_night_flexibility : []) as { day: string; canStart: boolean | null; canEnd: boolean | null }[]
      const fallbackParentalExpected = hasNormalized ? parentalLeaveExpected : (survey?.parental_leave_expected ?? false)
      const fallbackParentalStart = hasNormalized ? parentalLeaveStart : (survey?.parental_leave_start ?? null)
      const fallbackParentalEnd = hasNormalized ? parentalLeaveEnd : (survey?.parental_leave_end ?? null)

      return {
        id: doctor.id,
        firstName: doctor.first_name,
        lastName: doctor.last_name,
        grade: survey?.grade ?? doctor.grade ?? '',
        surveyStatus: doctor.survey_status ?? 'not_started',
        wte: Number(survey?.wte_percent ?? 100),
        survey: survey ? {
          wtePercent: Number(survey.wte_percent ?? 100),
          ltftDaysOff: fallbackLtftDays,
          ltftNightFlexibility: fallbackLtftFlex,
          annualLeave: fallbackAL,
          studyLeave: fallbackSL,
          nocDates: fallbackNOC,
          rotations: fallbackRot,
          alEntitlement: survey.al_entitlement,
          parentalLeaveExpected: fallbackParentalExpected,
          parentalLeaveStart: fallbackParentalStart,
          parentalLeaveEnd: fallbackParentalEnd,
          competencies,
        } : null,
      }
    })

    // 10. Run validation
    const validationIssues = runPreRotaValidation({
      rotaConfig: {
        startDate: config.rota_start_date!,
        endDate: config.rota_end_date!,
        durationWeeks: Number(config.rota_duration_weeks ?? 0),
        globalOncallPct: Number(config.global_oncall_pct ?? 50),
        globalNonOncallPct: Number(config.global_non_oncall_pct ?? 50),
        surveyDeadline: config.survey_deadline ?? null,
      },
      shiftTypes: shiftTypes.map(s => ({
        id: s.id, name: s.name,
        reqIac: s.req_iac ?? 0, reqIaoc: s.req_iaoc ?? 0, reqIcu: s.req_icu ?? 0,
        reqTransfer: s.req_transfer ?? 0, reqMinGrade: s.req_min_grade ?? null, minDoctors: s.min_doctors ?? 1,
      })),
      doctors: doctorsWithSurveys,
      bankHolidays,
    })

    const hasCritical = validationIssues.some(i => i.severity === 'critical')
    const hasWarning  = validationIssues.some(i => i.severity === 'warning')
    const status: PreRotaStatus = hasCritical ? 'blocked' : hasWarning ? 'complete_with_warnings' : 'complete'

    // 11. If blocked: save issues only, return early
    if (hasCritical) {
      const { data: saved } = await supabase.from('pre_rota_results').upsert([{
        rota_config_id: rotaConfigId,
        generated_at: new Date().toISOString(),
        generated_by: generatedBy,
        status: 'blocked',
        validation_issues: validationIssues as unknown as Json,
        calendar_data: {} as Json,
        targets_data: {} as Json,
      }], { onConflict: 'rota_config_id' }).select().single()

      return {
        success: true,
        result: {
          id: (saved as any)?.id ?? '',
          rotaConfigId,
          generatedAt: new Date().toISOString(),
          generatedBy, status: 'blocked',
          validationIssues,
          calendarData: {} as any,
          targetsData: {} as any,
          isStale: false,
        },
      }
    }

    // 12. Build calendar and targets
    const calendarData = buildCalendarData({
      rotaStartDate: config.rota_start_date!,
      rotaEndDate: config.rota_end_date!,
      rotaWeeks: Number(config.rota_duration_weeks ?? 0),
      departmentName: accountSettings?.department_name ?? config.department_name ?? '',
      hospitalName: accountSettings?.trust_name ?? config.trust_name ?? '',
      bankHolidays,
      doctors: doctorsWithSurveys,
    })

    const targetsData = buildTargetsData({
      wtrMaxHoursPerWeek: Number(wtr.max_hours_per_week ?? 48),
      wtrMaxHoursPer168h: Number(wtr.max_hours_per_168h ?? 72),
      weekendFrequency: wtr.weekend_frequency ?? 3,
      rotaWeeks: Number(config.rota_duration_weeks ?? 0),
      globalOncallPct: Number(config.global_oncall_pct ?? 50),
      globalNonOncallPct: Number(config.global_non_oncall_pct ?? 50),
      shiftTypes: shiftTypes.map(s => ({
        id: s.id, name: s.name, shiftKey: s.shift_key,
        isOncall: s.is_oncall ?? false,
        targetPercentage: Number(s.target_percentage ?? 0),
        durationHours: Number(s.duration_hours),
      })),
      doctors: doctorsWithSurveys.map(d => ({
        id: d.id, firstName: d.firstName, lastName: d.lastName,
        grade: d.grade, wte: d.wte,
      })),
    })

    // 13. Save to DB (UPSERT)
    const { data: saved } = await supabase
      .from('pre_rota_results')
      .upsert([{
        rota_config_id: rotaConfigId,
        generated_at: new Date().toISOString(),
        generated_by: generatedBy,
        status,
        validation_issues: validationIssues as unknown as Json,
        calendar_data: calendarData as unknown as Json,
        targets_data: targetsData as unknown as Json,
      }], { onConflict: 'rota_config_id' })
      .select().single()

    return {
      success: true,
      result: {
        id: (saved as any)?.id ?? '',
        rotaConfigId,
        generatedAt: (saved as any)?.generated_at ?? new Date().toISOString(),
        generatedBy, status, validationIssues, calendarData, targetsData,
        isStale: false,
      },
    }

  } catch (err) {
    console.error('Pre-rota generation error:', err)
    return { success: false, error: 'Unexpected error during generation. Check the browser console.' }
  }
}
