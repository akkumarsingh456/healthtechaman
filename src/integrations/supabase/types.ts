export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ambulance_requests: {
        Row: {
          accompanying_person: string | null
          accompanying_person_type: string | null
          actual_arrival_minutes: number | null
          ambulance_type: string
          arrived_at: string | null
          completed_at: string | null
          condition_during_transit: string | null
          created_at: string
          destination_hospital: string
          dispatched_at: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          estimated_arrival_minutes: number | null
          handover_notes: string | null
          hospital_arrival_at: string | null
          id: string
          medical_leave_request_id: string | null
          paramedic_instructions: string | null
          pickup_location: string
          priority_level: string
          receiving_doctor_name: string | null
          requesting_doctor_id: string | null
          special_equipment_needed: string[] | null
          status: string
          student_id: string
          triage_notes: string | null
          updated_at: string
        }
        Insert: {
          accompanying_person?: string | null
          accompanying_person_type?: string | null
          actual_arrival_minutes?: number | null
          ambulance_type: string
          arrived_at?: string | null
          completed_at?: string | null
          condition_during_transit?: string | null
          created_at?: string
          destination_hospital: string
          dispatched_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          estimated_arrival_minutes?: number | null
          handover_notes?: string | null
          hospital_arrival_at?: string | null
          id?: string
          medical_leave_request_id?: string | null
          paramedic_instructions?: string | null
          pickup_location?: string
          priority_level: string
          receiving_doctor_name?: string | null
          requesting_doctor_id?: string | null
          special_equipment_needed?: string[] | null
          status?: string
          student_id: string
          triage_notes?: string | null
          updated_at?: string
        }
        Update: {
          accompanying_person?: string | null
          accompanying_person_type?: string | null
          actual_arrival_minutes?: number | null
          ambulance_type?: string
          arrived_at?: string | null
          completed_at?: string | null
          condition_during_transit?: string | null
          created_at?: string
          destination_hospital?: string
          dispatched_at?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          estimated_arrival_minutes?: number | null
          handover_notes?: string | null
          hospital_arrival_at?: string | null
          id?: string
          medical_leave_request_id?: string | null
          paramedic_instructions?: string | null
          pickup_location?: string
          priority_level?: string
          receiving_doctor_name?: string | null
          requesting_doctor_id?: string | null
          special_equipment_needed?: string[] | null
          status?: string
          student_id?: string
          triage_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambulance_requests_medical_leave_request_id_fkey"
            columns: ["medical_leave_request_id"]
            isOneToOne: false
            referencedRelation: "medical_leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambulance_requests_requesting_doctor_id_fkey"
            columns: ["requesting_doctor_id"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambulance_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambulance_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_doctor_view"
            referencedColumns: ["id"]
          },
        ]
      }
      ambulance_service: {
        Row: {
          created_at: string | null
          description: string | null
          equipment: string[] | null
          id: string
          is_active: boolean | null
          phone_landline: string
          phone_mobile: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          equipment?: string[] | null
          id?: string
          is_active?: boolean | null
          phone_landline: string
          phone_mobile: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          equipment?: string[] | null
          id?: string
          is_active?: boolean | null
          phone_landline?: string
          phone_mobile?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          approved_at: string | null
          created_at: string | null
          denial_reason: string | null
          denied_at: string | null
          doctor_type: string
          health_priority: string | null
          id: string
          medical_officer_id: string | null
          needs_medical_leave: boolean | null
          notes: string | null
          patient_id: string
          reason: string | null
          status: Database["public"]["Enums"]["appointment_status"] | null
          updated_at: string | null
          visiting_doctor_id: string | null
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          approved_at?: string | null
          created_at?: string | null
          denial_reason?: string | null
          denied_at?: string | null
          doctor_type: string
          health_priority?: string | null
          id?: string
          medical_officer_id?: string | null
          needs_medical_leave?: boolean | null
          notes?: string | null
          patient_id: string
          reason?: string | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
          visiting_doctor_id?: string | null
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          approved_at?: string | null
          created_at?: string | null
          denial_reason?: string | null
          denied_at?: string | null
          doctor_type?: string
          health_priority?: string | null
          id?: string
          medical_officer_id?: string | null
          needs_medical_leave?: boolean | null
          notes?: string | null
          patient_id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
          visiting_doctor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_medical_officer_id_fkey"
            columns: ["medical_officer_id"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_visiting_doctor_id_fkey"
            columns: ["visiting_doctor_id"]
            isOneToOne: false
            referencedRelation: "visiting_doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          ai_validation_notes: string | null
          ai_validation_status: string | null
          branch: string | null
          college_name: string | null
          created_at: string
          email: string
          id: string
          is_read: boolean | null
          message: string
          name: string
          rating: number | null
          sender_role: string
          subject: string | null
          submission_type: string
          year: string | null
        }
        Insert: {
          ai_validation_notes?: string | null
          ai_validation_status?: string | null
          branch?: string | null
          college_name?: string | null
          created_at?: string
          email: string
          id?: string
          is_read?: boolean | null
          message: string
          name: string
          rating?: number | null
          sender_role?: string
          subject?: string | null
          submission_type?: string
          year?: string | null
        }
        Update: {
          ai_validation_notes?: string | null
          ai_validation_status?: string | null
          branch?: string | null
          college_name?: string | null
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean | null
          message?: string
          name?: string
          rating?: number | null
          sender_role?: string
          subject?: string | null
          submission_type?: string
          year?: string | null
        }
        Relationships: []
      }
      doctor_shifts: {
        Row: {
          created_at: string
          doctor_id: string
          end_time: string
          id: string
          is_modified: boolean | null
          modified_by: string | null
          notes: string | null
          shift_date: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          doctor_id: string
          end_time?: string
          id?: string
          is_modified?: boolean | null
          modified_by?: string | null
          notes?: string | null
          shift_date: string
          start_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          doctor_id?: string
          end_time?: string
          id?: string
          is_modified?: boolean | null
          modified_by?: string | null
          notes?: string | null
          shift_date?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctor_shifts_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctor_shifts_modified_by_fkey"
            columns: ["modified_by"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_handovers: {
        Row: {
          ambulance_request_id: string | null
          confirmed: boolean | null
          confirmed_at: string | null
          created_at: string
          current_status: string
          follow_up_instructions: string | null
          handover_from_doctor_id: string | null
          handover_to_doctor_id: string | null
          id: string
          pending_actions: string[] | null
        }
        Insert: {
          ambulance_request_id?: string | null
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string
          current_status: string
          follow_up_instructions?: string | null
          handover_from_doctor_id?: string | null
          handover_to_doctor_id?: string | null
          id?: string
          pending_actions?: string[] | null
        }
        Update: {
          ambulance_request_id?: string | null
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string
          current_status?: string
          follow_up_instructions?: string | null
          handover_from_doctor_id?: string | null
          handover_to_doctor_id?: string | null
          id?: string
          pending_actions?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_handovers_ambulance_request_id_fkey"
            columns: ["ambulance_request_id"]
            isOneToOne: false
            referencedRelation: "ambulance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_handovers_handover_from_doctor_id_fkey"
            columns: ["handover_from_doctor_id"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_handovers_handover_to_doctor_id_fkey"
            columns: ["handover_to_doctor_id"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_treatments: {
        Row: {
          ambulance_request_id: string | null
          created_at: string
          doctor_id: string | null
          id: string
          medication_given: string | null
          notes: string | null
          outcome: string | null
          procedure_performed: string | null
          requires_followup: boolean | null
          treatment_type: string
          vitals_recorded: Json | null
        }
        Insert: {
          ambulance_request_id?: string | null
          created_at?: string
          doctor_id?: string | null
          id?: string
          medication_given?: string | null
          notes?: string | null
          outcome?: string | null
          procedure_performed?: string | null
          requires_followup?: boolean | null
          treatment_type: string
          vitals_recorded?: Json | null
        }
        Update: {
          ambulance_request_id?: string | null
          created_at?: string
          doctor_id?: string | null
          id?: string
          medication_given?: string | null
          notes?: string | null
          outcome?: string | null
          procedure_performed?: string | null
          requires_followup?: boolean | null
          treatment_type?: string
          vitals_recorded?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_treatments_ambulance_request_id_fkey"
            columns: ["ambulance_request_id"]
            isOneToOne: false
            referencedRelation: "ambulance_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emergency_treatments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
        ]
      }
      empanelled_hospitals: {
        Row: {
          created_at: string
          empanelment_period: string | null
          entitlement: string
          id: string
          is_active: boolean
          location: string
          name: string
          serial_number: number
        }
        Insert: {
          created_at?: string
          empanelment_period?: string | null
          entitlement?: string
          id?: string
          is_active?: boolean
          location: string
          name: string
          serial_number: number
        }
        Update: {
          created_at?: string
          empanelment_period?: string | null
          entitlement?: string
          id?: string
          is_active?: boolean
          location?: string
          name?: string
          serial_number?: number
        }
        Relationships: []
      }
      health_share_recipients: {
        Row: {
          created_at: string
          email_error: string | null
          email_status: string
          files: Json
          id: string
          include_leave_certificate: boolean
          include_referral: boolean
          medical_leave_request_id: string | null
          message: string | null
          recipient_email: string
          recipient_name: string | null
          recipient_role: string
          sender_user_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          email_error?: string | null
          email_status?: string
          files?: Json
          id?: string
          include_leave_certificate?: boolean
          include_referral?: boolean
          medical_leave_request_id?: string | null
          message?: string | null
          recipient_email: string
          recipient_name?: string | null
          recipient_role: string
          sender_user_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          email_error?: string | null
          email_status?: string
          files?: Json
          id?: string
          include_leave_certificate?: boolean
          include_referral?: boolean
          medical_leave_request_id?: string | null
          message?: string | null
          recipient_email?: string
          recipient_name?: string | null
          recipient_role?: string
          sender_user_id?: string
          student_id?: string
        }
        Relationships: []
      }
      health_visits: {
        Row: {
          created_at: string
          diagnosis: string | null
          doctor_id: string | null
          follow_up_date: string | null
          follow_up_required: boolean | null
          id: string
          prescription: string | null
          reason_category: Database["public"]["Enums"]["visit_reason"]
          reason_notes: string | null
          reason_subcategory: string | null
          student_id: string
          updated_at: string
          visit_date: string
        }
        Insert: {
          created_at?: string
          diagnosis?: string | null
          doctor_id?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          prescription?: string | null
          reason_category: Database["public"]["Enums"]["visit_reason"]
          reason_notes?: string | null
          reason_subcategory?: string | null
          student_id: string
          updated_at?: string
          visit_date?: string
        }
        Update: {
          created_at?: string
          diagnosis?: string | null
          doctor_id?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          prescription?: string | null
          reason_category?: Database["public"]["Enums"]["visit_reason"]
          reason_notes?: string | null
          reason_subcategory?: string | null
          student_id?: string
          updated_at?: string
          visit_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_visits_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_visits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_visits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_doctor_view"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_reports: {
        Row: {
          created_at: string
          doctor_id: string | null
          id: string
          notes: string | null
          prescription_id: string | null
          report_file_name: string | null
          report_file_url: string | null
          status: string
          student_id: string
          test_name: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          doctor_id?: string | null
          id?: string
          notes?: string | null
          prescription_id?: string | null
          report_file_name?: string | null
          report_file_url?: string | null
          status?: string
          student_id: string
          test_name: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          doctor_id?: string | null
          id?: string
          notes?: string | null
          prescription_id?: string | null
          report_file_name?: string | null
          report_file_url?: string | null
          status?: string
          student_id?: string
          test_name?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_reports_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_reports_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_doctor_view"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_approval_workflow: {
        Row: {
          bypass_reason: string | null
          bypass_witness: string | null
          created_at: string
          current_approval_level: number
          id: string
          is_emergency_bypass: boolean | null
          level1_approved_at: string | null
          level1_approved_by: string | null
          level1_notes: string | null
          level2_approved_at: string | null
          level2_approved_by: string | null
          level2_notes: string | null
          level2_required: boolean | null
          level3_approved_at: string | null
          level3_approved_by: string | null
          level3_notes: string | null
          level3_required: boolean | null
          medical_leave_request_id: string
          rejection_reason: string | null
          required_approval_level: number
          status: string
          updated_at: string
        }
        Insert: {
          bypass_reason?: string | null
          bypass_witness?: string | null
          created_at?: string
          current_approval_level?: number
          id?: string
          is_emergency_bypass?: boolean | null
          level1_approved_at?: string | null
          level1_approved_by?: string | null
          level1_notes?: string | null
          level2_approved_at?: string | null
          level2_approved_by?: string | null
          level2_notes?: string | null
          level2_required?: boolean | null
          level3_approved_at?: string | null
          level3_approved_by?: string | null
          level3_notes?: string | null
          level3_required?: boolean | null
          medical_leave_request_id: string
          rejection_reason?: string | null
          required_approval_level?: number
          status?: string
          updated_at?: string
        }
        Update: {
          bypass_reason?: string | null
          bypass_witness?: string | null
          created_at?: string
          current_approval_level?: number
          id?: string
          is_emergency_bypass?: boolean | null
          level1_approved_at?: string | null
          level1_approved_by?: string | null
          level1_notes?: string | null
          level2_approved_at?: string | null
          level2_approved_by?: string | null
          level2_notes?: string | null
          level2_required?: boolean | null
          level3_approved_at?: string | null
          level3_approved_by?: string | null
          level3_notes?: string | null
          level3_required?: boolean | null
          medical_leave_request_id?: string
          rejection_reason?: string | null
          required_approval_level?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_approval_workflow_level1_approved_by_fkey"
            columns: ["level1_approved_by"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_approval_workflow_medical_leave_request_id_fkey"
            columns: ["medical_leave_request_id"]
            isOneToOne: false
            referencedRelation: "medical_leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      management_team: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          position: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          position: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          position?: string
        }
        Relationships: []
      }
      medical_leave_requests: {
        Row: {
          academic_leave_approved: boolean | null
          accompanist_contact: string | null
          accompanist_name: string | null
          accompanist_relationship: string | null
          accompanist_type: string | null
          actual_return_date: string | null
          appointment_id: string | null
          approval_date: string | null
          approved_by_doctor_id: string | null
          cleared_by_doctor_id: string | null
          created_at: string
          doctor_clearance: boolean | null
          doctor_clearance_date: string | null
          doctor_notes: string | null
          expected_duration: string
          expected_return_date: string | null
          follow_up_notes: string | null
          health_centre_visited: boolean | null
          health_priority: string | null
          hospital_discharge_date: string | null
          id: string
          illness_description: string | null
          leave_start_date: string | null
          referral_date: string | null
          referral_hospital: string
          referral_type: string[] | null
          referring_doctor_id: string | null
          rest_days: number | null
          return_submitted_at: string | null
          status: Database["public"]["Enums"]["medical_leave_status"]
          student_form_submitted_at: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          academic_leave_approved?: boolean | null
          accompanist_contact?: string | null
          accompanist_name?: string | null
          accompanist_relationship?: string | null
          accompanist_type?: string | null
          actual_return_date?: string | null
          appointment_id?: string | null
          approval_date?: string | null
          approved_by_doctor_id?: string | null
          cleared_by_doctor_id?: string | null
          created_at?: string
          doctor_clearance?: boolean | null
          doctor_clearance_date?: string | null
          doctor_notes?: string | null
          expected_duration: string
          expected_return_date?: string | null
          follow_up_notes?: string | null
          health_centre_visited?: boolean | null
          health_priority?: string | null
          hospital_discharge_date?: string | null
          id?: string
          illness_description?: string | null
          leave_start_date?: string | null
          referral_date?: string | null
          referral_hospital: string
          referral_type?: string[] | null
          referring_doctor_id?: string | null
          rest_days?: number | null
          return_submitted_at?: string | null
          status?: Database["public"]["Enums"]["medical_leave_status"]
          student_form_submitted_at?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          academic_leave_approved?: boolean | null
          accompanist_contact?: string | null
          accompanist_name?: string | null
          accompanist_relationship?: string | null
          accompanist_type?: string | null
          actual_return_date?: string | null
          appointment_id?: string | null
          approval_date?: string | null
          approved_by_doctor_id?: string | null
          cleared_by_doctor_id?: string | null
          created_at?: string
          doctor_clearance?: boolean | null
          doctor_clearance_date?: string | null
          doctor_notes?: string | null
          expected_duration?: string
          expected_return_date?: string | null
          follow_up_notes?: string | null
          health_centre_visited?: boolean | null
          health_priority?: string | null
          hospital_discharge_date?: string | null
          id?: string
          illness_description?: string | null
          leave_start_date?: string | null
          referral_date?: string | null
          referral_hospital?: string
          referral_type?: string[] | null
          referring_doctor_id?: string | null
          rest_days?: number | null
          return_submitted_at?: string | null
          status?: Database["public"]["Enums"]["medical_leave_status"]
          student_form_submitted_at?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_leave_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_leave_requests_approved_by_doctor_id_fkey"
            columns: ["approved_by_doctor_id"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_leave_requests_cleared_by_doctor_id_fkey"
            columns: ["cleared_by_doctor_id"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_leave_requests_referring_doctor_id_fkey"
            columns: ["referring_doctor_id"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_leave_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medical_leave_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_doctor_view"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_officers: {
        Row: {
          created_at: string | null
          designation: string
          email: string | null
          id: string
          is_senior: boolean | null
          name: string
          phone_mobile: string[] | null
          phone_office: string | null
          photo_url: string | null
          qualification: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          designation: string
          email?: string | null
          id?: string
          is_senior?: boolean | null
          name: string
          phone_mobile?: string[] | null
          phone_office?: string | null
          photo_url?: string | null
          qualification: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          designation?: string
          email?: string | null
          id?: string
          is_senior?: boolean | null
          name?: string
          phone_mobile?: string[] | null
          phone_office?: string | null
          photo_url?: string | null
          qualification?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      mentors: {
        Row: {
          created_at: string
          department: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          related_appointment_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          related_appointment_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          related_appointment_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_appointment_id_fkey"
            columns: ["related_appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_dispensing: {
        Row: {
          created_at: string
          dispensed_at: string | null
          dispensed_by: string
          id: string
          notes: string | null
          prescription_id: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dispensed_at?: string | null
          dispensed_by: string
          id?: string
          notes?: string | null
          prescription_id: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dispensed_at?: string | null
          dispensed_by?: string
          id?: string
          notes?: string | null
          prescription_id?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pharmacy_dispensing_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_dispensing_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharmacy_dispensing_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_doctor_view"
            referencedColumns: ["id"]
          },
        ]
      }
      pharmacy_inventory: {
        Row: {
          batch_number: string | null
          category: string | null
          created_at: string
          expiry_date: string | null
          generic_name: string | null
          id: string
          medicine_name: string
          notes: string | null
          quantity: number
          reorder_level: number | null
          supplier: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          batch_number?: string | null
          category?: string | null
          created_at?: string
          expiry_date?: string | null
          generic_name?: string | null
          id?: string
          medicine_name: string
          notes?: string | null
          quantity?: number
          reorder_level?: number | null
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          batch_number?: string | null
          category?: string | null
          created_at?: string
          expiry_date?: string | null
          generic_name?: string | null
          id?: string
          medicine_name?: string
          notes?: string | null
          quantity?: number
          reorder_level?: number | null
          supplier?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      prescription_items: {
        Row: {
          created_at: string
          dosage: string
          duration: string
          frequency: string
          id: string
          instructions: string | null
          meal_timing: string | null
          medicine_name: string
          prescription_id: string
        }
        Insert: {
          created_at?: string
          dosage: string
          duration: string
          frequency: string
          id?: string
          instructions?: string | null
          meal_timing?: string | null
          medicine_name: string
          prescription_id: string
        }
        Update: {
          created_at?: string
          dosage?: string
          duration?: string
          frequency?: string
          id?: string
          instructions?: string | null
          meal_timing?: string | null
          medicine_name?: string
          prescription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          appointment_id: string
          created_at: string
          diagnosis: string | null
          doctor_id: string | null
          id: string
          notes: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          diagnosis?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          diagnosis?: string | null
          doctor_id?: string | null
          id?: string
          notes?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
        ]
      }
      priority_assessments: {
        Row: {
          ambulance_required: boolean | null
          ambulance_type_recommended: string | null
          assessing_doctor_id: string | null
          clinical_notes: string | null
          created_at: string
          exams_affected: string[] | null
          id: string
          labs_affected: string[] | null
          leave_duration_category: string | null
          leave_required: boolean | null
          medical_leave_request_id: string | null
          modified_academic_plan: Json | null
          priority_level: string
          recommended_leave_days: number | null
          special_accommodations: string[] | null
          student_id: string
          symptoms: string[]
          updated_at: string
          vital_signs: Json | null
        }
        Insert: {
          ambulance_required?: boolean | null
          ambulance_type_recommended?: string | null
          assessing_doctor_id?: string | null
          clinical_notes?: string | null
          created_at?: string
          exams_affected?: string[] | null
          id?: string
          labs_affected?: string[] | null
          leave_duration_category?: string | null
          leave_required?: boolean | null
          medical_leave_request_id?: string | null
          modified_academic_plan?: Json | null
          priority_level: string
          recommended_leave_days?: number | null
          special_accommodations?: string[] | null
          student_id: string
          symptoms: string[]
          updated_at?: string
          vital_signs?: Json | null
        }
        Update: {
          ambulance_required?: boolean | null
          ambulance_type_recommended?: string | null
          assessing_doctor_id?: string | null
          clinical_notes?: string | null
          created_at?: string
          exams_affected?: string[] | null
          id?: string
          labs_affected?: string[] | null
          leave_duration_category?: string | null
          leave_required?: boolean | null
          medical_leave_request_id?: string | null
          modified_academic_plan?: Json | null
          priority_level?: string
          recommended_leave_days?: number | null
          special_accommodations?: string[] | null
          student_id?: string
          symptoms?: string[]
          updated_at?: string
          vital_signs?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "priority_assessments_assessing_doctor_id_fkey"
            columns: ["assessing_doctor_id"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priority_assessments_medical_leave_request_id_fkey"
            columns: ["medical_leave_request_id"]
            isOneToOne: false
            referencedRelation: "medical_leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priority_assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priority_assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_doctor_view"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      shift_exchanges: {
        Row: {
          approved_at: string | null
          created_at: string
          exchange_reason: string | null
          id: string
          new_end_time: string
          new_start_time: string
          original_doctor_id: string
          original_end_time: string
          original_start_time: string
          replacement_doctor_id: string
          shift_date: string
          status: string
          transferred_appointments_count: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          exchange_reason?: string | null
          id?: string
          new_end_time: string
          new_start_time: string
          original_doctor_id: string
          original_end_time: string
          original_start_time: string
          replacement_doctor_id: string
          shift_date: string
          status?: string
          transferred_appointments_count?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          exchange_reason?: string | null
          id?: string
          new_end_time?: string
          new_start_time?: string
          original_doctor_id?: string
          original_end_time?: string
          original_start_time?: string
          replacement_doctor_id?: string
          shift_date?: string
          status?: string
          transferred_appointments_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_exchanges_original_doctor_id_fkey"
            columns: ["original_doctor_id"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_exchanges_replacement_doctor_id_fkey"
            columns: ["replacement_doctor_id"]
            isOneToOne: false
            referencedRelation: "medical_officers"
            referencedColumns: ["id"]
          },
        ]
      }
      student_profiles: {
        Row: {
          aadhar_number: string | null
          accuracy_confirmation: boolean | null
          blood_group: string | null
          cmo_email: string | null
          cmo_name: string | null
          code_of_conduct: boolean | null
          covid_vaccination_status: string | null
          created_at: string
          current_medications: string | null
          dean_email: string | null
          dean_name: string | null
          disability_details: string | null
          emergency_contact: string | null
          emergency_relationship: string | null
          father_contact: string | null
          father_name: string | null
          has_disability: boolean | null
          has_previous_health_issues: boolean | null
          hod_email: string | null
          hod_name: string | null
          id: string
          known_allergies: string | null
          medical_authorization: boolean | null
          mentor_email: string | null
          mother_contact: string | null
          mother_name: string | null
          photo_video_consent: boolean | null
          previous_health_details: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          aadhar_number?: string | null
          accuracy_confirmation?: boolean | null
          blood_group?: string | null
          cmo_email?: string | null
          cmo_name?: string | null
          code_of_conduct?: boolean | null
          covid_vaccination_status?: string | null
          created_at?: string
          current_medications?: string | null
          dean_email?: string | null
          dean_name?: string | null
          disability_details?: string | null
          emergency_contact?: string | null
          emergency_relationship?: string | null
          father_contact?: string | null
          father_name?: string | null
          has_disability?: boolean | null
          has_previous_health_issues?: boolean | null
          hod_email?: string | null
          hod_name?: string | null
          id?: string
          known_allergies?: string | null
          medical_authorization?: boolean | null
          mentor_email?: string | null
          mother_contact?: string | null
          mother_name?: string | null
          photo_video_consent?: boolean | null
          previous_health_details?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          aadhar_number?: string | null
          accuracy_confirmation?: boolean | null
          blood_group?: string | null
          cmo_email?: string | null
          cmo_name?: string | null
          code_of_conduct?: boolean | null
          covid_vaccination_status?: string | null
          created_at?: string
          current_medications?: string | null
          dean_email?: string | null
          dean_name?: string | null
          disability_details?: string | null
          emergency_contact?: string | null
          emergency_relationship?: string | null
          father_contact?: string | null
          father_name?: string | null
          has_disability?: boolean | null
          has_previous_health_issues?: boolean | null
          hod_email?: string | null
          hod_name?: string | null
          id?: string
          known_allergies?: string | null
          medical_authorization?: boolean | null
          mentor_email?: string | null
          mother_contact?: string | null
          mother_name?: string | null
          photo_video_consent?: boolean | null
          previous_health_details?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_profiles_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students_doctor_view"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          batch: string
          branch: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          mentor_contact: string | null
          mentor_email: string | null
          mentor_id: string | null
          mentor_name: string | null
          phone: string | null
          photo_url: string | null
          program: string
          roll_number: string
          updated_at: string
          user_id: string | null
          year_of_study: string | null
        }
        Insert: {
          batch: string
          branch?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          mentor_contact?: string | null
          mentor_email?: string | null
          mentor_id?: string | null
          mentor_name?: string | null
          phone?: string | null
          photo_url?: string | null
          program: string
          roll_number: string
          updated_at?: string
          user_id?: string | null
          year_of_study?: string | null
        }
        Update: {
          batch?: string
          branch?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          mentor_contact?: string | null
          mentor_email?: string | null
          mentor_id?: string | null
          mentor_name?: string | null
          phone?: string | null
          photo_url?: string | null
          program?: string
          roll_number?: string
          updated_at?: string
          user_id?: string | null
          year_of_study?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visiting_doctors: {
        Row: {
          created_at: string | null
          id: string
          is_monthly: boolean | null
          month_week: number | null
          name: string
          photo_url: string | null
          specialization: string
          updated_at: string | null
          visit_day: string
          visit_time_end: string
          visit_time_start: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_monthly?: boolean | null
          month_week?: number | null
          name: string
          photo_url?: string | null
          specialization: string
          updated_at?: string | null
          visit_day: string
          visit_time_end: string
          visit_time_start: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_monthly?: boolean | null
          month_week?: number | null
          name?: string
          photo_url?: string | null
          specialization?: string
          updated_at?: string | null
          visit_day?: string
          visit_time_end?: string
          visit_time_start?: string
        }
        Relationships: []
      }
      working_staff: {
        Row: {
          created_at: string | null
          designation: string
          email: string | null
          id: string
          name: string
          phone: string | null
          photo_url: string | null
        }
        Insert: {
          created_at?: string | null
          designation: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          photo_url?: string | null
        }
        Update: {
          created_at?: string | null
          designation?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      mentor_health_visits_view: {
        Row: {
          created_at: string | null
          follow_up_date: string | null
          follow_up_required: boolean | null
          id: string | null
          reason_category: Database["public"]["Enums"]["visit_reason"] | null
          student_id: string | null
          visit_date: string | null
        }
        Insert: {
          created_at?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string | null
          reason_category?: Database["public"]["Enums"]["visit_reason"] | null
          student_id?: string | null
          visit_date?: string | null
        }
        Update: {
          created_at?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string | null
          reason_category?: Database["public"]["Enums"]["visit_reason"] | null
          student_id?: string | null
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_visits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_visits_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students_doctor_view"
            referencedColumns: ["id"]
          },
        ]
      }
      students_doctor_view: {
        Row: {
          batch: string | null
          branch: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          mentor_id: string | null
          program: string | null
          roll_number: string | null
          updated_at: string | null
          user_id: string | null
          year_of_study: string | null
        }
        Insert: {
          batch?: string | null
          branch?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          mentor_id?: string | null
          program?: string | null
          roll_number?: string | null
          updated_at?: string | null
          user_id?: string | null
          year_of_study?: string | null
        }
        Update: {
          batch?: string | null
          branch?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          mentor_id?: string | null
          program?: string | null
          roll_number?: string | null
          updated_at?: string | null
          user_id?: string | null
          year_of_study?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      archive_old_audit_logs: { Args: never; Returns: undefined }
      check_login_rate_limit: { Args: { p_email: string }; Returns: boolean }
      cleanup_old_login_attempts: { Args: never; Returns: undefined }
      get_health_centre_stats: { Args: never; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_security_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_resource_id?: string
          p_resource_type: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role:
        | "doctor"
        | "mentor"
        | "student"
        | "admin"
        | "lab_officer"
        | "pharmacy"
        | "medical_staff"
      appointment_status: "pending" | "confirmed" | "cancelled" | "completed"
      medical_leave_status:
        | "doctor_referred"
        | "student_form_pending"
        | "on_leave"
        | "return_pending"
        | "returned"
        | "cancelled"
      visit_reason:
        | "medical_illness"
        | "injury"
        | "mental_wellness"
        | "vaccination"
        | "routine_checkup"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "doctor",
        "mentor",
        "student",
        "admin",
        "lab_officer",
        "pharmacy",
        "medical_staff",
      ],
      appointment_status: ["pending", "confirmed", "cancelled", "completed"],
      medical_leave_status: [
        "doctor_referred",
        "student_form_pending",
        "on_leave",
        "return_pending",
        "returned",
        "cancelled",
      ],
      visit_reason: [
        "medical_illness",
        "injury",
        "mental_wellness",
        "vaccination",
        "routine_checkup",
        "other",
      ],
    },
  },
} as const
