// ✅ Section 7 complete

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

    // 6. Fetch survey responses
    const { data: surveyResponses } = await supabase
      .from('doctor_survey_responses').select('*').eq('rota_config_id', rotaConfigId)

    // 7. Fetch account settings
    // FIX: .maybeSingle() prevents crash when no account_settings row exists
    const { data: accountSettings } = await supabase
      .from('account_settings').select('department_name, trust_name')
      .eq('owned_by', config.owned_by).maybeSingle()

    // 8. Map doctors + surveys
    const doctorsWithSurveys = doctors.map(doctor => {
      const survey = surveyResponses?.find(r => r.doctor_id === doctor.id) ?? null
      const compJson = survey?.competencies_json as Record<string, any> | null
      const annualLeave = (Array.isArray(survey?.annual_leave) ? survey.annual_leave : []) as { startDate: string; endDate: string }[]
      const studyLeave = (Array.isArray(survey?.study_leave) ? survey.study_leave : []) as { startDate: string; endDate: string }[]
      const nocDates = (Array.isArray(survey?.noc_dates) ? survey.noc_dates : []) as { startDate: string; endDate: string }[]
      const rotations = (Array.isArray(survey?.other_unavailability) ? survey.other_unavailability : []) as { startDate: string; endDate: string; location: string }[]
      const ltftDaysOff = (Array.isArray(survey?.ltft_days_off) ? survey.ltft_days_off : []) as string[]
      const ltftNightFlex = (Array.isArray(survey?.ltft_night_flexibility) ? survey.ltft_night_flexibility : []) as { day: string; canStart: boolean | null; canEnd: boolean | null }[]

      return {
        id: doctor.id,
        firstName: doctor.first_name,
        lastName: doctor.last_name,
        grade: survey?.grade ?? doctor.grade ?? '',
        surveyStatus: doctor.survey_status ?? 'not_started',
        wte: Number(survey?.wte_percent ?? 100),
        survey: survey ? {
          wtePercent: Number(survey.wte_percent ?? 100),
          ltftDaysOff,
          ltftNightFlexibility: ltftNightFlex,
          annualLeave,
          studyLeave,
          nocDates,
          rotations,
          alEntitlement: survey.al_entitlement,
          parentalLeaveExpected: survey.parental_leave_expected ?? false,
          parentalLeaveStart: survey.parental_leave_start ?? null,
          parentalLeaveEnd: survey.parental_leave_end ?? null,
          competencies: {
            iacAchieved: compJson?.iac?.achieved ?? null,
            iaocAchieved: compJson?.iaoc?.achieved ?? null,
            icuAchieved: compJson?.icu?.achieved ?? null,
            transferAchieved: compJson?.transfer?.achieved ?? null,
          },
        } : null,
      }
    })

    // 9. Run validation
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

    // 10. If blocked: save issues only, return early
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

    // 11. Build calendar and targets
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

    // 12. Save to DB (UPSERT)
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
