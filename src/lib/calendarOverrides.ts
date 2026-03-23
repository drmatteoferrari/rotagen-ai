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
