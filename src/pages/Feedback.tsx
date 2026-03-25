import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabasePublic } from "@/integrations/supabase/publicClient";
import { Loader2, Star, BarChart3, Users, MessageSquare, User, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type RotaCreator = 'consultant' | 'resident' | 'secretary' | 'med_staffing' | 'other';

interface FeedbackFormData {
  ratingOverall: number;
  ratingClarity: number;
  ratingUI: number;
  ratingSpeed: number;
  quickerThanBefore: 'yes' | 'same' | 'no' | '';
  previousMethod: string;
  moreAccurate: 'yes' | 'same' | 'no' | '';
  rotaCreators: RotaCreator[];
  rotaCreatorsOther: string;
  improvements: string;
  bugs: string;
  comment: string;
  responderName: string;
  responderPhone: string;
  responderEmail: string;
  responderTrust: string;
  happyToContact: boolean | null;
  contactMethod: 'whatsapp' | 'phone' | 'email' | 'other' | '';
}

function StarRating({ value, onChange, error }: { value: number; onChange: (n: number) => void; error?: string }) {
  return (
    <div>
      <div className="flex items-center gap-0.5">
        {[1,2,3,4,5].map(i => (
          <button key={i} type="button" onClick={() => onChange(i)}
            className="text-4xl leading-none transition-transform hover:scale-110 focus:outline-none"
            style={{ color: i <= value ? '#16A34A' : '#d1d5db' }}>★</button>
        ))}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

function PillButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-full border-2 px-4 py-2 text-sm font-medium transition-all"
      style={selected
        ? { borderColor: '#16A34A', color: '#16A34A', backgroundColor: '#16A34A20' }
        : { borderColor: '#e2e8f0', color: '#374151', backgroundColor: 'transparent' }}>
      {label}
    </button>
  );
}

function CheckboxOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all text-left w-full sm:w-auto"
      style={checked
        ? { borderColor: '#16A34A', color: '#16A34A', backgroundColor: '#16A34A20' }
        : { borderColor: '#e2e8f0', color: '#374151', backgroundColor: 'transparent' }}>
      <span className="flex h-5 w-5 items-center justify-center rounded border text-xs font-bold"
        style={checked ? { borderColor: '#16A34A', backgroundColor: '#16A34A', color: '#fff' } : { borderColor: '#d1d5db' }}>
        {checked && "✓"}
      </span>
      {label}
    </button>
  );
}

export default function Feedback() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FeedbackFormData>({
    ratingOverall: 0, ratingClarity: 0, ratingUI: 0, ratingSpeed: 0,
    quickerThanBefore: '', previousMethod: '', moreAccurate: '',
    rotaCreators: [], rotaCreatorsOther: '', improvements: '', bugs: '', comment: '',
    responderName: '', responderPhone: '', responderEmail: '', responderTrust: '',
    happyToContact: null, contactMethod: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FeedbackFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [bouncing, setBouncing] = useState(false);
  const formTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bouncing) return;
    const t = setTimeout(() => setBouncing(false), 2000);
    return () => clearTimeout(t);
  }, [bouncing]);

  const toggleCreator = (v: RotaCreator) =>
    setForm(p => {
      const removing = p.rotaCreators.includes(v);
      return {
        ...p,
        rotaCreators: removing
          ? p.rotaCreators.filter(c => c !== v)
          : [...p.rotaCreators, v],
        rotaCreatorsOther: removing && v === 'other' ? '' : p.rotaCreatorsOther,
      };
    });

  const handleSubmit = async () => {
    const newErrors: Partial<Record<keyof FeedbackFormData, string>> = {};
    if (form.ratingOverall === 0) newErrors.ratingOverall = 'Please rate your overall experience';
    if (form.ratingClarity === 0) newErrors.ratingClarity = 'Please rate clarity';
    if (form.ratingUI === 0) newErrors.ratingUI = 'Please rate the visual design';
    if (form.ratingSpeed === 0) newErrors.ratingSpeed = 'Please rate speed';
    if (!form.quickerThanBefore) newErrors.quickerThanBefore = 'Please select an option';
    if (!form.previousMethod.trim()) newErrors.previousMethod = 'Please tell us what you used previously';
    if (!form.moreAccurate) newErrors.moreAccurate = 'Please select an option';
    if (!form.responderEmail.trim()) newErrors.responderEmail = 'Please enter your email address';
    if (!form.responderTrust.trim()) newErrors.responderTrust = 'Please enter your trust / hospital / department';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      rating_overall: form.ratingOverall,
      rating_clarity: form.ratingClarity,
      rating_ui: form.ratingUI,
      rating_speed: form.ratingSpeed,
      quicker_than_before: form.quickerThanBefore as 'yes' | 'same' | 'no',
      previous_method: form.previousMethod,
      more_accurate: form.moreAccurate as 'yes' | 'same' | 'no',
      rota_creators: form.rotaCreators.length > 0 ? form.rotaCreators : null,
      rota_creators_other: form.rotaCreatorsOther || null,
      improvements: form.improvements || null,
      bugs: form.bugs || null,
      comment: form.comment || null,
      responder_name: form.responderName || null,
      responder_phone: form.responderPhone || null,
      responder_email: form.responderEmail || null,
      responder_trust: form.responderTrust || null,
      happy_to_contact: form.happyToContact,
      contact_method: form.contactMethod || null,
    };

    const { error: dbError } = await supabasePublic.from('app_feedback' as any).insert(payload as any);
    if (dbError) {
      setSubmitError('Something went wrong saving your feedback. Please try again.');
      setSubmitting(false);
      return;
    }

    supabasePublic.functions.invoke('send-feedback-notification', { body: { feedback: payload } })
      .catch(e => console.warn('Feedback notification failed (non-blocking):', e));

    setSubmitting(false);
    setSubmitted(true);
    setBouncing(true);
  };

  return (
    <div className="min-h-screen text-foreground" style={{ backgroundColor: '#f0fdf4' }}>
      {/* Sticky top bar */}
      <div className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur" style={{ height: 56 }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-xs font-black tracking-tighter text-primary shadow-sm">
              RE
            </div>
            <span className="text-base font-bold text-foreground">RotaGen</span>
          </button>
          <button type="button" onClick={() => navigate("/")}
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            ← Back
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {submitted ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className={`text-6xl ${bouncing ? 'animate-bounce' : ''}`}>✅</div>
            <h2 className="mt-6 text-2xl font-bold text-foreground">Thank you so much! 😊</h2>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Your feedback goes directly to the RotaGen team and helps shape what we build next.
            </p>
            <button type="button" onClick={() => navigate('/')}
              className="mt-8 rounded-md px-6 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-80"
              style={{ backgroundColor: '#16A34A' }}>
              Back to RotaGen →
            </button>
          </div>
        ) : (
          <div ref={formTopRef} className="space-y-4">
            {/* Page header */}
            <div className="mb-2">
              <h1 className="text-2xl font-bold text-foreground">How are we doing?</h1>
              <p className="mt-2 text-sm text-muted-foreground">Honest feedback helps us build RotaGen for real NHS departments.</p>
            </div>

            {/* Section 1 — Ratings */}
            <Card className="shadow-sm border-[#d1fae5]">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-100">
                    <Star className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <h2 className="text-[10px] font-semibold uppercase tracking-widest text-foreground">Your ratings</h2>
                </div>
                <div className="space-y-0">
                  <div className="flex items-center justify-between gap-4 py-3 border-b border-[#d1fae5]">
                    <span className="text-sm font-medium text-foreground">Overall experience</span>
                    <StarRating value={form.ratingOverall} onChange={n => setForm(p => ({ ...p, ratingOverall: n }))} error={errors.ratingOverall} />
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3 border-b border-[#d1fae5]">
                    <span className="text-sm font-medium text-foreground">Clarity of the app</span>
                    <StarRating value={form.ratingClarity} onChange={n => setForm(p => ({ ...p, ratingClarity: n }))} error={errors.ratingClarity} />
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3 border-b border-[#d1fae5]">
                    <span className="text-sm font-medium text-foreground">Visual design</span>
                    <StarRating value={form.ratingUI} onChange={n => setForm(p => ({ ...p, ratingUI: n }))} error={errors.ratingUI} />
                  </div>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <span className="text-sm font-medium text-foreground">Speed & responsiveness</span>
                    <StarRating value={form.ratingSpeed} onChange={n => setForm(p => ({ ...p, ratingSpeed: n }))} error={errors.ratingSpeed} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2 — Compared to current method */}
            <Card className="shadow-sm border-[#d1fae5]">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-100">
                    <BarChart3 className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <h2 className="text-[10px] font-semibold uppercase tracking-widest text-foreground">Compared to your current method</h2>
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium text-foreground mb-2">Is RotaGen quicker than your previous method?</p>
                  <div className="flex flex-wrap gap-2">
                    <PillButton label="Yes" selected={form.quickerThanBefore === 'yes'} onClick={() => setForm(p => ({ ...p, quickerThanBefore: 'yes' }))} />
                    <PillButton label="About the same" selected={form.quickerThanBefore === 'same'} onClick={() => setForm(p => ({ ...p, quickerThanBefore: 'same' }))} />
                    <PillButton label="No" selected={form.quickerThanBefore === 'no'} onClick={() => setForm(p => ({ ...p, quickerThanBefore: 'no' }))} />
                  </div>
                  {errors.quickerThanBefore && <p className="text-red-500 text-xs mt-1">{errors.quickerThanBefore}</p>}
                </div>

                <div className="mb-4">
                  <p className="text-sm font-medium text-foreground mb-2">What did/do you use to create rotas?</p>
                  <textarea value={form.previousMethod} rows={3}
                    onChange={e => setForm(p => ({ ...p, previousMethod: e.target.value }))}
                    placeholder="e.g. Excel spreadsheet, paper, CLWRota..."
                    className="w-full rounded-lg border border-[#bbf7d0] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent"
                    style={{ backgroundColor: '#f0fdf4' }} />
                  {errors.previousMethod && <p className="text-red-500 text-xs mt-1">{errors.previousMethod}</p>}
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Does RotaGen fill more slots / is it more accurate?</p>
                  <div className="flex flex-wrap gap-2">
                    <PillButton label="Yes" selected={form.moreAccurate === 'yes'} onClick={() => setForm(p => ({ ...p, moreAccurate: 'yes' }))} />
                    <PillButton label="About the same" selected={form.moreAccurate === 'same'} onClick={() => setForm(p => ({ ...p, moreAccurate: 'same' }))} />
                    <PillButton label="No" selected={form.moreAccurate === 'no'} onClick={() => setForm(p => ({ ...p, moreAccurate: 'no' }))} />
                  </div>
                  {errors.moreAccurate && <p className="text-red-500 text-xs mt-1">{errors.moreAccurate}</p>}
                </div>
              </CardContent>
            </Card>

            {/* Section 3 — Rota creators */}
            <Card className="shadow-sm border-[#d1fae5]">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-100">
                    <Users className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <h2 className="text-[10px] font-semibold uppercase tracking-widest text-foreground">Who currently creates the rota?</h2>
                  <span className="ml-auto text-xs text-muted-foreground">Select all that apply</span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <CheckboxOption label="Consultant anaesthetist" checked={form.rotaCreators.includes('consultant')} onChange={() => toggleCreator('consultant')} />
                  <CheckboxOption label="Resident doctors" checked={form.rotaCreators.includes('resident')} onChange={() => toggleCreator('resident')} />
                  <CheckboxOption label="Department secretary" checked={form.rotaCreators.includes('secretary')} onChange={() => toggleCreator('secretary')} />
                  <CheckboxOption label="Medical staffing team" checked={form.rotaCreators.includes('med_staffing')} onChange={() => toggleCreator('med_staffing')} />
                  <CheckboxOption label="Other" checked={form.rotaCreators.includes('other')} onChange={() => toggleCreator('other')} />
                </div>
                {form.rotaCreators.includes('other') && (
                  <div className="mt-3">
                    <input type="text" value={form.rotaCreatorsOther}
                      onChange={e => setForm(p => ({ ...p, rotaCreatorsOther: e.target.value }))}
                      placeholder="Please describe who else is involved..."
                      className="w-full rounded-lg border border-[#bbf7d0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent"
                      style={{ backgroundColor: '#f0fdf4' }} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Section 4 — Optional feedback */}
            <Card className="shadow-sm border-[#d1fae5]">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-100">
                    <MessageSquare className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <h2 className="text-[10px] font-semibold uppercase tracking-widest text-foreground">Optional feedback</h2>
                  <span className="ml-auto text-xs text-muted-foreground">All optional</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Improvements or new features you'd like</p>
                    <textarea value={form.improvements} rows={3}
                      onChange={e => setForm(p => ({ ...p, improvements: e.target.value }))}
                      placeholder="Anything you wish RotaGen could do..."
                      className="w-full rounded-lg border border-[#bbf7d0] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent"
                      style={{ backgroundColor: '#f0fdf4' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Any bugs to report</p>
                    <textarea value={form.bugs} rows={3}
                      onChange={e => setForm(p => ({ ...p, bugs: e.target.value }))}
                      placeholder="Something broken or unexpected..."
                      className="w-full rounded-lg border border-[#bbf7d0] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent"
                      style={{ backgroundColor: '#f0fdf4' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Overall comment or review</p>
                    <textarea value={form.comment} rows={3}
                      onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
                      placeholder="Anything else you'd like to share..."
                      className="w-full rounded-lg border border-[#bbf7d0] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent"
                      style={{ backgroundColor: '#f0fdf4' }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 5 — About you */}
            <Card className="shadow-sm border-[#d1fae5]">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-100">
                    <User className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <h2 className="text-[10px] font-semibold uppercase tracking-widest text-foreground">About you</h2>
                  <span className="ml-auto text-xs text-muted-foreground">Helps us improve</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Your name <span className="text-muted-foreground font-normal text-xs">(optional)</span></p>
                    <input type="text" value={form.responderName}
                      onChange={e => setForm(p => ({ ...p, responderName: e.target.value }))}
                      placeholder="e.g. Dr Sarah Patel"
                      className="w-full rounded-lg border border-[#bbf7d0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent"
                      style={{ backgroundColor: '#f0fdf4' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Your mobile number <span className="text-muted-foreground font-normal text-xs">(optional)</span></p>
                    <input type="text" value={form.responderPhone}
                      onChange={e => setForm(p => ({ ...p, responderPhone: e.target.value }))}
                      placeholder="e.g. 07700 900000"
                      className="w-full rounded-lg border border-[#bbf7d0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent"
                      style={{ backgroundColor: '#f0fdf4' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Your email <span className="text-red-500 text-xs">*</span></p>
                    <input type="text" value={form.responderEmail}
                      onChange={e => setForm(p => ({ ...p, responderEmail: e.target.value }))}
                      placeholder="e.g. sarah.patel@nhs.net"
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent ${errors.responderEmail ? 'border-red-400' : 'border-[#bbf7d0]'}`}
                      style={{ backgroundColor: '#f0fdf4' }} />
                    {errors.responderEmail && <p className="text-red-500 text-xs mt-1">{errors.responderEmail}</p>}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">Trust / Hospital / Department <span className="text-red-500 text-xs">*</span></p>
                    <input type="text" value={form.responderTrust}
                      onChange={e => setForm(p => ({ ...p, responderTrust: e.target.value }))}
                      placeholder="e.g. Countess of Chester Hospital, Anaesthetics"
                      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent ${errors.responderTrust ? 'border-red-400' : 'border-[#bbf7d0]'}`}
                      style={{ backgroundColor: '#f0fdf4' }} />
                    {errors.responderTrust && <p className="text-red-500 text-xs mt-1">{errors.responderTrust}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 6 — Contact */}
            <Card className="shadow-sm border-[#d1fae5]">
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-green-100">
                    <Phone className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <h2 className="text-[10px] font-semibold uppercase tracking-widest text-foreground">Can we follow up?</h2>
                </div>
                <div className="mb-4">
                  <p className="text-sm font-medium text-foreground mb-2">Happy to be contacted about your feedback?</p>
                  <div className="flex flex-wrap gap-2">
                    <PillButton label="Yes" selected={form.happyToContact === true} onClick={() => setForm(p => ({ ...p, happyToContact: true }))} />
                    <PillButton label="No" selected={form.happyToContact === false} onClick={() => setForm(p => ({ ...p, happyToContact: false }))} />
                  </div>
                </div>
                {form.happyToContact === true && (
                  <div>
                    <p className="text-sm font-medium text-foreground mb-2">Preferred contact method</p>
                    <div className="flex flex-wrap gap-2">
                      <PillButton label="WhatsApp" selected={form.contactMethod === 'whatsapp'} onClick={() => setForm(p => ({ ...p, contactMethod: 'whatsapp' }))} />
                      <PillButton label="Phone" selected={form.contactMethod === 'phone'} onClick={() => setForm(p => ({ ...p, contactMethod: 'phone' }))} />
                      <PillButton label="Email" selected={form.contactMethod === 'email'} onClick={() => setForm(p => ({ ...p, contactMethod: 'email' }))} />
                      <PillButton label="Other" selected={form.contactMethod === 'other'} onClick={() => setForm(p => ({ ...p, contactMethod: 'other' }))} />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="pt-4">
              <div className="rounded-xl p-[2px] feedback-shimmer-card">
                <button type="button" onClick={handleSubmit} disabled={submitting}
                  className="w-full rounded-[10px] px-6 py-3 text-sm font-bold tracking-wide text-white transition-all hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#16A34A' }}>
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : 'Submit feedback'}
                </button>
              </div>
              {submitError && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
