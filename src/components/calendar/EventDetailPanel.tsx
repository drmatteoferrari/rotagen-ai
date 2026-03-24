import { X, Pencil, Trash2, Copy, Minus } from 'lucide-react'
import type { MergedCell, CalendarOverride } from '@/lib/calendarOverrides'

const EVENT_LABELS: Record<string, string> = {
  AL: 'Annual leave', SL: 'Study leave', NOC: 'Not on-call',
  ROT: 'Rotation', PL: 'Parental leave', LTFT: 'LTFT day off',
}

const ACTION_LABELS: Record<string, string> = {
  add: 'Added by coordinator',
  modify: 'Modified by coordinator',
  delete: 'Removed by coordinator',
}

interface EventDetailPanelProps {
  mergedCell: MergedCell
  date: string
  doctorName: string
  overrides: CalendarOverride[]
  onEdit: (override: CalendarOverride) => void
  onDelete: (override: CalendarOverride) => void
  onCopy: (override: CalendarOverride) => void
  onAddNew: () => void
  onRemoveSurveyEvent: () => void
  onClose: () => void
}

export function EventDetailPanel({
  mergedCell, date, doctorName, overrides,
  onEdit, onDelete, onCopy, onAddNew, onRemoveSurveyEvent, onClose,
}: EventDetailPanelProps) {
  const override = mergedCell.overrideId
    ? overrides.find(o => o.id === mergedCell.overrideId) ?? null
    : null

  const isDeleted = mergedCell.isDeleted
  const displayCode = isDeleted ? mergedCell.deletedCode : mergedCell.primary
  const displayLabel = displayCode ? (EVENT_LABELS[displayCode] ?? displayCode) : '—'
  const isSurveyEvent = !override && !isDeleted && !!displayCode && displayCode !== 'AVAILABLE'
  const isAvailable = !override && !isDeleted && (!displayCode || displayCode === 'AVAILABLE')

  const fmtDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    })

  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff',
      padding: 16, marginTop: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
          {isDeleted ? `Removed: ${displayLabel}` : isAvailable ? 'Available' : displayLabel}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div style={{ fontSize: 12, color: '#475569', marginBottom: 12, lineHeight: 1.6 }}>
        <p>Doctor: {doctorName}</p>
        <p>Date: {fmtDate(date)}</p>
        {override ? (
          <>
            <p>Source: {ACTION_LABELS[override.action] ?? override.action}</p>
            {override.action === 'modify' && override.originalEventType && (
              <p style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                Changed from:{' '}
                <span style={{ textDecoration: 'line-through', color: '#9ca3af' }}>
                  {EVENT_LABELS[override.originalEventType] ?? override.originalEventType}
                </span>
                {' → '}{EVENT_LABELS[override.eventType] ?? override.eventType}
              </p>
            )}
            {override.note && <p>Note: {override.note}</p>}
            <p style={{ color: '#94a3b8', fontSize: 11 }}>
              Created:{' '}
              {new Date(override.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </>
        ) : (
          <p>Source: Doctor survey</p>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {override && !isDeleted && (
          <>
            <button onClick={() => onEdit(override)} style={btn('#fff', '#374151', '#e2e8f0')}>
              <Pencil className="h-3 w-3" /> Edit
            </button>
            <button onClick={() => onCopy(override)} style={btn('#fff', '#374151', '#e2e8f0')}>
              <Copy className="h-3 w-3" /> Copy
            </button>
            <button onClick={() => onDelete(override)} style={btn('#fef2f2', '#dc2626', '#fee2e2')}>
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </>
        )}
        {isSurveyEvent && (
          <>
            <button onClick={onAddNew} style={btn('#fff', '#374151', '#e2e8f0')}>+ Add override</button>
            <button onClick={onRemoveSurveyEvent} style={btn('#fef2f2', '#dc2626', '#fee2e2')}>
              <Minus className="h-3 w-3" /> Remove event
            </button>
          </>
        )}
        {isAvailable && (
          <button onClick={onAddNew} style={btn('#fff', '#374151', '#e2e8f0')}>+ Add event</button>
        )}
        {isDeleted && override && (
          <button onClick={() => onDelete(override)} style={btn('#fef2f2', '#dc2626', '#fee2e2')}>
            <Trash2 className="h-3 w-3" /> Remove this override
          </button>
        )}
      </div>
    </div>
  )
}

function btn(bg: string, color: string, border: string) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 12, fontWeight: 500, padding: '5px 10px',
    borderRadius: 6, border: `1px solid ${border}`,
    background: bg, color, cursor: 'pointer',
  }
}
