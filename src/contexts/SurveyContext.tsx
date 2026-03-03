import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// SECTION 3 — Survey context for doctor-facing survey
// SECTION 4 — Auto-save logic

export interface SurveyDoctorInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  grade: string;
  rotaConfigId: string;
}

export interface SurveyRotaInfo {
  startDate: string | null;
  endDate: string | null;
  durationWeeks: number | null;
  departmentName: string | null;
  trustName: string | null;
  surveyDeadline: string | null;
}

export interface SurveyFormData {
  // Step 1
  full_name: string;
  nhs_email: string;
  grade: string;
  specialty: string;
  // Step 2
  comp_ip_anaesthesia: boolean;
  comp_ip_anaesthesia_here: boolean;
  comp_obstetric: boolean;
  comp_obstetric_here: boolean;
  comp_icu: boolean;
  comp_icu_here: boolean;
  competencies_json: Record<string, any>;
  // Step 3
  wte_percent: number;
  wte_other_value: number | null;
  ltft_days_off: string[];
  ltft_night_flexibility: any[];
  // Step 4
  annual_leave: any[];
  study_leave: any[];
  noc_dates: any[];
  other_unavailability: any[];
  // Step 5
  exempt_from_nights: boolean;
  exempt_from_weekends: boolean;
  exempt_from_oncall: boolean;
  specific_days_off: string[];
  exemption_details: string;
  additional_restrictions: string;
  // Step 6
  preferred_shift_types: string[];
  preferred_days_off: string[];
  dates_to_avoid: string[];
  other_requests: string;
  specialties_requested: any[];
  want_pain_sessions: boolean;
  pain_session_notes: string;
  want_preop: boolean;
  signoff_requirements: string;
  // Confirmation
  confirmed_accurate: boolean;
  additional_notes: string;
}

const DEFAULT_FORM_DATA: SurveyFormData = {
  full_name: "",
  nhs_email: "",
  grade: "",
  specialty: "",
  comp_ip_anaesthesia: false,
  comp_ip_anaesthesia_here: false,
  comp_obstetric: false,
  comp_obstetric_here: false,
  comp_icu: false,
  comp_icu_here: false,
  competencies_json: {},
  wte_percent: 100,
  wte_other_value: null,
  ltft_days_off: [],
  ltft_night_flexibility: [],
  annual_leave: [],
  study_leave: [],
  noc_dates: [],
  other_unavailability: [],
  exempt_from_nights: false,
  exempt_from_weekends: false,
  exempt_from_oncall: false,
  specific_days_off: [],
  exemption_details: "",
  additional_restrictions: "",
  preferred_shift_types: [],
  preferred_days_off: [],
  dates_to_avoid: [],
  other_requests: "",
  specialties_requested: [],
  want_pain_sessions: false,
  pain_session_notes: "",
  want_preop: false,
  signoff_requirements: "",
  confirmed_accurate: false,
  additional_notes: "",
};

type LoadState = "loading" | "error" | "submitted" | "ready";

interface SurveyContextType {
  loadState: LoadState;
  errorMessage: string;
  doctor: SurveyDoctorInfo | null;
  rotaInfo: SurveyRotaInfo | null;
  formData: SurveyFormData;
  currentStep: number;
  setField: <K extends keyof SurveyFormData>(key: K, value: SurveyFormData[K]) => void;
  setFields: (partial: Partial<SurveyFormData>) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  submit: () => Promise<boolean>;
  submitting: boolean;
  submitError: string | null;
  draftSavedAt: string | null;
  submittedAt: string | null;
}

const SurveyContext = createContext<SurveyContextType | null>(null);

export function SurveyProvider({ token, children }: { token: string | null; children: ReactNode }) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [doctor, setDoctor] = useState<SurveyDoctorInfo | null>(null);
  const [rotaInfo, setRotaInfo] = useState<SurveyRotaInfo | null>(null);
  const [formData, setFormData] = useState<SurveyFormData>(DEFAULT_FORM_DATA);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  // Token resolution
  useEffect(() => {
    if (!token) {
      setErrorMessage("This survey link is invalid. Please use the link sent to you by your rota coordinator. If you need a new link, contact them directly.");
      setLoadState("error");
      return;
    }
    resolveToken(token);
  }, [token]);

  const resolveToken = async (t: string) => {
    setLoadState("loading");
    try {
      // Query doctor by token, join rota_configs
      const { data: doctorRow, error } = await supabase
        .from("doctors")
        .select(`
          id, first_name, last_name, email, grade, survey_status, rota_config_id, survey_submitted_at,
          rota_configs!doctors_rota_config_id_fkey (
            rota_start_date, rota_end_date, rota_duration_weeks, department_name, trust_name, survey_deadline
          )
        `)
        .eq("survey_token", t)
        .maybeSingle();

      if (error) throw error;

      if (!doctorRow) {
        setErrorMessage("This survey link has expired or is no longer valid. Please contact your rota coordinator for a new link.");
        setLoadState("error");
        return;
      }

      const doc: SurveyDoctorInfo = {
        id: doctorRow.id,
        firstName: doctorRow.first_name,
        lastName: doctorRow.last_name,
        email: doctorRow.email,
        grade: doctorRow.grade ?? "",
        rotaConfigId: doctorRow.rota_config_id,
      };
      setDoctor(doc);

      const rc = doctorRow.rota_configs as any;
      setRotaInfo({
        startDate: rc?.rota_start_date ?? null,
        endDate: rc?.rota_end_date ?? null,
        durationWeeks: rc?.rota_duration_weeks ?? null,
        departmentName: rc?.department_name ?? null,
        trustName: rc?.trust_name ?? null,
        surveyDeadline: rc?.survey_deadline ?? null,
      });

      if (doctorRow.survey_status === "submitted") {
        setSubmittedAt(doctorRow.survey_submitted_at ?? new Date().toISOString());
        setLoadState("submitted");
        return;
      }

      // Load existing draft
      const { data: draft } = await supabase
        .from("doctor_survey_responses")
        .select("*")
        .eq("doctor_id", doc.id)
        .eq("rota_config_id", doc.rotaConfigId)
        .maybeSingle();

      const initial: SurveyFormData = {
        ...DEFAULT_FORM_DATA,
        full_name: `${doc.firstName} ${doc.lastName}`,
        nhs_email: doc.email ?? "",
        grade: doc.grade,
      };

      if (draft) {
        // Populate from draft
        Object.keys(DEFAULT_FORM_DATA).forEach((key) => {
          const k = key as keyof SurveyFormData;
          if (draft[k] !== undefined && draft[k] !== null) {
            (initial as any)[k] = draft[k];
          }
        });
      }

      setFormData(initial);
      setLoadState("ready");
    } catch (err) {
      console.error("Survey token resolution failed:", err);
      setErrorMessage("Something went wrong loading your survey. Please try refreshing the page.");
      setLoadState("error");
    }
  };

  // Auto-save (debounced)
  const saveDraft = useCallback(async () => {
    if (!doctor) return;
    const fd = formDataRef.current;
    try {
      const { error } = await supabase
        .from("doctor_survey_responses")
        .upsert(
          {
            doctor_id: doctor.id,
            rota_config_id: doctor.rotaConfigId,
            ...fd,
            competencies_json: fd.competencies_json as any,
            ltft_night_flexibility: fd.ltft_night_flexibility as any,
            annual_leave: fd.annual_leave as any,
            study_leave: fd.study_leave as any,
            noc_dates: fd.noc_dates as any,
            other_unavailability: fd.other_unavailability as any,
            specialties_requested: fd.specialties_requested as any,
            status: "in_progress",
            last_saved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "doctor_id,rota_config_id" }
        );

      if (error) throw error;

      // Update doctor status if needed
      await supabase
        .from("doctors")
        .update({ survey_status: "in_progress" })
        .eq("id", doctor.id)
        .in("survey_status", ["not_started", "not_sent"]);

      setDraftSavedAt(new Date().toISOString());
      setTimeout(() => setDraftSavedAt(null), 2000);
    } catch (err) {
      console.error("Auto-save failed:", err);
    }
  }, [doctor]);

  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveDraft(), 1500);
  }, [saveDraft]);

  const setField = useCallback(<K extends keyof SurveyFormData>(key: K, value: SurveyFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  const setFields = useCallback((partial: Partial<SurveyFormData>) => {
    setFormData((prev) => ({ ...prev, ...partial }));
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  const nextStep = useCallback(() => {
    saveDraft();
    setCurrentStep((s) => Math.min(s + 1, 6));
  }, [saveDraft]);

  const prevStep = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 1));
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(Math.max(1, Math.min(6, step)));
  }, []);

  // Final submission
  const submit = useCallback(async (): Promise<boolean> => {
    if (!doctor) return false;
    const fd = formDataRef.current;

    // Validate
    if (!fd.full_name.trim()) { setSubmitError("Full name is required"); return false; }
    if (!fd.nhs_email.trim() || !fd.nhs_email.includes("@")) { setSubmitError("A valid NHS email is required"); return false; }
    if (!fd.confirmed_accurate) { setSubmitError("Please confirm your responses are accurate"); return false; }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const now = new Date().toISOString();
      const { error: respErr } = await supabase
        .from("doctor_survey_responses")
        .upsert(
          {
            doctor_id: doctor.id,
            rota_config_id: doctor.rotaConfigId,
            ...fd,
            competencies_json: fd.competencies_json as any,
            ltft_night_flexibility: fd.ltft_night_flexibility as any,
            annual_leave: fd.annual_leave as any,
            study_leave: fd.study_leave as any,
            noc_dates: fd.noc_dates as any,
            other_unavailability: fd.other_unavailability as any,
            specialties_requested: fd.specialties_requested as any,
            status: "submitted",
            submitted_at: now,
            last_saved_at: now,
            updated_at: now,
          },
          { onConflict: "doctor_id,rota_config_id" }
        );

      if (respErr) throw respErr;

      const { error: docErr } = await supabase
        .from("doctors")
        .update({ survey_status: "submitted", survey_submitted_at: now })
        .eq("id", doctor.id);

      if (docErr) throw docErr;

      setSubmittedAt(now);
      setLoadState("submitted");
      return true;
    } catch (err) {
      console.error("Survey submission failed:", err);
      setSubmitError("Submission failed — please try again. If this persists, contact your coordinator.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [doctor]);

  return (
    <SurveyContext.Provider
      value={{
        loadState, errorMessage, doctor, rotaInfo, formData, currentStep,
        setField, setFields, nextStep, prevStep, goToStep,
        submit, submitting, submitError, draftSavedAt, submittedAt,
      }}
    >
      {children}
    </SurveyContext.Provider>
  );
}

export function useSurveyContext() {
  return useContext(SurveyContext);
}

// SECTION 3 COMPLETE
// SECTION 4 COMPLETE
// SECTION 5 COMPLETE
