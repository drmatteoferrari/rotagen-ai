import { useState } from "react";
import { useSurveyContext, type SpecialtyEntry } from "@/contexts/SurveyContext";
import { StepNav } from "@/components/survey/StepNav";
import { SurveySection } from "@/components/survey/SurveySection";
import { InfoBox } from "@/components/survey/InfoBox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Star, Info } from "lucide-react";

const SPECIALTIES = [
  "Paediatric", "Obstetric", "Cardiothoracic", "Neuro", "Vascular",
  "T&O and regional anaesthesia", "ENT and maxillofacial", "Ophthalmology",
  "Plastics and reconstructive", "Gynaecology", "Urology", "Hepatobiliary",
  "Breast surgery", "Remote anaesthesia (MRI, radiology, cardioversions)",
];

const SPECIAL_SESSION_OPTIONS = ["Pain medicine", "Pre-op clinics", "Other"];

export default function SurveyStep6() {
  const ctx = useSurveyContext();
  const [otherSession, setOtherSession] = useState("");

  if (!ctx) return null;
  const { formData, setField } = ctx;

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

  const toggleSession = (session: string, checked: boolean) => {
    if (checked) {
      setField("specialSessions", [...formData.specialSessions, session]);
    } else {
      setField("specialSessions", formData.specialSessions.filter((s) => s !== session));
    }
  };

  const handleNext = () => ctx.nextStep();

  return (
    <>
      <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 pb-4 space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs sm:text-sm font-medium text-teal-700">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-teal-600" />
          Optional preferences — these help but are not guaranteed.
        </div>

        <Card>
          <CardHeader className="px-3 sm:px-6 py-3 sm:py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-5 w-5 text-teal-600" />
              Preferences & Sessions
            </CardTitle>
            <CardDescription className="text-xs">Specialty preferences, sessions, and sign-off needs.</CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6 space-y-4">
            {/* Specialty Preferences */}
            <SurveySection number={1} title="Specialty Preferences">
              <div className="space-y-2">
                <InfoBox type="info">Soft preferences — too many may dilute weight.</InfoBox>
                <div className="grid grid-cols-1 gap-2">
                  {SPECIALTIES.map((name) => (
                    <div key={name} className={`rounded-lg border p-2.5 transition-colors ${isSpecSelected(name) ? "border-teal-300 bg-teal-50" : "border-border"}`}>
                      <div className="flex items-center gap-2">
                        <Checkbox checked={isSpecSelected(name)} onCheckedChange={(v) => toggleSpec(name, !!v)} className="h-4 w-4" />
                        <span className="text-xs sm:text-sm text-card-foreground">{name}</span>
                      </div>
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

            {/* Special Sessions */}
            <SurveySection number={2} title="Special Sessions">
              <div className="space-y-2">
                {SPECIAL_SESSION_OPTIONS.map((s) => (
                  <div key={s}>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={s === "Other" ? formData.specialSessions.some((ss) => ss !== "Pain medicine" && ss !== "Pre-op clinics") : formData.specialSessions.includes(s)}
                        onCheckedChange={(v) => {
                          if (s === "Other") {
                            if (!v) {
                              setField("specialSessions", formData.specialSessions.filter((ss) => ss === "Pain medicine" || ss === "Pre-op clinics"));
                              setOtherSession("");
                            } else {
                              setField("specialSessions", [...formData.specialSessions, ""]);
                            }
                          } else {
                            toggleSession(s, !!v);
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-card-foreground">{s}</span>
                    </div>
                    {s === "Other" && formData.specialSessions.some((ss) => ss !== "Pain medicine" && ss !== "Pre-op clinics") && (
                      <Input
                        placeholder="Please specify"
                        value={otherSession}
                        onChange={(e) => {
                          setOtherSession(e.target.value);
                          const base = formData.specialSessions.filter((ss) => ss === "Pain medicine" || ss === "Pre-op clinics");
                          setField("specialSessions", e.target.value ? [...base, e.target.value] : [...base, ""]);
                        }}
                        className="bg-muted border-border ml-6 mt-1 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </SurveySection>

            {/* Sign-offs */}
            <SurveySection number={3} title="Sign-offs">
              <div>
                <label className="text-xs sm:text-sm font-semibold text-card-foreground block mb-1">Sign-offs needed this rotation</label>
                <Textarea
                  value={formData.signoffNeeds}
                  onChange={(e) => setField("signoffNeeds", e.target.value)}
                  placeholder="e.g. 10 T&O cases, 5 obstetric epidurals"
                  className="bg-muted border-border min-h-[50px] text-sm"
                />
              </div>
            </SurveySection>

            {/* Additional */}
            <SurveySection number={4} title="Additional Info">
              <div>
                <label className="text-xs sm:text-sm font-semibold text-card-foreground block mb-1">Anything else the coordinator should know</label>
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
