import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// ✅ Section 1 complete (migration ran separately)
// ✅ Section 2 complete

// === Types ===

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

export interface LeaveEntry {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface RotationEntry {
  id: string;
  startDate: string;
  endDate: string;
  location: string;
}

export interface LtftNightFlex {
  day: string;
  canStart: boolean | null;
  canEnd: boolean | null;
}

export interface SpecialtyEntry {
  name: string;
  notes: string;
}

export interface SurveyFormData {
  // Step 1
  fullName: string;
  nhsEmail: string;
  personalEmail: string;
  phoneNumber: string;
  grade: string;
  dualSpecialty: boolean;
  dualSpecialtyTypes: string[];

  // Step 2
  iacAchieved: boolean | null;
  iacWorkingTowards: boolean | null;
  iacRemoteSupervision: boolean | null;
  iaocAchieved: boolean | null;
  iaocWorkingTowards: boolean | null;
  iaocRemoteSupervision: boolean | null;
  icuAchieved: boolean | null;
  icuWorkingTowards: boolean | null;
  icuRemoteSupervision: boolean | null;
  transferAchieved: boolean | null;
  transferWorkingTowards: boolean | null;
  transferRemoteSupervision: boolean | null;

  // Step 3
  wtePercent: number;
  wteOtherValue: number | null;
  ltftDaysOff: string[];
  ltftNightFlexibility: LtftNightFlex[];

  // Step 4
  alEntitlement: number | null;
  annualLeave: LeaveEntry[];
  studyLeave: LeaveEntry[];
  nocDates: LeaveEntry[];
  rotations: RotationEntry[];

  // Step 5
  otherRestrictions: string;
  parentalLeaveExpected: boolean;
  parentalLeaveStart: string;
  parentalLeaveEnd: string;
  parentalLeaveNotes: string;
  otherSchedulingRestrictions: string;

  // Step 6
  specialtiesRequested: SpecialtyEntry[];
  specialSessions: string[];
  signoffNeeds: string;
  additionalNotes: string;
  confirmedAccurate: boolean;
  confirmAlgorithmUnderstood: boolean;
  confirmExemptionsUnderstood: boolean;
  confirmFairnessUnderstood: boolean;
  signatureName: string;
  signatureDate: string;
}

const DEFAULT_FORM_DATA: SurveyFormData = {
  fullName: "",
  nhsEmail: "",
  personalEmail: "",
  phoneNumber: "",
  grade: "",
  dualSpecialty: false,
  dualSpecialtyTypes: [],
  iacAchieved: null,
  iacWorkingTowards: null,
  iacRemoteSupervision: null,
  iaocAchieved: null,
  iaocWorkingTowards: null,
  iaocRemoteSupervision: null,
  icuAchieved: null,
  icuWorkingTowards: null,
  icuRemoteSupervision: null,
  transferAchieved: null,
  transferWorkingTowards: null,
  transferRemoteSupervision: null,
  wtePercent: 100,
  wteOtherValue: null,
  ltftDaysOff: [],
  ltftNightFlexibility: [],
  alEntitlement: null,
  annualLeave: [],
  studyLeave: [],
  nocDates: [],
  rotations: [],
  otherRestrictions: "",
  parentalLeaveExpected: false,
  parentalLeaveStart: "",
  parentalLeaveEnd: "",
  parentalLeaveNotes: "",
  otherSchedulingRestrictions: "",
  specialtiesRequested: [],
  specialSessions: [],
  signoffNeeds: "",
  additionalNotes: "",
  confirmedAccurate: false,
  confirmAlgorithmUnderstood: false,
  confirmExemptionsUnderstood: false,
  confirmFairnessUnderstood: false,
  signatureName: "",
  signatureDate: "",
};

type LoadState = "loading" | "error" | "submitted" | "ready";
// ✅ Section 4 complete — SaveStatus type
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SurveyContextType {
  loadState: LoadState;
  errorMessage: string;
  doctor: SurveyDoctorInfo | null;
  rotaInfo: SurveyRotaInfo | null;
  formData: SurveyFormData;
  currentStep: number;
  setField: <K extends keyof SurveyFormData>(key: K, value: SurveyFormData[K]) => void;
  setFields: (partial: Partial<SurveyFormData>) => void;
  setStep: (n: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  submitSurvey: () => Promise<boolean>;
  saveDraft: () => Promise<void>;
  submitting: boolean;
  submitError: string;
  draftSavedAt: Date | null;
  submittedAt: string | null;
  setSubmittedAt: (v: string | null) => void;
  setLoadState: (s: LoadState) => void;
  saveStatus: SaveStatus;
}

const SurveyContext = createContext<SurveyContextType | null>(null);

// === Mapping helpers ===

function formDataToDbRow(fd: SurveyFormData) {
  const competencies_json = {
    iac: { achieved: fd.iacAchieved, workingTowards: fd.iacWorkingTowards, remoteSupervision: fd.iacRemoteSupervision },
    iaoc: { achieved: fd.iaocAchieved, workingTowards: fd.iaocWorkingTowards, remoteSupervision: fd.iaocRemoteSupervision },
    icu: { achieved: fd.icuAchieved, workingTowards: fd.icuWorkingTowards, remoteSupervision: fd.icuRemoteSupervision },
    transfer: { achieved: fd.transferAchieved, workingTowards: fd.transferWorkingTowards, remoteSupervision: fd.transferRemoteSupervision },
  };

  return {
    full_name: fd.fullName,
    nhs_email: fd.nhsEmail,
    personal_email: fd.personalEmail,
    phone_number: fd.phoneNumber,
    grade: fd.grade,
    dual_specialty: fd.dualSpecialty,
    dual_specialty_types: fd.dualSpecialtyTypes,
    competencies_json: competencies_json as any,
    wte_percent: fd.wtePercent === 0 ? fd.wteOtherValue : fd.wtePercent,
    wte_other_value: fd.wteOtherValue,
    ltft_days_off: fd.ltftDaysOff,
    ltft_night_flexibility: fd.ltftNightFlexibility as any,
    al_entitlement: fd.alEntitlement,
    annual_leave: fd.annualLeave as any,
    study_leave: fd.studyLeave as any,
    noc_dates: fd.nocDates as any,
    other_unavailability: fd.rotations as any,
    other_restrictions: fd.otherRestrictions,
    parental_leave_expected: fd.parentalLeaveExpected,
    parental_leave_start: fd.parentalLeaveStart || null,
    parental_leave_end: fd.parentalLeaveEnd || null,
    parental_leave_notes: fd.parentalLeaveNotes,
    additional_restrictions: fd.otherSchedulingRestrictions,
    specialties_requested: fd.specialtiesRequested as any,
    special_sessions: fd.specialSessions,
    signoff_needs: fd.signoffNeeds,
    additional_notes: fd.additionalNotes,
    confirmed_accurate: fd.confirmedAccurate,
  };
}

function dbRowToFormData(draft: any, base: SurveyFormData): SurveyFormData {
  const cj = draft.competencies_json || {};
  return {
    ...base,
    fullName: draft.full_name || base.fullName,
    nhsEmail: draft.nhs_email || base.nhsEmail,
    personalEmail: draft.personal_email || "",
    phoneNumber: draft.phone_number || "",
    grade: draft.grade || base.grade,
    dualSpecialty: draft.dual_specialty || false,
    dualSpecialtyTypes: draft.dual_specialty_types || [],
    iacAchieved: cj.iac?.achieved ?? null,
    iacWorkingTowards: cj.iac?.workingTowards ?? null,
    iacRemoteSupervision: cj.iac?.remoteSupervision ?? null,
    iaocAchieved: cj.iaoc?.achieved ?? null,
    iaocWorkingTowards: cj.iaoc?.workingTowards ?? null,
    iaocRemoteSupervision: cj.iaoc?.remoteSupervision ?? null,
    icuAchieved: cj.icu?.achieved ?? null,
    icuWorkingTowards: cj.icu?.workingTowards ?? null,
    icuRemoteSupervision: cj.icu?.remoteSupervision ?? null,
    transferAchieved: cj.transfer?.achieved ?? null,
    transferWorkingTowards: cj.transfer?.workingTowards ?? null,
    transferRemoteSupervision: cj.transfer?.remoteSupervision ?? null,
    wtePercent: draft.wte_percent != null ? Number(draft.wte_percent) : 100,
    wteOtherValue: draft.wte_other_value != null ? Number(draft.wte_other_value) : null,
    ltftDaysOff: draft.ltft_days_off || [],
    ltftNightFlexibility: draft.ltft_night_flexibility || [],
    alEntitlement: draft.al_entitlement ?? null,
    annualLeave: draft.annual_leave || [],
    studyLeave: draft.study_leave || [],
    nocDates: draft.noc_dates || [],
    rotations: draft.other_unavailability || [],
    otherRestrictions: draft.other_restrictions || "",
    parentalLeaveExpected: draft.parental_leave_expected || false,
    parentalLeaveStart: draft.parental_leave_start || "",
    parentalLeaveEnd: draft.parental_leave_end || "",
    parentalLeaveNotes: draft.parental_leave_notes || "",
    otherSchedulingRestrictions: draft.additional_restrictions || "",
    specialtiesRequested: draft.specialties_requested || [],
    specialSessions: draft.special_sessions || [],
    signoffNeeds: draft.signoff_needs || "",
    additionalNotes: draft.additional_notes || "",
    confirmedAccurate: draft.confirmed_accurate || false,
    confirmAlgorithmUnderstood: false,
    confirmExemptionsUnderstood: false,
    confirmFairnessUnderstood: false,
    signatureName: "",
    signatureDate: "",
  };
}

// === Provider ===

export function SurveyProvider({ token, children }: { token: string | null; children: ReactNode }) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [doctor, setDoctor] = useState<SurveyDoctorInfo | null>(null);
  const [rotaInfo, setRotaInfo] = useState<SurveyRotaInfo | null>(null);
  const [formData, setFormData] = useState<SurveyFormData>(DEFAULT_FORM_DATA);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const formDataRef = useRef(formData);
  const doctorRef = useRef(doctor);
  formDataRef.current = formData;
  doctorRef.current = doctor;

  // Token resolution
  useEffect(() => {
    if (!token) {
      setErrorMessage("This link is invalid. Contact your coordinator for a new link.");
      setLoadState("error");
      return;
    }
    resolveToken(token);
  }, [token]);

  const resolveToken = async (t: string) => {
    setLoadState("loading");
    try {
      const { data: doctorRow, error } = await supabase
        .from("doctors")
        .select(`
          id, first_name, last_name, email, grade, survey_status, rota_config_id, survey_submitted_at,
          rota_configs!doctors_rota_config_id_fkey (
            rota_start_date, rota_end_date, rota_duration_weeks, department_name, trust_name, survey_deadline, owned_by
          )
        `)
        .eq("survey_token", t)
        .maybeSingle();

      if (error) throw error;
      if (!doctorRow) {
        setErrorMessage("This link is invalid. Contact your coordinator for a new link.");
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

      // Try to get account_settings for department/trust name
      let deptName = rc?.department_name ?? null;
      let trustName = rc?.trust_name ?? null;
      if (rc?.owned_by) {
        const { data: acct } = await supabase
          .from("account_settings")
          .select("department_name, trust_name")
          .eq("owned_by", rc.owned_by)
          .maybeSingle();
        if (acct) {
          deptName = acct.department_name || deptName;
          trustName = acct.trust_name || trustName;
        }
      }

      setRotaInfo({
        startDate: rc?.rota_start_date ?? null,
        endDate: rc?.rota_end_date ?? null,
        durationWeeks: rc?.rota_duration_weeks ?? null,
        departmentName: deptName,
        trustName: trustName,
        surveyDeadline: rc?.survey_deadline ?? null,
      });

      if (doctorRow.survey_status === "submitted") {
        setSubmittedAt(doctorRow.survey_submitted_at ?? new Date().toISOString());

        // Load submitted data for confirmation display
        const { data: draft } = await supabase
          .from("doctor_survey_responses")
          .select("*")
          .eq("doctor_id", doc.id)
          .eq("rota_config_id", doc.rotaConfigId)
          .maybeSingle();

        if (draft) {
          const initial: SurveyFormData = {
            ...DEFAULT_FORM_DATA,
            fullName: `${doc.firstName} ${doc.lastName}`,
            nhsEmail: doc.email ?? "",
            grade: doc.grade,
          };
          setFormData(dbRowToFormData(draft, initial));
        }

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
        fullName: `${doc.firstName} ${doc.lastName}`,
        nhsEmail: doc.email ?? "",
        grade: doc.grade,
      };

      if (draft) {
        setFormData(dbRowToFormData(draft, initial));
      } else {
        setFormData(initial);
      }

      setLoadState("ready");
    } catch (err) {
      console.error("Survey token resolution failed:", err);
      setErrorMessage("Something went wrong loading your survey. Please try refreshing the page.");
      setLoadState("error");
    }
  };

  // ✅ Section 4 complete — Auto-save with status indicator
  const saveDraft = useCallback(async () => {
    const doc = doctorRef.current;
    if (!doc) return;
    const fd = formDataRef.current;
    setSaveStatus('saving');
    try {
      const row = formDataToDbRow(fd);
      const { error } = await supabase
        .from("doctor_survey_responses")
        .upsert(
          {
            doctor_id: doc.id,
            rota_config_id: doc.rotaConfigId,
            ...row,
            status: "in_progress",
            last_saved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: "doctor_id,rota_config_id" }
        );
      if (error) throw error;

      await supabase
        .from("doctors")
        .update({ survey_status: "in_progress" })
        .eq("id", doc.id)
        .in("survey_status", ["not_started", "not_sent"]);

      setDraftSavedAt(new Date());
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error("Auto-save failed:", err);
      setSaveStatus('error');
    }
  }, []);

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

  const setStep = useCallback((n: number) => {
    setCurrentStep(Math.max(1, Math.min(6, n)));
  }, []);

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

  // Submission — Section 10
  const submitSurvey = useCallback(async (): Promise<boolean> => {
    const doc = doctorRef.current;
    if (!doc) return false;
    const fd = formDataRef.current;

    setSubmitting(true);
    setSubmitError("");

    try {
      const now = new Date().toISOString();
      const row = formDataToDbRow(fd);
      const { error: respErr } = await supabase
        .from("doctor_survey_responses")
        .upsert(
          {
            doctor_id: doc.id,
            rota_config_id: doc.rotaConfigId,
            ...row,
            status: "submitted",
            submitted_at: now,
            last_saved_at: now,
            updated_at: now,
          } as any,
          { onConflict: "doctor_id,rota_config_id" }
        );
      if (respErr) throw respErr;

      const { error: docErr } = await supabase
        .from("doctors")
        .update({ survey_status: "submitted", survey_submitted_at: now })
        .eq("id", doc.id);
      if (docErr) throw docErr;

      // Send confirmation email (non-blocking)
      try {
        const ri = rotaInfo;
        await supabase.functions.invoke("send-survey-confirmation", {
          body: {
            to: fd.nhsEmail,
            doctorName: fd.fullName,
            submittedAt: new Date().toLocaleString("en-GB"),
            departmentName: ri?.departmentName || "—",
            hospitalName: ri?.trustName || "—",
            rotaStartDate: ri?.startDate || "TBC",
            rotaEndDate: ri?.endDate || "TBC",
            surveyDeadline: ri?.surveyDeadline || "TBC",
            workingPattern: fd.wtePercent === 100
              ? "Full-time (100%)"
              : `${fd.wtePercent === 0 ? fd.wteOtherValue : fd.wtePercent}% LTFT${fd.ltftDaysOff.length ? ` (${fd.ltftDaysOff.join(", ")} off)` : ""}`,
            annualLeaveSummary: fd.annualLeave.length
              ? `${fd.annualLeave.length} period(s)`
              : "None entered",
            studyLeaveSummary: fd.studyLeave.length
              ? `${fd.studyLeave.length} period(s)`
              : "None entered",
            nocSummary: fd.nocDates.length
              ? `${fd.nocDates.length} date(s)/period(s)`
              : "None",
            parentalLeave: fd.parentalLeaveExpected
              ? `${fd.parentalLeaveStart} to ${fd.parentalLeaveEnd}`
              : "None",
          },
        });
      } catch (emailErr) {
        console.error("Confirmation email failed (non-blocking):", emailErr);
      }

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
  }, [rotaInfo]);

  // ✅ Section 10 complete

  return (
    <SurveyContext.Provider
      value={{
        loadState, errorMessage, doctor, rotaInfo, formData, currentStep,
        setField, setFields, setStep, nextStep, prevStep, goToStep,
        submitSurvey, saveDraft, submitting, submitError, draftSavedAt, submittedAt,
        setSubmittedAt, setLoadState, saveStatus,
      }}
    >
      {children}
    </SurveyContext.Provider>
  );
}

export function useSurveyContext() {
  return useContext(SurveyContext);
}
