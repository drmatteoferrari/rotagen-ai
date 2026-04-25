import { supabase } from '@/integrations/supabase/client'
import { mergeOverridesIntoAvailability, mapOverrideRow } from '@/lib/calendarOverrides'
import { buildTargetsData } from './preRotaTargets'
import type { CalendarData, CalendarCell } from './preRotaTypes'
import type { TablesInsert } from '@/integrations/supabase/types'

function getUTCDayName(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday']
  return days[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

type ResolvedRow = TablesInsert<'resolved_availability'>

/**
 * Full rebuild — called after pre-rota generation (all doctors).
 * Deletes all existing rows for the config and re-inserts from scratch.
 * Must NOT be called when pre-rota status is 'blocked' (calendarData is empty).
 */
export async function rebuildResolvedAvailability(
  rotaConfigId: string,
  calendarData: CalendarData,
): Promise<void> {
  // 1. Fetch all coordinator overrides for this config
  const [overrideResult, ltftResult] = await Promise.all([
    supabase
      .from('coordinator_calendar_overrides')
      .select('*')
      .eq('rota_config_id', rotaConfigId),
    supabase
      .from('ltft_patterns')
      .select('doctor_id, day, can_start_nights, can_end_nights')
      .eq('rota_config_id', rotaConfigId)
      .eq('is_day_off', true),
  ])
  const allOverrides = (overrideResult.data ?? []).map(mapOverrideRow)
  const ltftRows = ltftResult.data ?? []

  // Map: doctorId → Map<dayName, {canStartNights, canEndNights}>
  const ltftMap = new Map<string, Map<string, {
    canStartNights: boolean | null
    canEndNights: boolean | null
  }>>()
  for (const row of ltftRows) {
    if (!ltftMap.has(row.doctor_id)) ltftMap.set(row.doctor_id, new Map())
    ltftMap.get(row.doctor_id)!.set(row.day, {
      canStartNights: row.can_start_nights ?? null,
      canEndNights: row.can_end_nights ?? null,
    })
  }

  // 2. Build rows for every doctor × every date
  const rows: ResolvedRow[] = []
  const now = new Date().toISOString()

  for (const doctor of calendarData.doctors) {
    const doctorOverrides = allOverrides.filter(o => o.doctorId === doctor.doctorId)
    const merged = mergeOverridesIntoAvailability(
      doctor.availability,
      doctorOverrides,
      calendarData.rotaStartDate,
      calendarData.rotaEndDate,
    )

    for (const [date, cell] of Object.entries(merged)) {
      // CRITICAL: status = cell.primary always.
      // When action='delete', mergeOverridesIntoAvailability sets primary='AVAILABLE'.
      // cell.isDeleted and cell.deletedCode are display-only — never used here.
      const ltftFlags = cell.primary === 'LTFT'
        ? (ltftMap.get(doctor.doctorId)?.get(getUTCDayName(date)) ??
           { canStartNights: null, canEndNights: null })
        : { canStartNights: null, canEndNights: null }

      rows.push({
        rota_config_id: rotaConfigId,
        doctor_id: doctor.doctorId,
        date,
        status: cell.primary,
        source: cell.overrideId !== null ? 'coordinator_override' : 'survey',
        override_id: cell.overrideId,
        rebuilt_at: now,
        can_start_nights: ltftFlags.canStartNights,
        can_end_nights: ltftFlags.canEndNights,
      })
    }
  }

  // 3. Delete all existing rows for this config, then bulk insert
  await supabase
    .from('resolved_availability')
    .delete()
    .eq('rota_config_id', rotaConfigId)

  if (rows.length === 0) return

  // Insert in batches of 500 to stay within Supabase payload limits
  const BATCH = 500
  for (let i = 0; i < rows.length; i += BATCH) {
    await supabase
      .from('resolved_availability')
      .insert(rows.slice(i, i + BATCH))
  }
}

/**
 * Targeted single-doctor refresh — called after any coordinator override
 * mutation (add, modify, delete, remove-survey-event) for one doctor.
 * Upserts only the rows for that doctor.
 * Silent no-op if no pre_rota_results row exists yet.
 */
export async function refreshResolvedAvailabilityForDoctor(
  rotaConfigId: string,
  doctorId: string,
): Promise<void> {
  // 1. Load base calendar data from pre_rota_results
  const { data: pr } = await supabase
    .from('pre_rota_results')
    .select('calendar_data, status')
    .eq('rota_config_id', rotaConfigId)
    .maybeSingle()

  // No pre-rota generated yet, or pre-rota is blocked (calendar_data is {}) — silent no-op
  if (!pr?.calendar_data) return
  const calendarData = pr.calendar_data as unknown as CalendarData
  if (!calendarData.doctors?.length) return

  const doctor = calendarData.doctors.find(d => d.doctorId === doctorId)
  if (!doctor) return

  // 2. Fetch all current overrides for this doctor
  const [overrideResult, ltftResult] = await Promise.all([
    supabase
      .from('coordinator_calendar_overrides')
      .select('*')
      .eq('rota_config_id', rotaConfigId)
      .eq('doctor_id', doctorId),
    supabase
      .from('ltft_patterns')
      .select('day, can_start_nights, can_end_nights')
      .eq('rota_config_id', rotaConfigId)
      .eq('doctor_id', doctorId)
      .eq('is_day_off', true),
  ])
  const doctorOverrides = (overrideResult.data ?? []).map(mapOverrideRow)
  const ltftRows = ltftResult.data ?? []

  const ltftDayMap = new Map<string, {
    canStartNights: boolean | null
    canEndNights: boolean | null
  }>()
  for (const row of ltftRows) {
    ltftDayMap.set(row.day, {
      canStartNights: row.can_start_nights ?? null,
      canEndNights: row.can_end_nights ?? null,
    })
  }

  // 3. Merge base availability with all current overrides
  const merged = mergeOverridesIntoAvailability(
    doctor.availability,
    doctorOverrides,
    calendarData.rotaStartDate,
    calendarData.rotaEndDate,
  )

  // 4. Build upsert rows — status = primary always (see note above)
  const now = new Date().toISOString()
  const rows: ResolvedRow[] = Object.entries(merged).map(([date, cell]) => {
    const ltftFlags = cell.primary === 'LTFT'
      ? (ltftDayMap.get(getUTCDayName(date)) ??
         { canStartNights: null, canEndNights: null })
      : { canStartNights: null, canEndNights: null }
    return {
      rota_config_id: rotaConfigId,
      doctor_id: doctorId,
      date,
      status: cell.primary,
      source: cell.overrideId !== null ? 'coordinator_override' : 'survey',
      override_id: cell.overrideId,
      rebuilt_at: now,
      can_start_nights: ltftFlags.canStartNights,
      can_end_nights: ltftFlags.canEndNights,
    }
  })

  if (rows.length === 0) return

  // 5. Upsert — UNIQUE(rota_config_id, doctor_id, date) resolves conflicts
  const BATCH = 500
  for (let i = 0; i < rows.length; i += BATCH) {
    await supabase
      .from('resolved_availability')
      .upsert(rows.slice(i, i + BATCH), { onConflict: 'rota_config_id,doctor_id,date' })
  }
}

/**
 * Full rebuild for all doctors in a config — called after revert-all overrides.
 * Re-fetches calendar_data from pre_rota_results and rebuilds from scratch.
 * Silent no-op if no pre_rota_results row exists yet.
 */
export async function rebuildResolvedAvailabilityFromDB(
  rotaConfigId: string,
): Promise<void> {
  const { data: pr } = await supabase
    .from('pre_rota_results')
    .select('calendar_data, status')
    .eq('rota_config_id', rotaConfigId)
    .maybeSingle()

  if (!pr?.calendar_data) return
  const calendarData = pr.calendar_data as unknown as CalendarData
  if (!calendarData.doctors?.length) return

  await rebuildResolvedAvailability(rotaConfigId, calendarData)
}

/**
 * Rebuild calendar_data (survey + overrides merged) and targets_data for a config,
 * and save back to pre_rota_results. Called after any coordinator override mutation
 * to keep targets in sync with resolved_availability.
 *
 * Silent no-op if no pre_rota_results row exists yet or status is 'blocked'.
 * Fire-and-forget — errors logged via console.error, never thrown.
 */
export async function refreshPreRotaTargets(rotaConfigId: string): Promise<void> {
  try {
    // 1. Load current pre_rota_results
    const { data: pr } = await supabase
      .from('pre_rota_results')
      .select('calendar_data, status')
      .eq('rota_config_id', rotaConfigId)
      .maybeSingle()

    if (!pr?.calendar_data) return
    if (pr.status === 'blocked') return
    const calendarData = pr.calendar_data as unknown as CalendarData
    if (!calendarData.doctors?.length) return

    // 2. Fetch raw rota_configs row
    const { data: config } = await supabase
      .from('rota_configs')
      .select('*')
      .eq('id', rotaConfigId)
      .maybeSingle()
    if (!config) return

    // 3. Fetch WTR settings
    const { data: wtr } = await supabase
      .from('wtr_settings')
      .select('*')
      .eq('rota_config_id', rotaConfigId)
      .maybeSingle()
    if (!wtr) return

    // 4. Fetch raw shift types
    const { data: rawShiftTypes } = await supabase
      .from('shift_types')
      .select('*')
      .eq('rota_config_id', rotaConfigId)
      .order('sort_order', { ascending: true })
    if (!rawShiftTypes?.length) return

    // 5. Fetch active doctors
    const { data: doctorRows } = await supabase
      .from('doctors')
      .select('*')
      .eq('rota_config_id', rotaConfigId)
      .eq('is_active', true)
    if (!doctorRows?.length) return

    // 6. Fetch survey responses (for wte_percent mapping)
    const { data: surveyRows } = await supabase
      .from('doctor_survey_responses')
      .select('doctor_id, wte_percent, grade')
      .eq('rota_config_id', rotaConfigId)
    const surveysByDoctor = new Map<string, { wte_percent: number | null; grade: string | null }>()
    for (const s of surveyRows ?? []) {
      surveysByDoctor.set(s.doctor_id as string, {
        wte_percent: (s.wte_percent as number | null) ?? null,
        grade: (s.grade as string | null) ?? null,
      })
    }

    // 7. Fetch all coordinator overrides
    const { data: overrideRows } = await supabase
      .from('coordinator_calendar_overrides')
      .select('*')
      .eq('rota_config_id', rotaConfigId)
    const allOverrides = (overrideRows ?? []).map(mapOverrideRow)

    // 8. Build a fresh merged calendar_data clone
    const mergedCalendarData = structuredClone(calendarData)
    for (const doctor of mergedCalendarData.doctors) {
      const doctorOverrides = allOverrides.filter(o => o.doctorId === doctor.doctorId)
      const merged = mergeOverridesIntoAvailability(
        doctor.availability,
        doctorOverrides,
        mergedCalendarData.rotaStartDate,
        mergedCalendarData.rotaEndDate,
      )
      // Strip MergedCell-specific fields → CalendarCell shape only.
      // primary is already 'AVAILABLE' when isDeleted; do not interpret isDeleted here.
      const stripped: Record<string, CalendarCell> = {}
      for (const [date, cell] of Object.entries(merged)) {
        stripped[date] = {
          primary: cell.primary as CalendarCell['primary'],
          secondary: cell.secondary as CalendarCell['secondary'],
          label: cell.label,
        }
      }
      doctor.availability = stripped
    }

    // 9. Recompute targets_data using merged calendar doctors
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
      doctors: doctorRows.map((d: any) => {
        const survey = surveysByDoctor.get(d.id as string)
        return {
          id: d.id as string,
          firstName: d.first_name as string,
          lastName: d.last_name as string,
          grade: (survey?.grade ?? d.grade ?? '') as string,
          wte: Number(survey?.wte_percent ?? 100),
        }
      }),
      calendarDoctors: mergedCalendarData.doctors,
    })

    // 10. UPDATE pre_rota_results — ONLY targets_data.
    // calendar_data is the survey-only base; it is NEVER rewritten here,
    // because doing so corrupts the base on subsequent runs (merged data
    // gets re-merged, phantom leave days accumulate, overrides can't be reverted).
    // The merged calendar is transient — used only to feed buildTargetsData above.
    await supabase
      .from('pre_rota_results')
      .update({
        targets_data: targetsData as any,
      })
      .eq('rota_config_id', rotaConfigId)
  } catch (err) {
    console.error('refreshPreRotaTargets failed:', err)
  }
}
