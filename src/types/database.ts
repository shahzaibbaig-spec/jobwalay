// Generated from the migrated PostgreSQL catalog by scripts/generate-embedded-types.mjs.
// Prefer npm run db:types against the full local Supabase stack when available.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = {
  public: {
    Tables: {
      abuse_reports: {
        Row: {
          id: string;
          organization_id: string;
          job_id: string;
          reporter_id: string;
          category: string;
          details: string;
          state: string;
          resolution: string | null;
          version: number;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          job_id: string;
          reporter_id: string;
          category: string;
          details: string;
          state?: string;
          resolution?: string | null;
          version?: number;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          job_id?: string;
          reporter_id?: string;
          category?: string;
          details?: string;
          state?: string;
          resolution?: string | null;
          version?: number;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "abuse_reports_organization_id_job_id_fkey"; columns: ["organization_id","job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["organization_id","id"]; },
          { foreignKeyName: "abuse_reports_reporter_id_fkey"; columns: ["reporter_id"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"]; }
        ];
      };
      accounts: {
        Row: {
          id: string;
          display_name: string;
          status: string;
          onboarded_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string;
          status?: string;
          onboarded_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          status?: string;
          onboarded_at?: string | null;
          created_at?: string;
        };
        Relationships: [

        ];
      };
      application_details: {
        Row: {
          application_id: string;
          organization_id: string;
          candidate_id: string;
          document_id: string | null;
          contact_email: string;
          phone: string;
          cover_letter: string;
          profile_snapshot: Json;
          consented_at: string | null;
        };
        Insert: {
          application_id: string;
          organization_id: string;
          candidate_id: string;
          document_id?: string | null;
          contact_email: string;
          phone?: string;
          cover_letter?: string;
          profile_snapshot: Json;
          consented_at?: string | null;
        };
        Update: {
          application_id?: string;
          organization_id?: string;
          candidate_id?: string;
          document_id?: string | null;
          contact_email?: string;
          phone?: string;
          cover_letter?: string;
          profile_snapshot?: Json;
          consented_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "application_details_candidate_id_document_id_fkey"; columns: ["candidate_id","document_id"]; isOneToOne: false; referencedRelation: "candidate_documents"; referencedColumns: ["user_id","id"]; },
          { foreignKeyName: "application_details_organization_id_application_id_candida_fkey"; columns: ["organization_id","application_id","candidate_id"]; isOneToOne: false; referencedRelation: "applications"; referencedColumns: ["organization_id","id","candidate_id"]; }
        ];
      };
      application_events: {
        Row: {
          id: string;
          organization_id: string;
          application_id: string;
          from_status: string | null;
          to_status: string;
          message: string;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          application_id: string;
          from_status?: string | null;
          to_status: string;
          message?: string;
          occurred_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          application_id?: string;
          from_status?: string | null;
          to_status?: string;
          message?: string;
          occurred_at?: string;
        };
        Relationships: [
          { foreignKeyName: "application_events_organization_id_application_id_fkey"; columns: ["organization_id","application_id"]; isOneToOne: false; referencedRelation: "applications"; referencedColumns: ["organization_id","id"]; }
        ];
      };
      application_notes: {
        Row: {
          id: string;
          organization_id: string;
          application_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          application_id: string;
          author_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          application_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "application_notes_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"]; },
          { foreignKeyName: "application_notes_organization_id_application_id_fkey"; columns: ["organization_id","application_id"]; isOneToOne: false; referencedRelation: "applications"; referencedColumns: ["organization_id","id"]; }
        ];
      };
      applications: {
        Row: {
          id: string;
          organization_id: string;
          job_id: string;
          candidate_id: string;
          candidate_name: string;
          candidate_headline: string;
          job_title: string;
          company_name: string;
          status: string;
          submitted_at: string;
          version: number;
          assessment_version_id: string | null;
          shortlist_source_attempt_id: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          job_id: string;
          candidate_id: string;
          candidate_name: string;
          candidate_headline: string;
          job_title: string;
          company_name: string;
          status?: string;
          submitted_at?: string;
          version?: number;
          assessment_version_id?: string | null;
          shortlist_source_attempt_id?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          job_id?: string;
          candidate_id?: string;
          candidate_name?: string;
          candidate_headline?: string;
          job_title?: string;
          company_name?: string;
          status?: string;
          submitted_at?: string;
          version?: number;
          assessment_version_id?: string | null;
          shortlist_source_attempt_id?: string | null;
        };
        Relationships: [
          { foreignKeyName: "applications_candidate_id_fkey"; columns: ["candidate_id"]; isOneToOne: false; referencedRelation: "candidate_profiles"; referencedColumns: ["user_id"]; },
          { foreignKeyName: "applications_organization_id_assessment_version_id_fkey"; columns: ["organization_id","assessment_version_id"]; isOneToOne: false; referencedRelation: "assessment_versions"; referencedColumns: ["organization_id","id"]; },
          { foreignKeyName: "applications_organization_id_job_id_fkey"; columns: ["organization_id","job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["organization_id","id"]; },
          { foreignKeyName: "applications_organization_id_shortlist_source_attempt_id_fkey"; columns: ["organization_id","shortlist_source_attempt_id"]; isOneToOne: false; referencedRelation: "assessment_attempts"; referencedColumns: ["organization_id","id"]; }
        ];
      };
      assessment_appeals: {
        Row: {
          id: string;
          organization_id: string;
          attempt_id: string;
          application_id: string;
          candidate_id: string;
          reason: string;
          decision: string;
          resolution_message: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          attempt_id: string;
          application_id: string;
          candidate_id: string;
          reason: string;
          decision?: string;
          resolution_message?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          attempt_id?: string;
          application_id?: string;
          candidate_id?: string;
          reason?: string;
          decision?: string;
          resolution_message?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "assessment_appeals_organization_id_application_id_candidat_fkey"; columns: ["organization_id","application_id","candidate_id"]; isOneToOne: false; referencedRelation: "applications"; referencedColumns: ["organization_id","id","candidate_id"]; },
          { foreignKeyName: "assessment_appeals_organization_id_attempt_id_application__fkey"; columns: ["organization_id","attempt_id","application_id"]; isOneToOne: false; referencedRelation: "assessment_attempts"; referencedColumns: ["organization_id","id","application_id"]; }
        ];
      };
      assessment_attempt_questions: {
        Row: {
          id: string;
          organization_id: string;
          attempt_id: string;
          source_question_id: string;
          kind: string;
          prompt: string;
          options: Json;
          category: string;
          difficulty: string;
          max_points: number;
          position: number;
        };
        Insert: {
          id?: string;
          organization_id: string;
          attempt_id: string;
          source_question_id: string;
          kind: string;
          prompt: string;
          options: Json;
          category: string;
          difficulty: string;
          max_points: number;
          position: number;
        };
        Update: {
          id?: string;
          organization_id?: string;
          attempt_id?: string;
          source_question_id?: string;
          kind?: string;
          prompt?: string;
          options?: Json;
          category?: string;
          difficulty?: string;
          max_points?: number;
          position?: number;
        };
        Relationships: [
          { foreignKeyName: "assessment_attempt_questions_organization_id_attempt_id_fkey"; columns: ["organization_id","attempt_id"]; isOneToOne: false; referencedRelation: "assessment_attempts"; referencedColumns: ["organization_id","id"]; },
          { foreignKeyName: "assessment_attempt_questions_organization_id_source_questi_fkey"; columns: ["organization_id","source_question_id"]; isOneToOne: false; referencedRelation: "bank_questions"; referencedColumns: ["organization_id","id"]; }
        ];
      };
      assessment_attempts: {
        Row: {
          id: string;
          organization_id: string;
          application_id: string;
          candidate_id: string;
          version_id: string;
          attempt_number: number;
          state: string;
          started_at: string;
          deadline_at: string;
          settings_snapshot: Json;
          closed_at: string | null;
          closure_reason: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          application_id: string;
          candidate_id: string;
          version_id: string;
          attempt_number: number;
          state?: string;
          started_at?: string;
          deadline_at: string;
          settings_snapshot: Json;
          closed_at?: string | null;
          closure_reason?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          application_id?: string;
          candidate_id?: string;
          version_id?: string;
          attempt_number?: number;
          state?: string;
          started_at?: string;
          deadline_at?: string;
          settings_snapshot?: Json;
          closed_at?: string | null;
          closure_reason?: string | null;
        };
        Relationships: [
          { foreignKeyName: "assessment_attempts_organization_id_application_id_candida_fkey"; columns: ["organization_id","application_id","candidate_id"]; isOneToOne: false; referencedRelation: "applications"; referencedColumns: ["organization_id","id","candidate_id"]; },
          { foreignKeyName: "assessment_attempts_organization_id_version_id_fkey"; columns: ["organization_id","version_id"]; isOneToOne: false; referencedRelation: "assessment_versions"; referencedColumns: ["organization_id","id"]; }
        ];
      };
      assessment_integrity_acknowledgements: {
        Row: {
          attempt_id: string;
          organization_id: string;
          candidate_id: string;
          disclosure_version: string;
          acknowledged_at: string;
        };
        Insert: {
          attempt_id: string;
          organization_id: string;
          candidate_id: string;
          disclosure_version: string;
          acknowledged_at?: string;
        };
        Update: {
          attempt_id?: string;
          organization_id?: string;
          candidate_id?: string;
          disclosure_version?: string;
          acknowledged_at?: string;
        };
        Relationships: [
          { foreignKeyName: "assessment_integrity_acknowledg_organization_id_attempt_id_fkey"; columns: ["organization_id","attempt_id"]; isOneToOne: false; referencedRelation: "assessment_attempts"; referencedColumns: ["organization_id","id"]; },
          { foreignKeyName: "assessment_integrity_acknowledgements_candidate_id_fkey"; columns: ["candidate_id"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"]; }
        ];
      };
      assessment_integrity_events: {
        Row: {
          id: string;
          sequence: number;
          organization_id: string;
          attempt_id: string;
          session_id: string;
          client_event_id: string | null;
          kind: string;
          source: string;
          client_observed_at: string | null;
          received_at: string;
        };
        Insert: {
          id?: string;
          sequence: number;
          organization_id: string;
          attempt_id: string;
          session_id: string;
          client_event_id?: string | null;
          kind: string;
          source: string;
          client_observed_at?: string | null;
          received_at?: string;
        };
        Update: {
          id?: string;
          sequence?: number;
          organization_id?: string;
          attempt_id?: string;
          session_id?: string;
          client_event_id?: string | null;
          kind?: string;
          source?: string;
          client_observed_at?: string | null;
          received_at?: string;
        };
        Relationships: [
          { foreignKeyName: "assessment_integrity_events_organization_id_attempt_id_ses_fkey"; columns: ["organization_id","attempt_id","session_id"]; isOneToOne: false; referencedRelation: "assessment_monitor_sessions"; referencedColumns: ["organization_id","attempt_id","id"]; }
        ];
      };
      assessment_invitations: {
        Row: {
          id: string;
          organization_id: string;
          application_id: string;
          candidate_id: string;
          version_id: string;
          state: string;
          issued_at: string;
          expires_at: string;
          approved_through: number;
        };
        Insert: {
          id?: string;
          organization_id: string;
          application_id: string;
          candidate_id: string;
          version_id: string;
          state?: string;
          issued_at?: string;
          expires_at: string;
          approved_through?: number;
        };
        Update: {
          id?: string;
          organization_id?: string;
          application_id?: string;
          candidate_id?: string;
          version_id?: string;
          state?: string;
          issued_at?: string;
          expires_at?: string;
          approved_through?: number;
        };
        Relationships: [
          { foreignKeyName: "assessment_invitations_organization_id_application_id_cand_fkey"; columns: ["organization_id","application_id","candidate_id"]; isOneToOne: false; referencedRelation: "applications"; referencedColumns: ["organization_id","id","candidate_id"]; },
          { foreignKeyName: "assessment_invitations_organization_id_version_id_fkey"; columns: ["organization_id","version_id"]; isOneToOne: false; referencedRelation: "assessment_versions"; referencedColumns: ["organization_id","id"]; }
        ];
      };
      assessment_monitor_reviews: {
        Row: {
          id: string;
          organization_id: string;
          attempt_id: string;
          reviewer_id: string;
          outcome: string;
          rationale: string;
          reviewed_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          attempt_id: string;
          reviewer_id: string;
          outcome: string;
          rationale: string;
          reviewed_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          attempt_id?: string;
          reviewer_id?: string;
          outcome?: string;
          rationale?: string;
          reviewed_at?: string;
        };
        Relationships: [
          { foreignKeyName: "assessment_monitor_reviews_organization_id_attempt_id_fkey"; columns: ["organization_id","attempt_id"]; isOneToOne: false; referencedRelation: "assessment_attempts"; referencedColumns: ["organization_id","id"]; },
          { foreignKeyName: "assessment_monitor_reviews_reviewer_id_fkey"; columns: ["reviewer_id"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"]; }
        ];
      };
      assessment_monitor_sessions: {
        Row: {
          id: string;
          organization_id: string;
          attempt_id: string;
          opened_at: string;
          last_seen_at: string;
          released_at: string | null;
          last_overlap_at: string | null;
        };
        Insert: {
          id: string;
          organization_id: string;
          attempt_id: string;
          opened_at?: string;
          last_seen_at?: string;
          released_at?: string | null;
          last_overlap_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          attempt_id?: string;
          opened_at?: string;
          last_seen_at?: string;
          released_at?: string | null;
          last_overlap_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "assessment_monitor_sessions_organization_id_attempt_id_fkey"; columns: ["organization_id","attempt_id"]; isOneToOne: false; referencedRelation: "assessment_attempts"; referencedColumns: ["organization_id","id"]; }
        ];
      };
      assessment_pool_rules: {
        Row: {
          id: string;
          organization_id: string;
          version_id: string;
          pool_id: string;
          draw_count: number;
          max_points: number;
        };
        Insert: {
          id?: string;
          organization_id: string;
          version_id: string;
          pool_id: string;
          draw_count: number;
          max_points: number;
        };
        Update: {
          id?: string;
          organization_id?: string;
          version_id?: string;
          pool_id?: string;
          draw_count?: number;
          max_points?: number;
        };
        Relationships: [
          { foreignKeyName: "assessment_pool_rules_organization_id_pool_id_fkey"; columns: ["organization_id","pool_id"]; isOneToOne: false; referencedRelation: "question_pools"; referencedColumns: ["organization_id","id"]; },
          { foreignKeyName: "assessment_pool_rules_organization_id_version_id_fkey"; columns: ["organization_id","version_id"]; isOneToOne: false; referencedRelation: "assessment_versions"; referencedColumns: ["organization_id","id"]; }
        ];
      };
      assessment_responses: {
        Row: {
          organization_id: string;
          attempt_id: string;
          question_id: string;
          answer: Json;
          revision: number;
          saved_at: string;
        };
        Insert: {
          organization_id: string;
          attempt_id: string;
          question_id: string;
          answer: Json;
          revision: number;
          saved_at?: string;
        };
        Update: {
          organization_id?: string;
          attempt_id?: string;
          question_id?: string;
          answer?: Json;
          revision?: number;
          saved_at?: string;
        };
        Relationships: [
          { foreignKeyName: "assessment_responses_organization_id_attempt_id_question_i_fkey"; columns: ["organization_id","attempt_id","question_id"]; isOneToOne: false; referencedRelation: "assessment_attempt_questions"; referencedColumns: ["organization_id","attempt_id","id"]; }
        ];
      };
      assessment_result_history: {
        Row: {
          attempt_id: string;
          organization_id: string;
          application_id: string;
          result_revision: number;
          total_score: number | null;
          percentage: number | null;
          outcome: string;
          occurred_at: string;
        };
        Insert: {
          attempt_id: string;
          organization_id: string;
          application_id: string;
          result_revision: number;
          total_score?: number | null;
          percentage?: number | null;
          outcome: string;
          occurred_at?: string;
        };
        Update: {
          attempt_id?: string;
          organization_id?: string;
          application_id?: string;
          result_revision?: number;
          total_score?: number | null;
          percentage?: number | null;
          outcome?: string;
          occurred_at?: string;
        };
        Relationships: [
          { foreignKeyName: "assessment_result_history_organization_id_attempt_id_appli_fkey"; columns: ["organization_id","attempt_id","application_id"]; isOneToOne: false; referencedRelation: "assessment_attempts"; referencedColumns: ["organization_id","id","application_id"]; }
        ];
      };
      assessment_results: {
        Row: {
          attempt_id: string;
          organization_id: string;
          application_id: string;
          candidate_id: string;
          objective_points: number;
          earned_points: number;
          max_points: number;
          total_score: number | null;
          percentage: number | null;
          passing_percentage: number;
          outcome: string;
          pending_written: number;
          integrity_holds: number;
          open_appeals: number;
          result_revision: number;
          fingerprint: string;
          updated_at: string;
        };
        Insert: {
          attempt_id: string;
          organization_id: string;
          application_id: string;
          candidate_id: string;
          objective_points: number;
          earned_points: number;
          max_points: number;
          total_score?: number | null;
          percentage?: number | null;
          passing_percentage: number;
          outcome: string;
          pending_written: number;
          integrity_holds: number;
          open_appeals: number;
          result_revision: number;
          fingerprint: string;
          updated_at?: string;
        };
        Update: {
          attempt_id?: string;
          organization_id?: string;
          application_id?: string;
          candidate_id?: string;
          objective_points?: number;
          earned_points?: number;
          max_points?: number;
          total_score?: number | null;
          percentage?: number | null;
          passing_percentage?: number;
          outcome?: string;
          pending_written?: number;
          integrity_holds?: number;
          open_appeals?: number;
          result_revision?: number;
          fingerprint?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "assessment_results_organization_id_application_id_candidat_fkey"; columns: ["organization_id","application_id","candidate_id"]; isOneToOne: false; referencedRelation: "applications"; referencedColumns: ["organization_id","id","candidate_id"]; },
          { foreignKeyName: "assessment_results_organization_id_attempt_id_application__fkey"; columns: ["organization_id","attempt_id","application_id"]; isOneToOne: false; referencedRelation: "assessment_attempts"; referencedColumns: ["organization_id","id","application_id"]; }
        ];
      };
      assessment_version_questions: {
        Row: {
          id: string;
          organization_id: string;
          version_id: string;
          question_id: string;
          max_points: number;
          position: number;
        };
        Insert: {
          id?: string;
          organization_id: string;
          version_id: string;
          question_id: string;
          max_points: number;
          position: number;
        };
        Update: {
          id?: string;
          organization_id?: string;
          version_id?: string;
          question_id?: string;
          max_points?: number;
          position?: number;
        };
        Relationships: [
          { foreignKeyName: "assessment_version_questions_organization_id_question_id_fkey"; columns: ["organization_id","question_id"]; isOneToOne: false; referencedRelation: "bank_questions"; referencedColumns: ["organization_id","id"]; },
          { foreignKeyName: "assessment_version_questions_organization_id_version_id_fkey"; columns: ["organization_id","version_id"]; isOneToOne: false; referencedRelation: "assessment_versions"; referencedColumns: ["organization_id","id"]; }
        ];
      };
      assessment_versions: {
        Row: {
          id: string;
          organization_id: string;
          assessment_id: string;
          version_number: number;
          status: string;
          summary: string;
          duration_minutes: number;
          passing_percentage: number;
          max_attempts: number;
          deadline: string | null;
          revision: number;
          builder_ready: boolean;
          published_at: string | null;
          retake_policy: string;
          retake_delay_minutes: number;
          appeals_enabled: boolean;
          appeal_window_hours: number;
          invitation_window_hours: number;
        };
        Insert: {
          id?: string;
          organization_id: string;
          assessment_id: string;
          version_number: number;
          status: string;
          summary?: string;
          duration_minutes?: number;
          passing_percentage?: number;
          max_attempts?: number;
          deadline?: string | null;
          revision?: number;
          builder_ready?: boolean;
          published_at?: string | null;
          retake_policy?: string;
          retake_delay_minutes?: number;
          appeals_enabled?: boolean;
          appeal_window_hours?: number;
          invitation_window_hours?: number;
        };
        Update: {
          id?: string;
          organization_id?: string;
          assessment_id?: string;
          version_number?: number;
          status?: string;
          summary?: string;
          duration_minutes?: number;
          passing_percentage?: number;
          max_attempts?: number;
          deadline?: string | null;
          revision?: number;
          builder_ready?: boolean;
          published_at?: string | null;
          retake_policy?: string;
          retake_delay_minutes?: number;
          appeals_enabled?: boolean;
          appeal_window_hours?: number;
          invitation_window_hours?: number;
        };
        Relationships: [
          { foreignKeyName: "assessment_versions_organization_id_assessment_id_fkey"; columns: ["organization_id","assessment_id"]; isOneToOne: false; referencedRelation: "assessments"; referencedColumns: ["organization_id","id"]; },
          { foreignKeyName: "assessment_versions_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"]; }
        ];
      };
      assessments: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          created_by: string | null;
          job_id: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          created_by?: string | null;
          job_id?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          title?: string;
          created_by?: string | null;
          job_id?: string | null;
        };
        Relationships: [
          { foreignKeyName: "assessments_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"]; },
          { foreignKeyName: "assessments_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"]; },
          { foreignKeyName: "assessments_organization_id_job_id_fkey"; columns: ["organization_id","job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["organization_id","id"]; }
        ];
      };
      audit_events: {
        Row: {
          id: string;
          organization_id: string | null;
          actor_id: string | null;
          action: string;
          target_id: string | null;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          actor_id?: string | null;
          action: string;
          target_id?: string | null;
          occurred_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          actor_id?: string | null;
          action?: string;
          target_id?: string | null;
          occurred_at?: string;
        };
        Relationships: [
          { foreignKeyName: "audit_events_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"]; },
          { foreignKeyName: "audit_events_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"]; }
        ];
      };
      bank_questions: {
        Row: {
          id: string;
          organization_id: string;
          created_by: string;
          source_id: string | null;
          kind: string;
          prompt: string;
          options: Json;
          category: string;
          difficulty: string;
          state: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          created_by: string;
          source_id?: string | null;
          kind: string;
          prompt: string;
          options?: Json;
          category: string;
          difficulty: string;
          state?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          created_by?: string;
          source_id?: string | null;
          kind?: string;
          prompt?: string;
          options?: Json;
          category?: string;
          difficulty?: string;
          state?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "bank_questions_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"]; },
          { foreignKeyName: "bank_questions_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"]; },
          { foreignKeyName: "bank_questions_organization_id_source_id_fkey"; columns: ["organization_id","source_id"]; isOneToOne: false; referencedRelation: "bank_questions"; referencedColumns: ["organization_id","id"]; }
        ];
      };
      candidate_certifications: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          issuer: string;
          issued_on: string;
          expires_on: string | null;
          credential_url: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          issuer: string;
          issued_on: string;
          expires_on?: string | null;
          credential_url?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          issuer?: string;
          issued_on?: string;
          expires_on?: string | null;
          credential_url?: string;
        };
        Relationships: [
          { foreignKeyName: "candidate_certifications_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "candidate_profiles"; referencedColumns: ["user_id"]; }
        ];
      };
      candidate_documents: {
        Row: {
          id: string;
          user_id: string;
          object_key: string;
          filename: string;
          size_bytes: number;
          sha256: string;
          scan_status: string;
          created_at: string;
          scanned_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          object_key: string;
          filename: string;
          size_bytes: number;
          sha256: string;
          scan_status?: string;
          created_at?: string;
          scanned_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          object_key?: string;
          filename?: string;
          size_bytes?: number;
          sha256?: string;
          scan_status?: string;
          created_at?: string;
          scanned_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "candidate_documents_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "candidate_profiles"; referencedColumns: ["user_id"]; }
        ];
      };
      candidate_education: {
        Row: {
          id: string;
          user_id: string;
          school: string;
          qualification: string;
          field_of_study: string;
          started_on: string;
          ended_on: string | null;
          description: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          school: string;
          qualification: string;
          field_of_study?: string;
          started_on: string;
          ended_on?: string | null;
          description?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          school?: string;
          qualification?: string;
          field_of_study?: string;
          started_on?: string;
          ended_on?: string | null;
          description?: string;
        };
        Relationships: [
          { foreignKeyName: "candidate_education_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "candidate_profiles"; referencedColumns: ["user_id"]; }
        ];
      };
      candidate_experiences: {
        Row: {
          id: string;
          user_id: string;
          company: string;
          title: string;
          location: string;
          started_on: string;
          ended_on: string | null;
          description: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company: string;
          title: string;
          location?: string;
          started_on: string;
          ended_on?: string | null;
          description?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          company?: string;
          title?: string;
          location?: string;
          started_on?: string;
          ended_on?: string | null;
          description?: string;
        };
        Relationships: [
          { foreignKeyName: "candidate_experiences_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "candidate_profiles"; referencedColumns: ["user_id"]; }
        ];
      };
      candidate_profiles: {
        Row: {
          user_id: string;
          headline: string;
          bio: string;
          updated_at: string;
          skills: string[];
          slug: string | null;
          visibility: string;
          version: number;
          current_cv_id: string | null;
        };
        Insert: {
          user_id: string;
          headline: string;
          bio?: string;
          updated_at?: string;
          skills?: string[];
          slug?: string | null;
          visibility?: string;
          version?: number;
          current_cv_id?: string | null;
        };
        Update: {
          user_id?: string;
          headline?: string;
          bio?: string;
          updated_at?: string;
          skills?: string[];
          slug?: string | null;
          visibility?: string;
          version?: number;
          current_cv_id?: string | null;
        };
        Relationships: [
          { foreignKeyName: "candidate_profiles_user_id_current_cv_id_fkey"; columns: ["user_id","current_cv_id"]; isOneToOne: false; referencedRelation: "candidate_documents"; referencedColumns: ["user_id","id"]; },
          { foreignKeyName: "candidate_profiles_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "accounts"; referencedColumns: ["id"]; }
        ];
      };
      company_profiles: {
        Row: {
          organization_id: string;
          company_name: string;
          slug: string;
          industry: string;
          location: string;
          website: string;
          description: string;
          logo_path: string | null;
          cover_path: string | null;
          is_public: boolean;
          version: number;
          updated_at: string;
        };
        Insert: {
          organization_id: string;
          company_name: string;
          slug: string;
          industry: string;
          location: string;
          website?: string;
          description: string;
          logo_path?: string | null;
          cover_path?: string | null;
          is_public?: boolean;
          version?: number;
          updated_at?: string;
        };
        Update: {
          organization_id?: string;
          company_name?: string;
          slug?: string;
          industry?: string;
          location?: string;
          website?: string;
          description?: string;
          logo_path?: string | null;
          cover_path?: string | null;
          is_public?: boolean;
          version?: number;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "company_profiles_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: true; referencedRelation: "organizations"; referencedColumns: ["id"]; }
        ];
      };
      job_members: {
        Row: {
          organization_id: string;
          job_id: string;
          membership_id: string;
        };
        Insert: {
          organization_id: string;
          job_id: string;
          membership_id: string;
        };
        Update: {
          organization_id?: string;
          job_id?: string;
          membership_id?: string;
        };
        Relationships: [
          { foreignKeyName: "job_members_organization_id_job_id_fkey"; columns: ["organization_id","job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["organization_id","id"]; },
          { foreignKeyName: "job_members_organization_id_membership_id_fkey"; columns: ["organization_id","membership_id"]; isOneToOne: false; referencedRelation: "memberships"; referencedColumns: ["organization_id","id"]; }
        ];
      };
      jobs: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          description: string;
          department: string;
          location: string;
          work_mode: string;
          job_type: string;
          experience_min: number;
          experience_max: number | null;
          education: string;
          required_skills: string[];
          salary_min: number | null;
          salary_max: number | null;
          salary_currency: string | null;
          salary_period: string;
          application_deadline: string | null;
          positions: number;
          assessment_version_id: string | null;
          status: string;
          version: number;
          created_at: string;
          updated_at: string;
          published_at: string | null;
          search_document: string | null;
          moderation_status: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          description: string;
          department?: string;
          location: string;
          work_mode: string;
          job_type: string;
          experience_min?: number;
          experience_max?: number | null;
          education?: string;
          required_skills?: string[];
          salary_min?: number | null;
          salary_max?: number | null;
          salary_currency?: string | null;
          salary_period?: string;
          application_deadline?: string | null;
          positions?: number;
          assessment_version_id?: string | null;
          status?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
          search_document?: string | null;
          moderation_status?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          title?: string;
          description?: string;
          department?: string;
          location?: string;
          work_mode?: string;
          job_type?: string;
          experience_min?: number;
          experience_max?: number | null;
          education?: string;
          required_skills?: string[];
          salary_min?: number | null;
          salary_max?: number | null;
          salary_currency?: string | null;
          salary_period?: string;
          application_deadline?: string | null;
          positions?: number;
          assessment_version_id?: string | null;
          status?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
          published_at?: string | null;
          search_document?: string | null;
          moderation_status?: string;
        };
        Relationships: [
          { foreignKeyName: "jobs_organization_id_assessment_version_id_fkey"; columns: ["organization_id","assessment_version_id"]; isOneToOne: false; referencedRelation: "assessment_versions"; referencedColumns: ["organization_id","id"]; },
          { foreignKeyName: "jobs_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"]; }
        ];
      };
      memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: string;
          status: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role: string;
          status?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: string;
          status?: string;
        };
        Relationships: [
          { foreignKeyName: "memberships_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"]; },
          { foreignKeyName: "memberships_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"]; }
        ];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          email_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          email_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "notification_preferences_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "accounts"; referencedColumns: ["id"]; }
        ];
      };
      organization_invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: string;
          token_hash: string;
          invited_by: string;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role: string;
          token_hash: string;
          invited_by: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          email?: string;
          role?: string;
          token_hash?: string;
          invited_by?: string;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "organization_invitations_invited_by_fkey"; columns: ["invited_by"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"]; },
          { foreignKeyName: "organization_invitations_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"]; }
        ];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          status: string;
          verification_status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          status?: string;
          verification_status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          status?: string;
          verification_status?: string;
          created_at?: string;
        };
        Relationships: [

        ];
      };
      question_pool_members: {
        Row: {
          organization_id: string;
          pool_id: string;
          question_id: string;
        };
        Insert: {
          organization_id: string;
          pool_id: string;
          question_id: string;
        };
        Update: {
          organization_id?: string;
          pool_id?: string;
          question_id?: string;
        };
        Relationships: [
          { foreignKeyName: "question_pool_members_organization_id_pool_id_fkey"; columns: ["organization_id","pool_id"]; isOneToOne: false; referencedRelation: "question_pools"; referencedColumns: ["organization_id","id"]; },
          { foreignKeyName: "question_pool_members_organization_id_question_id_fkey"; columns: ["organization_id","question_id"]; isOneToOne: false; referencedRelation: "bank_questions"; referencedColumns: ["organization_id","id"]; }
        ];
      };
      question_pools: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          state: string;
          created_by: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          state?: string;
          created_by: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          state?: string;
          created_by?: string;
        };
        Relationships: [
          { foreignKeyName: "question_pools_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"]; },
          { foreignKeyName: "question_pools_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"]; }
        ];
      };
      saved_jobs: {
        Row: {
          user_id: string;
          job_id: string;
          job_title: string;
          company_name: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          job_id: string;
          job_title: string;
          company_name: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          job_id?: string;
          job_title?: string;
          company_name?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "saved_jobs_job_id_fkey"; columns: ["job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["id"]; },
          { foreignKeyName: "saved_jobs_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"]; }
        ];
      };
      user_notifications: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string | null;
          application_id: string | null;
          audience: string;
          kind: string;
          event_key: string;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id?: string | null;
          application_id?: string | null;
          audience: string;
          kind: string;
          event_key: string;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          organization_id?: string | null;
          application_id?: string | null;
          audience?: string;
          kind?: string;
          event_key?: string;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "user_notifications_organization_id_application_id_fkey"; columns: ["organization_id","application_id"]; isOneToOne: false; referencedRelation: "applications"; referencedColumns: ["organization_id","id"]; },
          { foreignKeyName: "user_notifications_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"]; }
        ];
      };
      verification_requests: {
        Row: {
          id: string;
          organization_id: string;
          legal_name: string;
          registration_number: string;
          notes: string;
          state: string;
          submitted_by: string;
          reviewed_by: string | null;
          review_reason: string | null;
          created_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          legal_name: string;
          registration_number: string;
          notes?: string;
          state?: string;
          submitted_by: string;
          reviewed_by?: string | null;
          review_reason?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          legal_name?: string;
          registration_number?: string;
          notes?: string;
          state?: string;
          submitted_by?: string;
          reviewed_by?: string | null;
          review_reason?: string | null;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "verification_requests_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"]; },
          { foreignKeyName: "verification_requests_reviewed_by_fkey"; columns: ["reviewed_by"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"]; },
          { foreignKeyName: "verification_requests_submitted_by_fkey"; columns: ["submitted_by"]; isOneToOne: false; referencedRelation: "accounts"; referencedColumns: ["id"]; }
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      accept_invitation: { Args: { p_hash: string }; Returns: string };
      add_application_note: { Args: { p_org: string; p_application: string; p_body: string }; Returns: undefined };
      admin_directory: { Args: { p_kind: string; p_page?: number; p_query?: string }; Returns: Json };
      appeal_assessment: { Args: { p_attempt: string; p_reason: string }; Returns: undefined };
      apply_to_job: { Args: { p_job: string; p_document?: string; p_contact_email?: string; p_phone?: string; p_cover_letter?: string }; Returns: string };
      approve_assessment_retake: { Args: { p_application: string; p_reason: string }; Returns: undefined };
      approve_bank_question: { Args: { p_org: string; p_question: string }; Returns: undefined };
      approve_question_pool: { Args: { p_org: string; p_pool: string }; Returns: undefined };
      assessment_server_time: { Args: Record<PropertyKey, never>; Returns: string };
      assign_job_recruiter: { Args: { p_org: string; p_job_id: string; p_membership: string; p_assign: boolean }; Returns: undefined };
      authorize_cv_download: { Args: { p_document: string; p_application?: string }; Returns: Json };
      begin_cv_upload: { Args: { p_filename: string; p_size: number; p_sha256: string }; Returns: string };
      claim_notification_emails: { Args: { p_limit?: number }; Returns: Json };
      complete_notification_email: { Args: { p_id: string; p_token: string; p_success: boolean; p_provider_id?: string }; Returns: undefined };
      complete_onboarding: { Args: { p_name: string }; Returns: undefined };
      consume_request_quota: { Args: { p_mutation?: boolean }; Returns: undefined };
      create_assessment: { Args: { p_org: string; p_title: string; p_job?: string }; Returns: string };
      delete_candidate_entry: { Args: { p_kind: string; p_id: string }; Returns: undefined };
      finish_cv_scan: { Args: { p_document: string; p_sha256: string; p_result: string }; Returns: undefined };
      get_author_question: { Args: { p_org: string; p_question: string }; Returns: Json };
      get_candidate_assessment_invitation: { Args: { p_application: string }; Returns: Json };
      get_employer_assessment_result: { Args: { p_attempt: string }; Returns: Json };
      get_public_candidate: { Args: { p_slug: string }; Returns: Json };
      integrity_review_queue: { Args: { p_org?: string; p_page?: number }; Returns: Json };
      invite_member: { Args: { p_org: string; p_email: string; p_role: string; p_hash: string }; Returns: string };
      manage_account: { Args: { p_user: string; p_status: string; p_reason: string }; Returns: undefined };
      manage_organization: { Args: { p_org: string; p_status: string; p_reason: string }; Returns: undefined };
      mark_notification_read: { Args: { p_id: string }; Returns: undefined };
      moderate_job: { Args: { p_job: string; p_hidden: boolean; p_expected_version: number; p_reason: string }; Returns: undefined };
      platform_admin_status: { Args: Record<PropertyKey, never>; Returns: boolean };
      platform_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      process_assessment_expiry: { Args: { p_limit?: number }; Returns: number };
      publish_assessment: { Args: { p_org: string; p_version: string; p_revision: number }; Returns: undefined };
      record_assessment_integrity: { Args: { p_attempt: string; p_session: string; p_disclosure: string; p_events?: Json; p_release?: boolean }; Returns: Json };
      recruitment_analytics: { Args: { p_org: string; p_days?: number }; Returns: Json };
      register_organization: { Args: { p_name: string }; Returns: string };
      report_assessment_integrity: { Args: { p_attempt: string; p_reason: string }; Returns: undefined };
      report_job_abuse: { Args: { p_job: string; p_category: string; p_details: string }; Returns: string };
      request_verification: { Args: { p_org: string; p_legal_name: string; p_registration_number: string; p_notes: string }; Returns: string };
      resolve_abuse_report: { Args: { p_report: string; p_expected_version: number; p_state: string; p_reason: string }; Returns: undefined };
      resolve_assessment_appeal: { Args: { p_appeal: string; p_decision: string; p_message: string }; Returns: undefined };
      resolve_assessment_integrity: { Args: { p_flag: string; p_resolution: string; p_reason: string }; Returns: undefined };
      review_assessment_monitoring: { Args: { p_attempt: string; p_outcome: string; p_rationale: string }; Returns: undefined };
      review_verification: { Args: { p_request: string; p_decision: string; p_reason: string }; Returns: undefined };
      review_written_answer: { Args: { p_attempt: string; p_question: string; p_points: number; p_rationale: string; p_expected_revision: number }; Returns: undefined };
      revise_assessment: { Args: { p_org: string; p_version: string }; Returns: string };
      revoke_member: { Args: { p_org: string; p_member: string }; Returns: undefined };
      save_assessment_response: { Args: { p_attempt: string; p_question: string; p_answer: Json; p_revision: number }; Returns: number };
      save_assessment_settings: { Args: { p_org: string; p_version: string; p_revision: number; p_input: Json }; Returns: undefined };
      save_bank_question: { Args: { p_org: string; p_input: Json; p_source?: string }; Returns: string };
      save_candidate_entry: { Args: { p_kind: string; p_input: Json; p_id?: string }; Returns: string };
      save_candidate_profile: { Args: { p_headline: string; p_bio: string }; Returns: undefined };
      save_company_profile: { Args: { p_org: string; p_expected_version: number; p_input: Json }; Returns: undefined };
      save_job: { Args: { p_org: string; p_expected_version: number; p_input: Json; p_job_id?: string }; Returns: string };
      save_professional_profile: { Args: { p_headline: string; p_bio: string; p_skills: string[]; p_slug: string; p_visibility: string; p_expected_version: number }; Returns: undefined };
      save_question_pool: { Args: { p_org: string; p_name: string; p_questions: string[] }; Returns: string };
      set_assessment_pool: { Args: { p_org: string; p_version: string; p_pool: string; p_count: number; p_points: number; p_remove?: boolean }; Returns: undefined };
      set_assessment_question: { Args: { p_org: string; p_version: string; p_question: string; p_points: number; p_position: number; p_remove?: boolean }; Returns: undefined };
      set_company_image: { Args: { p_org: string; p_kind: string; p_path: string }; Returns: undefined };
      set_current_cv: { Args: { p_document: string }; Returns: undefined };
      set_notification_preferences: { Args: { p_email: boolean }; Returns: undefined };
      set_saved_job: { Args: { p_job: string; p_saved: boolean }; Returns: undefined };
      start_assessment_attempt: { Args: { p_application: string; p_disclosure?: string }; Returns: string };
      submit_assessment_attempt: { Args: { p_attempt: string }; Returns: undefined };
      transition_application: { Args: { p_org: string; p_application: string; p_expected_version: number; p_status: string; p_message?: string }; Returns: undefined };
      transition_job: { Args: { p_org: string; p_job_id: string; p_expected_version: number; p_status: string }; Returns: undefined };
      withdraw_application: { Args: { p_application: string; p_expected_version: number }; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
