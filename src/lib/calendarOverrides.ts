export interface CalendarOverride {
  id: string
  rotaConfigId: string
  doctorId: string
  eventType: 'AL' | 'SL' | 'NOC' | 'ROT' | 'PL' | 'LTFT'
  startDate: string
  endDate: string
  action: 'add' | 'modify' | 'delete'
  originalStartDate: string | null
  originalEndDate: string | null
  originalEventType: string | null
  recurrence: 'none' | 'weekly' | 'monthly' | 'custom'
  recurrenceDates: string[]
  note: string | null
  createdBy: string
  createdAt: string
}

export function getTodayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function mapOverrideRow(row: any): CalendarOverride {
  return {
    id: row.id,
    rotaConfigId: row.rota_config_id,
    doctorId: row.doctor_id,
    eventType: row.event_type,
    startDate: row.start_date,
    endDate: row.end_date,
    action: row.action,
    originalStartDate: row.original_start_date ?? null,
    originalEndDate: row.original_end_date ?? null,
    originalEventType: row.original_event_type ?? null,
    recurrence: row.recurrence ?? 'none',
    recurrenceDates: row.recurrence_dates ?? [],
    note: row.note ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export interface MergedCell {
  primary: string
  secondary: string | null
  label: string
  overrideId: string | null
  overrideAction: 'add' | 'modify' | 'delete' | null
  isDeleted: boolean
  deletedCode: string | null
}

function rangeInclusive(start: string, end: string): string[] {
  const result: string[] = []
  const [sy, sm, sd] = start.split('-').map(Number)
  const [ey, em, ed] = end.split('-').map(Number)
  const cur = new Date(Date.UTC(sy, sm - 1, sd))
  const endD = new Date(Date.UTC(ey, em - 1, ed))
  while (cur <= endD) {
    result.push(cur.toISOString().split('T')[0])
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return result
}

function expandOverrideDates(
  override: CalendarOverride,
  rotaStartDate: string,
  rotaEndDate: string
): string[] {
  const dates: string[] = []

  function inRota(iso: string) {
    return iso >= rotaStartDate && iso <= rotaEndDate
  }

  if (override.recurrence === 'custom') {
    override.recurrenceDates.filter(inRota).forEach(d => dates.push(d))
  } else if (override.recurrence === 'none') {
    rangeInclusive(override.startDate, override.endDate).filter(inRota).forEach(d => dates.push(d))
  } else if (override.recurrence === 'weekly') {
    const blockLen = Math.round(
      (new Date(override.endDate + 'T00:00:00').getTime() -
        new Date(override.startDate + 'T00:00:00').getTime()) / 86400000
    )
    let cursor = override.startDate
    while (cursor <= rotaEndDate) {
      const blockEnd = new Date(cursor + 'T00:00:00')
      blockEnd.setDate(blockEnd.getDate() + blockLen)
      rangeInclusive(cursor, blockEnd.toISOString().split('T')[0])
        .filter(inRota).forEach(d => dates.push(d))
      const next = new Date(cursor + 'T00:00:00')
      next.setDate(next.getDate() + 7)
      cursor = next.toISOString().split('T')[0]
    }
  } else if (override.recurrence === 'monthly') {
    const blockLen = Math.round(
      (new Date(override.endDate + 'T00:00:00').getTime() -
        new Date(override.startDate + 'T00:00:00').getTime()) / 86400000
    )
    let cursor = override.startDate
    while (cursor <= rotaEndDate) {
      const blockEnd = new Date(cursor + 'T00:00:00')
      blockEnd.setDate(blockEnd.getDate() + blockLen)
      rangeInclusive(cursor, blockEnd.toISOString().split('T')[0])
        .filter(inRota).forEach(d => dates.push(d))
      const next = new Date(cursor + 'T00:00:00')
      next.setMonth(next.getMonth() + 1)
      cursor = next.toISOString().split('T')[0]
    }
  }

  return [...new Set(dates)]
}

export function mergeOverridesIntoAvailability(
  availability: Record<string, { primary: string; secondary: string | null; label: string }>,
  overrides: CalendarOverride[],
  rotaStartDate: string,
  rotaEndDate: string
): Record<string, MergedCell> {
  const merged: Record<string, MergedCell> = {}

  for (const [date, cell] of Object.entries(availability)) {
    merged[date] = {
      primary: cell.primary,
      secondary: cell.secondary,
      label: cell.label,
      overrideId: null,
      overrideAction: null,
      isDeleted: false,
      deletedCode: null,
    }
  }

  const sorted = [...overrides].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  for (const override of sorted) {
    const dates = expandOverrideDates(override, rotaStartDate, rotaEndDate)
    for (const date of dates) {
      if (!merged[date]) continue
      if (override.action === 'add') {
        merged[date] = {
          primary: override.eventType,
          secondary: merged[date].secondary,
          label: override.eventType,
          overrideId: override.id,
          overrideAction: 'add',
          isDeleted: false,
          deletedCode: null,
        }
      } else if (override.action === 'modify') {
        merged[date] = {
          primary: override.eventType,
          secondary: merged[date].secondary,
          label: override.eventType,
          overrideId: override.id,
          overrideAction: 'modify',
          isDeleted: false,
          deletedCode: override.originalEventType ?? null,
        }
      } else if (override.action === 'delete') {
        const originalCode = merged[date].primary
        merged[date] = {
          primary: 'AVAILABLE',
          secondary: merged[date].secondary,
          label: '',
          overrideId: override.id,
          overrideAction: 'delete',
          isDeleted: true,
          deletedCode: originalCode !== 'AVAILABLE' ? originalCode : null,
        }
      }
    }
  }

  return merged
}
