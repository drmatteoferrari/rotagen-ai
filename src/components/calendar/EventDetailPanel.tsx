import { X, Plus, Pencil, Copy, Trash2, RotateCcw, ArrowRight } from 'lucide-react'
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
  onGoToDate: () => void
  onClose: () => void
}

export function EventDetailPanel({
  mergedCell, date, doctorName, overrides,
  onEdit, onDelete, onCopy, onAddNew, onRemoveSurveyEvent, onGoToDate, onClose,
}: EventDetailPanelProps) {
  const override = mergedCell.overrideId
    ? overrides.find(o => o.id === mergedCell.overrideId) ?? null
    : null

  const isDeleted = mergedCell.isDeleted
  const displayCode = isDeleted ? mergedCell.deletedCode : mergedCell.primary
  const displayLabel = displayCode ? (EVENT_LABELS[displayCode] ?? displayCode) : null
  const isSurveyEvent = !override && !isDeleted && !!displayCode && displayCode !== 'AVAILABLE'
  const isAvailable = !override && !isDeleted && (!displayCode || displayCode === 'AVAILABLE')
  const isCoordOverride = !!override && !isDeleted

  const fmtDate = (iso: string) =>
    new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
    })

  return (
    <div style={{
      border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff',
      padding: 0, marginTop: 8, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '12px 14px 10px', background: '#f8fafc',
        borderBottom: '1px solid #f1f5f9',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: 0 }}>
            {isDeleted
              ? <span style={{ textDecoration: 'line-through', color: '#9ca3af' }}>{displayLabel ?? 'Event'}</span>
              : isAvailable
              ? <span>Available</span>
              : <span>{displayLabel ?? 'Event'}</span>
            }
          </p>
          <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
            {doctorName} · {fmtDate(date)}
          </p>
          {override && (
            <p style={{ fontSize: 10, color: '#94a3b8', margin: '3px 0 0' }}>
              {ACTION_LABELS[override.action] ?? override.action}
              {override.action === 'modify' && override.originalEventType && (
                <> — changed from{' '}
                  <span style={{ textDecoration: 'line-through' }}>
                    {EVENT_LABELS[override.originalEventType] ?? override.originalEventType}
                  </span>
                </>
              )}
              {override.note && <> · "{override.note}"</>}
            </p>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginTop: -2 }}>
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#e2e8f0' }} />

      {/* Action buttons */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4, padding: '10px 14px 12px',
      }}>

        {isAvailable && (
          <button onClick={onAddNew} style={row('#eff6ff', '#2563eb', '#bfdbfe')}>
            <Plus className="h-3.5 w-3.5" /> Add event
          </button>
        )}

        {isSurveyEvent && (
          <>
            <button onClick={onAddNew} style={row('#eff6ff', '#2563eb', '#bfdbfe')}>
              <Plus className="h-3.5 w-3.5" /> Add event
            </button>
            <button onClick={onRemoveSurveyEvent} style={row('#fef2f2', '#dc2626', '#fecaca')}>
              <Trash2 className="h-3.5 w-3.5" /> Remove event
            </button>
          </>
        )}

        {isCoordOverride && (
          <>
            <button onClick={() => onEdit(override!)} style={row('#fff', '#374151', '#e2e8f0')}>
              <Pencil className="h-3.5 w-3.5" /> Edit event
            </button>
            <button onClick={() => onCopy(override!)} style={row('#fff', '#374151', '#e2e8f0')}>
              <Copy className="h-3.5 w-3.5" /> Copy event
            </button>
            <button onClick={() => onDelete(override!)} style={row('#fef2f2', '#dc2626', '#fecaca')}>
              <Trash2 className="h-3.5 w-3.5" /> Remove event
            </button>
          </>
        )}

        {isDeleted && override && (
          <button onClick={() => onDelete(override)} style={row('#f0fdf4', '#16a34a', '#bbf7d0')}>
            <RotateCcw className="h-3.5 w-3.5" /> Restore event
          </button>
        )}

        <button onClick={onGoToDate} style={row('#fff', '#374151', '#e2e8f0')}>
          <ArrowRight className="h-3.5 w-3.5" /> Go to day view
        </button>

      </div>
    </div>
  )
}

function row(bg: string, color: string, borderColor: string) {
  return {
    display: 'flex' as const, alignItems: 'center' as const, gap: 8,
    width: '100%', textAlign: 'left' as const,
    padding: '7px 10px', borderRadius: 6,
    background: bg, color,
    border: `1px solid ${borderColor}`,
    cursor: 'pointer', fontSize: 12, fontWeight: 500,
  }
}
