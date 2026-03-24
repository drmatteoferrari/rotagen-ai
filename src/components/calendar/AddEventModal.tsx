import { useState } from 'react'
import { X } from 'lucide-react'

const EVENT_TYPES = [
  { code: 'AL', label: 'Annual leave', colour: '#16a34a' },
  { code: 'SL', label: 'Study leave', colour: '#2563eb' },
  { code: 'NOC', label: 'Not on-call', colour: '#ec4899' },
  { code: 'ROT', label: 'Rotation', colour: '#c2410c' },
  { code: 'PL', label: 'Parental leave', colour: '#7c3aed' },
]

interface AddEventModalProps {
  prefill?: {
    eventType: string; startDate: string; endDate: string
    note: string; overrideId: string; originalEventType: string | null
  }
  copyFrom?: { eventType: string; startDate: string; endDate: string }
  initialDate?: string
  doctorName: string
  rotaStartDate: string
  rotaEndDate: string
  saving: boolean
  onSave: (payload: {
    eventType: string; startDate: string; endDate: string
    note: string; overrideId: string | null; originalEventType: string | null
  }) => void
  onClose: () => void
}

export function AddEventModal({
  prefill, copyFrom, initialDate,
  doctorName, rotaStartDate, rotaEndDate,
  saving, onSave, onClose,
}: AddEventModalProps) {
  const [eventType, setEventType] = useState(prefill?.eventType ?? copyFrom?.eventType ?? 'AL')
  const [startDate, setStartDate] = useState(
    prefill?.startDate ?? (copyFrom ? '' : (initialDate ?? ''))
  )
  const [endDate, setEndDate] = useState(
    prefill?.endDate ?? (copyFrom ? '' : (initialDate ?? ''))
  )
  const [note, setNote] = useState(prefill?.note ?? '')
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!prefill
  const title = isEdit ? 'Edit event' : copyFrom ? 'Copy event' : 'Add event'
  const saveLabel = isEdit ? 'Save changes' : 'Add event'

  const handleSubmit = () => {
    setError(null)
    if (!startDate) { setError('Start date is required'); return }
    if (!endDate) { setError('End date is required'); return }
    if (endDate < startDate) { setError('End date must be on or after start date'); return }
    if (startDate < rotaStartDate || endDate > rotaEndDate) {
      setError(`Dates must be within the rota period (${rotaStartDate} – ${rotaEndDate})`)
      return
    }
    onSave({
      eventType, startDate, endDate, note,
      overrideId: prefill?.overrideId ?? null,
      originalEventType: prefill?.originalEventType ?? null,
    })
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        background: '#fff', borderRadius: '16px 16px 0 0',
        padding: 20, boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>{doctorName}</p>

        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Event type</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EVENT_TYPES.map(et => (
              <button key={et.code} onClick={() => setEventType(et.code)} style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                border: `2px solid ${eventType === et.code ? et.colour : '#e2e8f0'}`,
                background: eventType === et.code ? et.colour : '#fff',
                color: eventType === et.code ? '#fff' : '#374151', cursor: 'pointer',
              }}>{et.code}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Start date</p>
            <input type="date" value={startDate} min={rotaStartDate} max={rotaEndDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>End date</p>
            <input type="date" value={endDate} min={rotaStartDate} max={rotaEndDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Note (optional)</p>
          <input type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder="e.g. Swapped with Dr Smith" maxLength={200}
            style={{ width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', boxSizing: 'border-box' }} />
        </div>

        {error && (
          <p style={{ fontSize: 12, color: '#dc2626', marginBottom: 10 }}>{error}</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 500,
            background: '#fff', color: '#374151', border: '1px solid #e2e8f0',
            borderRadius: 8, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            background: saving ? '#94a3b8' : '#2563eb', color: '#fff',
            border: 'none', borderRadius: 8,
            cursor: saving ? 'not-allowed' : 'pointer',
          }}>{saving ? 'Saving…' : saveLabel}</button>
        </div>
      </div>
    </div>
  )
}
