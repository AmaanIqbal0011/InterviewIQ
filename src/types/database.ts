export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = {
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Timestamps & {
          id: string;
          full_name: string;
          country: string | null;
          city: string | null;
          current_status: string | null;
          onboarding_completed: boolean;
          onboarding_step: number;
        };
        Insert: {
          id: string;
          full_name?: string;
          country?: string | null;
          city?: string | null;
          current_status?: string | null;
          onboarding_completed?: boolean;
          onboarding_step?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          country?: string | null;
          city?: string | null;
          current_status?: string | null;
          onboarding_completed?: boolean;
          onboarding_step?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      education_entries: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          level: string;
          institution: string;
          field_of_study: string | null;
          start_year: number;
          end_year: number | null;
          is_current: boolean;
          grade: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          level: string;
          institution: string;
          field_of_study?: string | null;
          start_year: number;
          end_year?: number | null;
          is_current?: boolean;
          grade?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          level?: string;
          institution?: string;
          field_of_study?: string | null;
          start_year?: number;
          end_year?: number | null;
          is_current?: boolean;
          grade?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      work_experiences: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          job_title: string;
          company: string;
          employment_type: string;
          start_date: string;
          end_date: string | null;
          is_current: boolean;
          description: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_title: string;
          company: string;
          employment_type: string;
          start_date: string;
          end_date?: string | null;
          is_current?: boolean;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          job_title?: string;
          company?: string;
          employment_type?: string;
          start_date?: string;
          end_date?: string | null;
          is_current?: boolean;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      language_skills: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          language: string;
          proficiency: string;
          is_interview_language: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          language: string;
          proficiency: string;
          is_interview_language?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          language?: string;
          proficiency?: string;
          is_interview_language?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      skills: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          name: string;
          category: string;
          level: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          category: string;
          level: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          category?: string;
          level?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      career_goals: {
        Row: Timestamps & {
          user_id: string;
          target_role: string;
          target_industry: string | null;
          experience_level: string;
          target_companies: string[];
          interview_type: string;
          difficulty: string;
          interview_language: string;
          additional_notes: string | null;
        };
        Insert: {
          user_id: string;
          target_role: string;
          target_industry?: string | null;
          experience_level: string;
          target_companies?: string[];
          interview_type: string;
          difficulty: string;
          interview_language: string;
          additional_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          target_role?: string;
          target_industry?: string | null;
          experience_level?: string;
          target_companies?: string[];
          interview_type?: string;
          difficulty?: string;
          interview_language?: string;
          additional_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      interviews: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          status: string;
          config: Json | null;
          context_snapshot: Json | null;
          started_at: string | null;
          completed_at: string | null;
          overall_score: number | null;
          report_status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: string;
          status?: string;
          config?: Json | null;
          context_snapshot?: Json | null;
          started_at?: string | null;
          completed_at?: string | null;
          overall_score?: number | null;
          report_status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: string;
          status?: string;
          config?: Json | null;
          context_snapshot?: Json | null;
          started_at?: string | null;
          completed_at?: string | null;
          overall_score?: number | null;
          report_status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      interview_turns: {
        Row: {
          id: string;
          interview_id: string;
          turn_index: number;
          question_type: string;
          question_text: string;
          topic: string | null;
          answer_text: string | null;
          evaluation: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          interview_id: string;
          turn_index: number;
          question_type: string;
          question_text: string;
          topic?: string | null;
          answer_text?: string | null;
          evaluation?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          interview_id?: string;
          turn_index?: number;
          question_type?: string;
          question_text?: string;
          topic?: string | null;
          answer_text?: string | null;
          evaluation?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_turns_interview_id_fkey";
            columns: ["interview_id"];
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
        ];
      };
      interview_reports: {
        Row: {
          id: string;
          interview_id: string;
          user_id: string;
          overall_score: number;
          category_scores: Json;
          strengths: Json;
          weaknesses: Json;
          question_feedback: Json;
          improvement_plan: Json;
          cv_insights: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          interview_id: string;
          user_id: string;
          overall_score: number;
          category_scores: Json;
          strengths: Json;
          weaknesses: Json;
          question_feedback: Json;
          improvement_plan: Json;
          cv_insights: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          interview_id?: string;
          user_id?: string;
          overall_score?: number;
          category_scores?: Json;
          strengths?: Json;
          weaknesses?: Json;
          question_feedback?: Json;
          improvement_plan?: Json;
          cv_insights?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interview_reports_interview_id_fkey";
            columns: ["interview_id"];
            referencedRelation: "interviews";
            referencedColumns: ["id"];
          },
        ];
      };
      resumes: {
        Row: {
          id: string;
          user_id: string;
          file_path: string;
          file_name: string;
          mime_type: string;
          size: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          file_path: string;
          file_name: string;
          mime_type: string;
          size: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          file_path?: string;
          file_name?: string;
          mime_type?: string;
          size?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      resume_profiles: {
        Row: Timestamps & {
          id: string;
          user_id: string;
          resume_id: string;
          status: string;
          error_message: string | null;
          raw_text: string | null;
          parsed: Json | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          resume_id: string;
          status?: string;
          error_message?: string | null;
          raw_text?: string | null;
          parsed?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          resume_id?: string;
          status?: string;
          error_message?: string | null;
          raw_text?: string | null;
          parsed?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
