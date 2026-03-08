import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, isWithinInterval, differenceInDays } from "date-fns";
import { useAdminSetup } from "@/contexts/AdminSetupContext";
import { useRotaContext } from "@/contexts/RotaContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

interface BankHoliday {
  id: string;
  date: Date;
  name: string;
}

const UK_BANK_HOLIDAYS: { date: [number, number, number]; name: string }[] = [
  // 2025
  { date: [2025, 0, 1], name: "New Year's Day" },
  { date: [2025, 3, 18], name: "Good Friday" },
  { date: [2025, 3, 21], name: "Easter Monday" },
  { date: [2025, 4, 5], name: "Early May Bank Holiday" },
  { date: [2025, 4, 26], name: "Spring Bank Holiday" },
  { date: [2025, 7, 25], name: "Summer Bank Holiday" },
  { date: [2025, 11, 25], name: "Christmas Day" },
  { date: [2025, 11, 26], name: "Boxing Day" },
  // 2026
  { date: [2026, 0, 1], name: "New Year's Day" },
  { date: [2026, 3, 3], name: "Good Friday" },
  { date: [2026, 3, 6], name: "Easter Monday" },
  { date: [2026, 4, 4], name: "Early May Bank Holiday" },
  { date: [2026, 4, 25], name: "Spring Bank Holiday" },
  { date: [2026, 7, 31], name: "Summer Bank Holiday" },
  { date: [2026, 11, 25], name: "Christmas Day" },
  { date: [2026, 11, 28], name: "Boxing Day (substitute)" },
  // 2027
  { date: [2027, 0, 1], name: "New Year's Day" },
  { date: [2027, 2, 26], name: "Good Friday" },
  { date: [2027, 2, 29], name: "Easter Monday" },
  { date: [2027, 4, 3], name: "Early May Bank Holiday" },
  { date: [2027, 4, 31], name: "Spring Bank Holiday" },
  { date: [2027, 7, 30], name: "Summer Bank Holiday" },
  { date: [2027, 11, 27], name: "Christmas Day (substitute)" },
  { date: [2027, 11, 28], name: "Boxing Day (substitute)" },
];

export default function RotaPeriodStep2() {
  const navigate = useNavigate();
  const { setPeriodComplete, rotaStartDate, rotaEndDate } = useAdminSetup();
  const { currentRotaConfigId, setCurrentRotaConfigId } = useRotaContext();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [bankHolidays, setBankHolidays] = useState<BankHoliday[]>([]);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState<Date>();
  const [initialized, setInitialized] = useState(false);
  const [bhSameAsWeekend, setBhSameAsWeekend] = useState<boolean | null>(null);
  const [bhCustomRules, setBhCustomRules] = useState<string>("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const isMobile = useWindowWidth() < 640;

  useEffect(() => {
    if (initialized || !rotaStartDate || !rotaEndDate) return;
    const filtered = UK_BANK_HOLIDAYS
      .map((h) => ({ ...h, dateObj: new Date(h.date[0], h.date[1], h.date[2]) }))
      .filter((h) => isWithinInterval(h.dateObj, { start: rotaStartDate, end: rotaEndDate }))
      .map((h, i) => ({ id: `bh-${i}`, date: h.dateObj, name: h.name }));
    setBankHolidays(filtered);
    setInitialized(true);
  }, [rotaStartDate, rotaEndDate, initialized]);

  useEffect(() => {
    if (!currentRotaConfigId) return;
    const loadBhRules = async () => {
      const { data: config } = await supabase
        .from("rota_configs")
        .select("bh_same_as_weekend, bh_custom_rules")
        .eq("id", currentRotaConfigId)
        .maybeSingle();
      if (config) {
        if ((config as any).bh_same_as_weekend !== undefined && (config as any).bh_same_as_weekend !== null) {
          setBhSameAsWeekend((config as any).bh_same_as_weekend);
        }
        if ((config as any).bh_custom_rules) {
          setBhCustomRules((config as any).bh_custom_rules);
        }
      }
    };
    loadBhRules();
  }, [currentRotaConfigId]);

  const addBankHoliday = () => {
    if (newHolidayDate && newHolidayName) {
      setBankHolidays([...bankHolidays, { id: Date.now().toString(), date: newHolidayDate, name: newHolidayName }]);
      setNewHolidayName("");
      setNewHolidayDate(undefined);
    }
  };

  const removeBankHoliday = (id: string) => {
    setBankHolidays(bankHolidays.filter((h) => h.id !== id));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const startDateStr = rotaStartDate ? format(rotaStartDate, "yyyy-MM-dd") : null;
      const endDateStr = rotaEndDate ? format(rotaEndDate, "yyyy-MM-dd") : null;
      const durationDays = rotaStartDate && rotaEndDate ? differenceInDays(rotaEndDate, rotaStartDate) : null;
      const durationWeeks = durationDays != null ? Number((durationDays / 7).toFixed(1)) : null;

      let configId = currentRotaConfigId;
      const configFields = {
        rota_start_date: startDateStr,
        rota_end_date: endDateStr,
        rota_duration_days: durationDays,
        rota_duration_weeks: durationWeeks,
        rota_start_time: "08:00",
        rota_end_time: "08:00",
        bh_same_as_weekend: bhSameAsWeekend,
        bh_custom_rules: bhSameAsWeekend === false ? bhCustomRules : null,
      };

      if (!configId) {
        const { data, error } = await supabase
          .from("rota_configs")
          .insert({ ...configFields, owned_by: user?.username ?? "developer1" } as any)
          .select("id")
          .single();
        if (error) throw error;
        configId = data.id;
        setCurrentRotaConfigId(configId);
      } else {
        const { error } = await supabase
          .from("rota_configs")
          .update({ ...configFields, updated_at: new Date().toISOString() })
          .eq("id", configId);
        if (error) throw error;
      }

      await supabase.from("bank_holidays").delete().eq("rota_config_id", configId);

      if (bankHolidays.length > 0) {
        const rows = bankHolidays.map((h) => ({
          rota_config_id: configId!,
          date: format(h.date, "yyyy-MM-dd"),
          name: h.name,
          is_auto_added: h.id.startsWith("bh-"),
        }));
        const { error: insertError } = await supabase.from("bank_holidays").insert(rows);
        if (insertError) throw insertError;
      }

      toast.success("✓ Rota period saved");
      setPeriodComplete(true);
      navigate("/admin/dashboard");
    } catch (err: any) {
      console.error("Rota period save failed:", err);
      toast.error("Save failed — please try again");
    } finally {
      setSaving(false);
    }
  };

  const focused = (name: string): React.CSSProperties =>
    focusedField === name
      ? { borderColor: ACCENT.main, background: '#fff', boxShadow: `0 0 0 3px ${ACCENT.focusRing}` }
      : {};

  const currentStep = 1;
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
          }}>Step 2 of 2</span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', height: 3 }}>
          <div style={{
            background: ACCENT.progressBar,
            height: '100%', width: '100%',
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
            Bank Holidays
          </h2>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
            Add bank holidays that fall within this rota period. They are shown on the pre-rota calendar
            and affect shift eligibility calculations.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {['🏦 Affects scheduling rules', 'Shown on pre-rota calendar'].map(chip => (
              <span key={chip} style={{
                fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 20,
                background: ACCENT.pale, color: ACCENT.dark, border: `1px solid ${ACCENT.border}`,
              }}>{chip}</span>
            ))}
          </div>
        </div>

        {/* ✅ Section 5 + 7 complete — SECTION 1: Bank Holiday Dates */}
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
              Bank Holiday Dates
            </h2>
          </div>
          <div style={{ padding: isMobile ? 16 : 24 }}>
            {/* Info banner */}
            {bankHolidays.length > 0 && (
              <div style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '12px 16px', borderRadius: 8, fontSize: 13, lineHeight: 1.5,
                background: ACCENT.pale, color: ACCENT.dark,
                border: `1px solid ${ACCENT.border}`,
                marginBottom: 16,
              }}>
                <span style={{ flexShrink: 0, fontSize: 15, marginTop: 1 }}>🏦</span>
                <span>{bankHolidays.length} bank holiday{bankHolidays.length !== 1 ? "s" : ""} included in this rota period.</span>
              </div>
            )}

            {/* ✅ Section 7 complete — Bank holiday pills */}
            {bankHolidays.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {bankHolidays.map((bh) => (
                  <div key={bh.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px',
                    background: ACCENT.pale,
                    border: `1px solid ${ACCENT.border}`,
                    borderRadius: 20,
                    fontSize: 13, color: ACCENT.dark, fontWeight: 500,
                  }}>
                    <span>🏦</span>
                    <span>{bh.name} — {format(bh.date, "d MMM yyyy")}</span>
                    <button
                      onClick={() => removeBankHoliday(bh.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: ACCENT.dark, fontSize: 14, padding: '0 2px',
                        lineHeight: 1, opacity: 0.6,
                      }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '1' }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '0.6' }}
                    >✕</button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '20px', textAlign: 'center', fontSize: 13,
                color: '#9ca3af', background: '#f9fafb',
                borderRadius: 8, border: '1.5px dashed #e5e7eb',
                marginBottom: 16,
              }}>
                No bank holidays added yet
              </div>
            )}

            <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '20px 0' }} />

            {/* Add BH form */}
            <div style={{
              fontSize: 13, fontWeight: 600, color: ACCENT.main,
              textTransform: 'uppercase', letterSpacing: '0.6px',
              paddingBottom: 10, borderBottom: '1px solid #e5e7eb',
              marginBottom: 16,
            }}>
              Add a Bank Holiday
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto',
              gap: 12, alignItems: 'end',
            }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                  Holiday Name
                </label>
                <input
                  placeholder="e.g. Easter Monday"
                  value={newHolidayName}
                  onChange={(e) => setNewHolidayName(e.target.value)}
                  style={{ ...inputBase, ...focused('newName') }}
                  onFocus={() => setFocusedField('newName')}
                  onBlur={() => setFocusedField(null)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                  Date
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      style={{
                        ...inputBase,
                        ...focused('newDate'),
                        display: 'flex', alignItems: 'center', gap: 8,
                        cursor: 'pointer', textAlign: 'left',
                        width: isMobile ? '100%' : 200,
                      }}
                      onFocus={() => setFocusedField('newDate')}
                      onBlur={() => setFocusedField(null)}
                    >
                      <span style={{ fontSize: 14 }}>📅</span>
                      {newHolidayDate ? format(newHolidayDate, "PPP") : <span style={{ color: '#9ca3af' }}>Pick a date</span>}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={newHolidayDate} onSelect={setNewHolidayDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <button
                onClick={addBankHoliday}
                disabled={!newHolidayName || !newHolidayDate}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '9px 16px',
                  border: `1.5px dashed ${!newHolidayName || !newHolidayDate ? '#e5e7eb' : ACCENT.main}`,
                  borderRadius: 8, background: 'transparent',
                  color: !newHolidayName || !newHolidayDate ? '#9ca3af' : ACCENT.main,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500,
                  cursor: !newHolidayName || !newHolidayDate ? 'not-allowed' : 'pointer',
                  opacity: !newHolidayName || !newHolidayDate ? 0.5 : 1,
                  height: 42,
                }}
                onMouseEnter={e => {
                  if (newHolidayName && newHolidayDate) {
                    e.currentTarget.style.background = ACCENT.pale;
                    e.currentTarget.style.borderStyle = 'solid';
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderStyle = 'dashed';
                }}
              >
                <span style={{ fontSize: 16 }}>＋</span> Add
              </button>
            </div>
          </div>
        </div>

        {/* ✅ Section 5 + 8 complete — SECTION 2: Bank Holiday Rules */}
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
              Bank Holiday Rules
            </h2>
          </div>
          <div style={{ padding: isMobile ? 16 : 24 }}>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>
              Do bank holidays follow the same staffing and shift rules as weekends?
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                { value: true,  label: 'Yes — same rules as weekends' },
                { value: false, label: 'No — different rules apply' },
              ].map(opt => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setBhSameAsWeekend(opt.value)}
                  style={{
                    padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    border: `2px solid ${bhSameAsWeekend === opt.value ? ACCENT.main : '#e5e7eb'}`,
                    background: bhSameAsWeekend === opt.value ? ACCENT.pale : '#fff',
                    color: bhSameAsWeekend === opt.value ? ACCENT.dark : '#6b7280',
                    cursor: 'pointer', transition: 'all 0.15s',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {bhSameAsWeekend === false && (
              <div style={{ marginTop: 4 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                  Describe your department's bank holiday rules:
                  <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 400, display: 'block', marginTop: 1 }}>
                    e.g. Treated as standard weekdays. Reduced staffing. Night shifts still run.
                  </span>
                </label>
                <textarea
                  value={bhCustomRules}
                  onChange={e => setBhCustomRules(e.target.value)}
                  rows={4}
                  style={{
                    ...inputBase,
                    resize: 'vertical' as const, minHeight: 80,
                    ...(focusedField === 'bhRules'
                      ? { borderColor: ACCENT.main, background: '#fff', boxShadow: `0 0 0 3px ${ACCENT.focusRing}` }
                      : {}),
                  }}
                  onFocus={() => setFocusedField('bhRules')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Describe how bank holidays differ from standard weekend rules..."
                />
              </div>
            )}

            {bhSameAsWeekend === true && (
              <div style={{
                display: 'flex', gap: 10, padding: '10px 14px', borderRadius: 8,
                background: '#dcfce7', color: '#166534', border: '1px solid #86efac',
                fontSize: 13, alignItems: 'flex-start',
              }}>
                <span>✅</span>
                <span>Bank holidays will use the same minimum staffing and shift rules as Saturdays and Sundays.</span>
              </div>
            )}
          </div>
        </div>

        {/* ✅ Section 9 complete — NAVIGATION BUTTONS */}
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: 12, marginTop: 32,
          alignItems: isMobile ? 'stretch' : 'center',
        }}>
          <button
            onClick={() => navigate("/admin/rota-period/step-1")}
            style={{
              padding: '11px 24px',
              border: '1.5px solid #e5e7eb', borderRadius: 8,
              background: '#fff', color: '#374151',
              fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 500,
              cursor: 'pointer', order: isMobile ? 2 : 0,
            }}
          >
            ← Back
          </button>

          {!isMobile && <div style={{ flex: 1 }} />}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '12px 32px',
              background: saving ? '#e5e7eb' : ACCENT.btnGrad,
              color: saving ? '#9ca3af' : '#fff',
              border: 'none', borderRadius: 10,
              fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : `0 4px 14px ${ACCENT.focusRing}`,
              transition: 'transform 0.1s, box-shadow 0.15s',
              order: isMobile ? 1 : 0,
            }}
            onMouseEnter={e => { if (!saving) e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            {saving ? 'Saving…' : 'Save Rota Period'}
          </button>
        </div>
      </div>
    </div>
  );
}
