import { useSurveyContext, type SpecialtyEntry } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { InfoBox } from "@/components/survey/InfoBox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Star } from "lucide-react";

const SPECIALTIES = [
  "Paediatric", "Obstetric", "Cardiothoracic", "Neuro", "Vascular",
  "T&O and regional anaesthesia", "ENT and maxillofacial", "Ophthalmology",
  "Plastics and reconstructive", "Gynaecology", "Urology", "Hepatobiliary",
  "Breast surgery", "Remote anaesthesia (MRI, radiology, cardioversions)",
  "Other (please specify)",
];

const SPECIAL_SESSION_OPTIONS = ["Pain medicine", "Pre-op clinics", "Other"];

const OTHER_INTEREST_OPTIONS = ["Research", "Audit / QIP", "Teaching", "Simulation", "Other"];

export default function SurveyStep6() {
  const ctx = useSurveyContext();

  if (!ctx) return null;
  const { formData, setField } = ctx;

  // Specialty helpers
  const isSpecSelected = (name: string) => formData.specialtiesRequested.some((s) => s.name === name);
  const getSpecNotes = (name: string) => formData.specialtiesRequested.find((s) => s.name === name)?.notes || "";

  const toggleSpec = (name: string, checked: boolean) => {
    if (checked) {
      setField("specialtiesRequested", [...formData.specialtiesRequested, { name, notes: "" }]);
    } else {
      setField("specialtiesRequested", formData.specialtiesRequested.filter((s) => s.name !== name));
    }
  };

  const updateSpecNotes = (name: string, notes: string) => {
    setField("specialtiesRequested", formData.specialtiesRequested.map((s) =>
      s.name === name ? { ...s, notes } : s
    ));
  };

  // Session helpers
  const isSessionSelected = (name: string) =>
    formData.specialSessions.some((s) => s.name === name);
  const getSessionNotes = (name: string) =>
    formData.specialSessions.find((s) => s.name === name)?.notes || "";
  const toggleSession = (name: string, checked: boolean) => {
    if (checked) {
      setField("specialSessions", [...formData.specialSessions, { name, notes: "" }]);
    } else {
      setField("specialSessions", formData.specialSessions.filter((s) => s.name !== name));
    }
  };
  const updateSessionNotes = (name: string, notes: string) => {
    setField("specialSessions", formData.specialSessions.map((s) =>
      s.name === name ? { ...s, notes } : s
    ));
  };

  // Other Interests helpers
  const isInterestSelected = (name: string) =>
    formData.otherInterests.some((s) => s.name === name);
  const getInterestNotes = (name: string) =>
    formData.otherInterests.find((s) => s.name === name)?.notes || "";
  const toggleInterest = (name: string, checked: boolean) => {
    if (checked) {
      setField("otherInterests", [...formData.otherInterests, { name, notes: "" }]);
    } else {
      setField("otherInterests", formData.otherInterests.filter((s) => s.name !== name));
    }
  };
  const updateInterestNotes = (name: string, notes: string) => {
    setField("otherInterests", formData.otherInterests.map((s) =>
      s.name === name ? { ...s, notes } : s
    ));
  };

  const handleNext = async () => {
    await ctx.nextStep();
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 space-y-4 sm:space-y-6">
        <Card className="bg-white shadow-sm">
          <CardHeader className="px-4 sm:px-6 py-4 sm:py-5">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Star className="h-5 w-5 text-teal-600" />
              Preferences & Sessions
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">Specialty preferences, sessions, and sign-off needs.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 space-y-4">
            {/* 1 — Specialty Preferences */}
            <SurveySection number={1} title="Specialty Preferences">
              <div className="space-y-2">
                <InfoBox type="info">Soft preferences — too many may dilute weight.</InfoBox>
                <div className="grid grid-cols-1 gap-2">
                  {SPECIALTIES.map((name) => (
                    <div key={name} className={`rounded-lg border px-3 sm:px-4 py-2.5 sm:py-3 transition-colors cursor-pointer ${isSpecSelected(name) ? "border-teal-300 bg-teal-50" : "border-border"}`}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={isSpecSelected(name)} onCheckedChange={(v) => toggleSpec(name, !!v)} className="h-4 w-4" />
                        <span className="text-sm sm:text-base text-card-foreground">{name}</span>
                      </label>
                      {isSpecSelected(name) && (
                        <Input
                          placeholder="Notes (optional)"
                          value={getSpecNotes(name)}
                          onChange={(e) => updateSpecNotes(name, e.target.value)}
                          className="mt-1.5 bg-muted border-border text-xs"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </SurveySection>

            {/* 2 — Special Sessions */}
            <SurveySection number={2} title="Special Sessions">
              <div className="space-y-2">
                {SPECIAL_SESSION_OPTIONS.map((name) => (
                  <div key={name} className={`rounded-lg border px-3 sm:px-4 py-2.5 sm:py-3 transition-colors cursor-pointer ${isSessionSelected(name) ? "border-teal-300 bg-teal-50" : "border-border"}`}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={isSessionSelected(name)} onCheckedChange={(v) => toggleSession(name, !!v)} className="h-4 w-4" />
                      <span className="text-sm sm:text-base text-card-foreground">{name}</span>
                    </label>
                    {isSessionSelected(name) && (
                      <Input
                        placeholder="Notes (optional)"
                        value={getSessionNotes(name)}
                        onChange={(e) => updateSessionNotes(name, e.target.value)}
                        className="mt-1.5 bg-muted border-border text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>
            </SurveySection>

            {/* 3 — Other Interests */}
            <SurveySection number={3} title="Other Interests">
              <div className="space-y-2">
                {OTHER_INTEREST_OPTIONS.map((name) => (
                  <div key={name} className={`rounded-lg border px-3 sm:px-4 py-2.5 sm:py-3 transition-colors cursor-pointer ${isInterestSelected(name) ? "border-teal-300 bg-teal-50" : "border-border"}`}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={isInterestSelected(name)} onCheckedChange={(v) => toggleInterest(name, !!v)} className="h-4 w-4" />
                      <span className="text-sm sm:text-base text-card-foreground">{name}</span>
                    </label>
                    {isInterestSelected(name) && (
                      <Input
                        placeholder="Notes (optional)"
                        value={getInterestNotes(name)}
                        onChange={(e) => updateInterestNotes(name, e.target.value)}
                        className="mt-1.5 bg-muted border-border text-xs"
                      />
                    )}
                  </div>
                ))}
              </div>
            </SurveySection>

            {/* 4 — Sign-offs */}
            <SurveySection number={4} title="Sign-offs needed this rotation">
              <div>
                <label className="text-sm sm:text-base font-semibold text-card-foreground block mb-1">Sign-offs needed</label>
                <Textarea
                  value={formData.signoffNeeds}
                  onChange={(e) => setField("signoffNeeds", e.target.value)}
                  placeholder="e.g. IAC, HALOs, Stages 1–3, Special interests, etc."
                  className="bg-muted border-border min-h-[50px] text-sm"
                />
              </div>
            </SurveySection>

            {/* 5 — Additional */}
            <SurveySection number={5} title="Additional Notes">
              <div>
                <label className="text-sm sm:text-base font-semibold text-card-foreground block mb-1">Anything else the coordinator should know</label>
                <Textarea
                  value={formData.additionalNotes}
                  onChange={(e) => setField("additionalNotes", e.target.value)}
                  placeholder="e.g. Returning from maternity leave — prefer lighter start."
                  className="bg-muted border-border min-h-[50px] text-sm"
                />
              </div>
            </SurveySection>
          </CardContent>
        </Card>
      </div>
      <StepNav onBack={() => ctx.prevStep()} onNext={handleNext} />
    </>
  );
}
