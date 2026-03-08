import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useAdminSetup } from "@/contexts/AdminSetupContext";

// ✅ Section 1 complete
const ACCENT = {
  main:        '#d97706',
  mid:         '#b45309',
  dark:        '#92400e',
  light:       '#fffbeb',
  pale:        '#fef3c7',
  border:      '#fcd34d',
  focusRing:   'rgba(217,119,6,0.12)',
  headerGrad:  'linear-gradient(135deg, #0f2440 0%, #78350f 100%)',
  btnGrad:     'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
  progressBar: 'linear-gradient(90deg, #d97706, #fbbf24)',
} as const;

const NAVY = '#0f2440';
const SHADOW = '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)';
const RADIUS = '12px';

function useWindowWidth() {
  const [width, setWidth] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );
  React.useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return width;
}

function formatDateDisplay(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

function addOneDay(iso: string): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

const inputBase: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid #e5e7eb',
  borderRadius: 8,
  padding: '10px 14px',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: 14,
  color: '#111827',
  background: '#f9fafb',
  outline: 'none',
  appearance: 'none' as const,
  transition: 'border-color 0.15s, box-shadow 0.15s',
  boxSizing: 'border-box' as const,
};

export default function RotaPeriodStep1() {
  const navigate = useNavigate();
  const { rotaStartDate, rotaEndDate, setRotaStartDate, setRotaEndDate } = useAdminSetup();
  const [startDate, setStartDate] = useState<Date | undefined>(rotaStartDate);
  const [endDate, setEndDate] = useState<Date | undefined>(rotaEndDate);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("08:00");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const isMobile = useWindowWidth() < 640;

  const handleContinue = () => {
    setRotaStartDate(startDate);
    setRotaEndDate(endDate);
    navigate("/admin/rota-period/step-2");
  };

  const durationInfo = (() => {
    if (!startDate || !endDate) return null;
    const days = differenceInDays(endDate, startDate);
    if (days <= 0) return { error: true, text: "End date must be after start date." };
    const weeks = (days / 7).toFixed(1);
    return { error: false, text: `Rota duration: ${days} days (${weeks} weeks)` };
  })();

  const focused = (name: string): React.CSSProperties =>
    focusedField === name
      ? { borderColor: ACCENT.main, background: '#fff', boxShadow: `0 0 0 3px ${ACCENT.focusRing}` }
      : {};

  const currentStep = 0;
  const steps = [
    { label: 'Dates & Times' },
    { label: 'Bank Holidays' },
  ];

  // ✅ Section 3 complete
  function renderStepIndicator() {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          {steps.map((step, idx) => (
            <React.Fragment key={idx}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: idx <= currentStep ? ACCENT.main : '#e5e7eb',
                  color: idx <= currentStep ? '#fff' : '#9ca3af',
                  fontSize: 13, fontWeight: 700,
                  boxShadow: idx === currentStep ? `0 0 0 4px ${ACCENT.focusRing}` : 'none',
                  transition: 'background 0.3s',
                }}>
                  {idx < currentStep ? '✓' : idx + 1}
                </div>
                {!isMobile && (
                  <span style={{
                    fontSize: 11, marginTop: 4, textAlign: 'center',
                    color: idx === currentStep ? ACCENT.main : '#9ca3af',
                    fontWeight: idx === currentStep ? 600 : 400,
                  }}>{step.label}</span>
                )}
              </div>
              {idx < steps.length - 1 && (
                <div style={{
                  flex: 1, height: 2, marginBottom: isMobile ? 0 : 18,
                  background: idx < currentStep ? ACCENT.main : '#e5e7eb',
                  transition: 'background 0.3s',
                }} />
              )}
            </React.Fragment>
          ))}
        </div>
        {isMobile && (
          <p style={{ textAlign: 'center', fontSize: 12, color: ACCENT.main, fontWeight: 600, marginTop: -12, marginBottom: 16 }}>
            Step {currentStep + 1} of {steps.length} — {steps[currentStep].label}
          </p>
        )}
      </>
    );
  }

  const endDateIso = endDate ? format(endDate, 'yyyy-MM-dd') : '';

  // ✅ Section 2 complete
  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      background: '#f0f4f9',
      color: '#111827',
      minHeight: '100vh',
    }}>
      {/* STICKY HEADER */}
      <header style={{
        background: ACCENT.headerGrad,
        position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
      }}>
        <div style={{
          maxWidth: 780, margin: '0 auto',
          padding: isMobile ? '12px 16px' : '16px 24px',
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{
            width: 36, height: 36, background: ACCENT.main,
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 500,
            color: '#fff', flexShrink: 0,
          }}>RE</div>
          <div style={{ flex: 1 }}>
            <h1 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 18, color: '#fff', lineHeight: 1.2, margin: 0,
            }}>RotaGen</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
              Rota Period Setup
            </p>
          </div>
          <span style={{
            background: ACCENT.main, color: '#fff',
            fontSize: 11, fontWeight: 600, padding: '4px 10px',
            borderRadius: 20, letterSpacing: '0.5px', textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}>Step 1 of 2</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', height: 3 }}>
          <div style={{
            background: ACCENT.progressBar,
            height: '100%', width: '50%',
            transition: 'width 0.4s ease',
          }} />
        </div>
      </header>

      {/* FORM SHELL */}
      <div style={{
        maxWidth: 780, margin: '0 auto',
        padding: isMobile ? '20px 16px 60px' : '32px 24px 80px',
      }}>
        {renderStepIndicator()}

        {/* ✅ Section 4 complete — INTRO CARD */}
        <div style={{
          background: '#fff', borderRadius: RADIUS,
          borderLeft: `4px solid ${ACCENT.main}`,
          padding: isMobile ? '16px 20px' : '24px 28px',
          marginBottom: 28, boxShadow: SHADOW,
        }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: NAVY, marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>
            Rota Period Dates
          </h2>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
            Define the start and end dates for this rota period. The duration is calculated automatically.
            The end date is the last day a night shift can <em>start</em> — the rota runs until the following morning.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {['📅 One active rota period', 'Duration auto-calculated', 'Feeds into the algorithm'].map(chip => (
              <span key={chip} style={{
                fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 20,
                background: ACCENT.pale, color: ACCENT.dark, border: `1px solid ${ACCENT.border}`,
              }}>{chip}</span>
            ))}
          </div>
        </div>

        {/* ✅ Section 5 complete — SECTION 1: Rota Dates */}
        <div style={{
          background: '#fff', borderRadius: RADIUS,
          boxShadow: SHADOW, marginBottom: 20, overflow: 'hidden',
        }}>
          <div style={{
            background: ACCENT.headerGrad,
            padding: '18px 24px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 28, height: 28,
              background: 'rgba(255,255,255,0.15)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 500,
              color: '#fff', flexShrink: 0,
            }}>1</div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#fff', letterSpacing: '0.2px', margin: 0 }}>
              Rota Dates
            </h2>
          </div>
          <div style={{ padding: isMobile ? 16 : 24 }}>
            {/* ✅ Section 6 complete — Form fields */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 12,
            }}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                  Start Date <span style={{ color: '#b91c1c', marginLeft: 2 }}>*</span>
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      style={{
                        ...inputBase,
                        ...focused('startDate'),
                        display: 'flex', alignItems: 'center', gap: 8,
                        cursor: 'pointer', textAlign: 'left',
                      }}
                      onFocus={() => setFocusedField('startDate')}
                      onBlur={() => setFocusedField(null)}
                    >
                      <span style={{ fontSize: 14 }}>📅</span>
                      {startDate ? format(startDate, "PPP") : <span style={{ color: '#9ca3af' }}>Select start date</span>}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                  End Date <span style={{ color: '#b91c1c', marginLeft: 2 }}>*</span>
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      style={{
                        ...inputBase,
                        ...focused('endDate'),
                        display: 'flex', alignItems: 'center', gap: 8,
                        cursor: 'pointer', textAlign: 'left',
                      }}
                      onFocus={() => setFocusedField('endDate')}
                      onBlur={() => setFocusedField(null)}
                    >
                      <span style={{ fontSize: 14 }}>📅</span>
                      {endDate ? format(endDate, "PPP") : <span style={{ color: '#9ca3af' }}>Select end date</span>}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Duration info */}
            {durationInfo && (
              <div style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '12px 16px', borderRadius: 8, fontSize: 13, lineHeight: 1.5,
                background: durationInfo.error ? '#fee2e2' : ACCENT.pale,
                color: durationInfo.error ? '#991b1b' : ACCENT.dark,
                border: `1px solid ${durationInfo.error ? '#fecaca' : ACCENT.border}`,
                marginBottom: 10,
              }}>
                <span style={{ flexShrink: 0, fontSize: 15, marginTop: 1 }}>{durationInfo.error ? '⚠️' : '📅'}</span>
                <span>
                  {durationInfo.text}
                  {!durationInfo.error && <span style={{ color: '#9ca3af', fontSize: 12 }}> (including final night shift handover)</span>}
                </span>
              </div>
            )}

            {/* ✅ Section 10 complete — End date helper text */}
            {endDateIso && endTime && (
              <div style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '12px 16px', borderRadius: 8, fontSize: 13, lineHeight: 1.5,
                background: ACCENT.pale, color: ACCENT.dark,
                border: `1px solid ${ACCENT.border}`,
                marginTop: 8, marginBottom: 10,
              }}>
                <span style={{ flexShrink: 0, fontSize: 15 }}>ℹ️</span>
                <span>
                  The rota will run until{' '}
                  <strong>{endTime} on {formatDateDisplay(addOneDay(endDateIso))}</strong>
                  {' '}— the morning after the last night shift starting on{' '}
                  <strong>{formatDateDisplay(endDateIso)}</strong>.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: Rota Times */}
        <div style={{
          background: '#fff', borderRadius: RADIUS,
          boxShadow: SHADOW, marginBottom: 20, overflow: 'hidden',
        }}>
          <div style={{
            background: ACCENT.headerGrad,
            padding: '18px 24px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 28, height: 28,
              background: 'rgba(255,255,255,0.15)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 500,
              color: '#fff', flexShrink: 0,
            }}>2</div>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#fff', letterSpacing: '0.2px', margin: 0 }}>
              Rota Times
            </h2>
          </div>
          <div style={{ padding: isMobile ? 16 : 24 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 12,
            }}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                  Start Time
                  <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 400, marginTop: 1, display: 'block' }}>
                    When the rota day begins
                  </span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  style={{ ...inputBase, ...focused('startTime') }}
                  onFocus={() => setFocusedField('startTime')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                  End Time
                  <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 400, marginTop: 1, display: 'block' }}>
                    When the rota day ends (typically next morning)
                  </span>
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  style={{ ...inputBase, ...focused('endTime') }}
                  onFocus={() => setFocusedField('endTime')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Section 9 complete — NAVIGATION BUTTONS */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 12, marginTop: 32,
          alignItems: isMobile ? 'stretch' : 'center',
        }}>
          {!isMobile && <div style={{ flex: 1 }} />}
          <button
            onClick={handleContinue}
            style={{
              padding: '12px 32px',
              background: ACCENT.btnGrad,
              color: '#fff',
              border: 'none', borderRadius: 10,
              fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600,
              cursor: 'pointer',
              boxShadow: `0 4px 14px ${ACCENT.focusRing}`,
              transition: 'transform 0.1s, box-shadow 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            Save & Continue →
          </button>
        </div>
      </div>
    </div>
  );
}
