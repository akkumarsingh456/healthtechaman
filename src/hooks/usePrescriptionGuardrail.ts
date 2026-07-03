import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InventoryMatch {
  id: string;
  medicine_name: string;
  generic_name: string | null;
  category: string;
  quantity: number;
  unit: string;
  reorder_level: number;
  expiry_date: string | null;
}

export interface GuardrailResult {
  status: "idle" | "checking" | "ok" | "warning" | "danger";
  allergyConflict: string | null;
  stockIssue: "none" | "out_of_stock" | "low_stock" | "expired" | null;
  matched: InventoryMatch | null;
  alternative: InventoryMatch | null;
  messages: string[];
}

const IDLE: GuardrailResult = {
  status: "idle",
  allergyConflict: null,
  stockIssue: null,
  matched: null,
  alternative: null,
  messages: [],
};

// Resolve the student's allergies once per patientId
export function usePatientAllergies(patientId: string | undefined) {
  return useQuery({
    queryKey: ["patient-allergies", patientId],
    enabled: !!patientId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .or(`id.eq.${patientId},user_id.eq.${patientId}`)
        .maybeSingle();
      const studentId = student?.id;
      if (!studentId) return { allergiesText: "", allergyTokens: [] as string[] };

      const { data: profile } = await supabase
        .from("student_profiles")
        .select("known_allergies")
        .eq("student_id", studentId)
        .maybeSingle();

      const raw = (profile?.known_allergies ?? "").toString();
      const tokens = raw
        .toLowerCase()
        .split(/[,;\n/|]+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !/^(none|nil|n\/a|no)$/.test(t));
      return { allergiesText: raw, allergyTokens: tokens };
    },
  });
}

function useDebounced<T>(value: T, delay = 350) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

function normalize(name: string) {
  // strip strength suffix like "500mg", "10 mg", etc.
  return name
    .toLowerCase()
    .replace(/\b\d+(\.\d+)?\s*(mg|mcg|ml|g|iu|%)\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function usePrescriptionGuardrail(
  medicineName: string,
  patientId: string | undefined
): GuardrailResult {
  const debounced = useDebounced(medicineName.trim(), 350);
  const { data: allergyData } = usePatientAllergies(patientId);

  const { data: match } = useQuery({
    queryKey: ["guardrail-inventory-match", debounced],
    enabled: debounced.length >= 2,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const q = normalize(debounced);
      if (!q) return null;
      const first = q.split(" ")[0];
      const { data } = await supabase
        .from("pharmacy_inventory")
        .select("id,medicine_name,generic_name,category,quantity,unit,reorder_level,expiry_date")
        .or(`medicine_name.ilike.%${first}%,generic_name.ilike.%${first}%`)
        .limit(1);
      return (data?.[0] as InventoryMatch) ?? null;
    },
  });

  const { data: alternative } = useQuery({
    queryKey: ["guardrail-alternative", match?.category, allergyData?.allergyTokens?.join("|")],
    enabled: !!match?.category,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("pharmacy_inventory")
        .select("id,medicine_name,generic_name,category,quantity,unit,reorder_level,expiry_date")
        .eq("category", match!.category)
        .gt("quantity", 0)
        .or(`expiry_date.is.null,expiry_date.gt.${today}`)
        .limit(20);
      const tokens = allergyData?.allergyTokens ?? [];
      const safe = (data ?? []).filter((row) => {
        if (row.id === match!.id) return false;
        const nm = normalize(row.medicine_name);
        const gn = normalize(row.generic_name ?? "");
        return !tokens.some((t) => nm.includes(t) || (gn && gn.includes(t)));
      });
      return (safe[0] as InventoryMatch) ?? null;
    },
  });

  if (!debounced || debounced.length < 2) return IDLE;

  const tokens = allergyData?.allergyTokens ?? [];
  const nName = normalize(debounced);
  const nMatchName = match ? normalize(match.medicine_name) : "";
  const nMatchGeneric = match?.generic_name ? normalize(match.generic_name) : "";

  let allergyConflict: string | null = null;
  for (const t of tokens) {
    if (nName.includes(t) || (nMatchName && nMatchName.includes(t)) || (nMatchGeneric && nMatchGeneric.includes(t))) {
      allergyConflict = t;
      break;
    }
  }

  let stockIssue: GuardrailResult["stockIssue"] = null;
  if (match) {
    const today = new Date().toISOString().slice(0, 10);
    if (match.expiry_date && match.expiry_date <= today) stockIssue = "expired";
    else if (match.quantity <= 0) stockIssue = "out_of_stock";
    else if (match.quantity <= match.reorder_level) stockIssue = "low_stock";
    else stockIssue = "none";
  }

  const messages: string[] = [];
  if (allergyConflict) {
    messages.push(`Patient is allergic to "${allergyConflict}". Do NOT prescribe.`);
  }
  if (stockIssue === "expired") messages.push(`Pharmacy stock expired (${match?.expiry_date}).`);
  else if (stockIssue === "out_of_stock") messages.push(`Out of stock in pharmacy.`);
  else if (stockIssue === "low_stock")
    messages.push(`Low stock: only ${match?.quantity} ${match?.unit ?? "units"} left.`);

  const status: GuardrailResult["status"] = allergyConflict
    ? "danger"
    : stockIssue === "expired" || stockIssue === "out_of_stock"
    ? "danger"
    : stockIssue === "low_stock"
    ? "warning"
    : match
    ? "ok"
    : "checking";

  return {
    status,
    allergyConflict,
    stockIssue,
    matched: match ?? null,
    alternative: alternative ?? null,
    messages,
  };
}