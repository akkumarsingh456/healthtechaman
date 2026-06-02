import { useEffect, useState } from 'react';
import { useUserRole } from './useUserRole';
import { supabase } from '@/integrations/supabase/client';

interface StudentAutoFillData {
  full_name: string;
  email: string;
  roll_number: string;
  program: string;
  branch: string;
  phone: string;
  batch: string;
  year_of_study: string;
  blood_group: string;
  known_allergies: string;
  current_medications: string;
  covid_vaccination_status: string;
  emergency_contact: string;
  father_name: string;
  mother_name: string;
}

interface UseStudentAutoFillReturn {
  studentData: StudentAutoFillData | null;
  loading: boolean;
  error: string | null;
}

/**
 * HOOK: useStudentAutoFill
 * 
 * Fetches and merges student data from multiple Supabase tables:
 * ✅ students table (name, email, roll_number, program, branch, phone, batch, year)
 * ✅ student_profiles table (blood_group, allergies, medications, COVID status, emergency contacts)
 * ✅ auth.users metadata
 * 
 * Used for auto-filling profile forms with existing signup data
 * Works for ALL students (new & old)
 */

export function useStudentAutoFill(): UseStudentAutoFillReturn {
  const { user, loading: userLoading } = useUserRole();
  const [studentData, setStudentData] = useState<StudentAutoFillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    const fetchAutoFillData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch from students table — use maybeSingle so a transient empty
        // result never throws and wipes previously loaded data.
        const { data: studentRecord, error: studentError } = await supabase
          .from('students')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (studentError && studentError.code !== 'PGRST116') {
          throw studentError;
        }

        if (!studentRecord) {
          setLoading(false);
          return;
        }

        // Fetch from student_profiles table
        const { data: profileRecord, error: profileError } = await supabase
          .from('student_profiles')
          .select('*')
          .eq('student_id', studentRecord.id)
          .maybeSingle();

        if (profileError && profileError.code !== 'PGRST116') {
          throw profileError;
        }

        // Merge data from both tables
        const mergedData: StudentAutoFillData = {
          full_name: studentRecord.full_name || '',
          email: studentRecord.email || user.email || '',
          roll_number: studentRecord.roll_number || '',
          program: studentRecord.program || '',
          branch: studentRecord.branch || '',
          phone: studentRecord.phone || '',
          batch: studentRecord.batch || '',
          year_of_study: studentRecord.year_of_study || '',
          blood_group: profileRecord?.blood_group || '',
          known_allergies: profileRecord?.known_allergies || '',
          current_medications: profileRecord?.current_medications || '',
          covid_vaccination_status: profileRecord?.covid_vaccination_status || '',
          emergency_contact: profileRecord?.emergency_contact || '',
          father_name: profileRecord?.father_name || '',
          mother_name: profileRecord?.mother_name || '',
        };

        setStudentData(mergedData);
      } catch (err: any) {
        console.error('Error fetching auto-fill data:', err);
        setError(err.message || 'Failed to load student data');
      } finally {
        setLoading(false);
      }
    };

    fetchAutoFillData();
  }, [user, userLoading]);

  return { studentData, loading, error };
}

/**
 * HELPER FUNCTION: getAutoFillValues
 * 
 * Takes merged student data and returns a clean object ready for form fields
 * Use this to populate form state
 */
export function getAutoFillValues(studentData: StudentAutoFillData): Record<string, string> {
  return {
    full_name: studentData.full_name,
    email: studentData.email,
    roll_number: studentData.roll_number,
    program: studentData.program,
    branch: studentData.branch,
    phone: studentData.phone,
    batch: studentData.batch,
    year_of_study: studentData.year_of_study,
    blood_group: studentData.blood_group,
    known_allergies: studentData.known_allergies,
    current_medications: studentData.current_medications,
    covid_vaccination_status: studentData.covid_vaccination_status,
    emergency_contact: studentData.emergency_contact,
    father_name: studentData.father_name,
    mother_name: studentData.mother_name,
  };
}
