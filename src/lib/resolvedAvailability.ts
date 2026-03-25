import { supabase } from '@/integrations/supabase/client'
import { mergeOverridesIntoAvailability, mapOverrideRow } from '@/lib/calendarOverrides'
import type { CalendarData } from '@/lib/preRotaTypes'

type ResolvedRow = {
  rota_config_id: string
  doctor_id: string
  date: string
  status: string
  source: string
  override_id: string | null
  rebuilt_at: string
}

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
  const { data: overrideRows } = await supabase
    .from('coordinator_calendar_overrides')
    .select('*')
    .eq('rota_config_id', rotaConfigId)
  const allOverrides = (overrideRows ?? []).map(mapOverrideRow)

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
      rows.push({
        rota_config_id: rotaConfigId,
        doctor_id: doctor.doctorId,
        date,
        status: cell.primary,
        source: cell.overrideId !== null ? 'coordinator_override' : 'survey',
        override_id: cell.overrideId,
        rebuilt_at: now,
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
  const { data: overrideRows } = await supabase
    .from('coordinator_calendar_overrides')
    .select('*')
    .eq('rota_config_id', rotaConfigId)
    .eq('doctor_id', doctorId)
  const doctorOverrides = (overrideRows ?? []).map(mapOverrideRow)

  // 3. Merge base availability with all current overrides
  const merged = mergeOverridesIntoAvailability(
    doctor.availability,
    doctorOverrides,
    calendarData.rotaStartDate,
    calendarData.rotaEndDate,
  )

  // 4. Build upsert rows — status = primary always (see note above)
  const now = new Date().toISOString()
  const rows: ResolvedRow[] = Object.entries(merged).map(([date, cell]) => ({
    rota_config_id: rotaConfigId,
    doctor_id: doctorId,
    date,
    status: cell.primary,
    source: cell.overrideId !== null ? 'coordinator_override' : 'survey',
    override_id: cell.overrideId,
    rebuilt_at: now,
  }))

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
