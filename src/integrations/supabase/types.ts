export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      sessions: {
        Row: {
          id: string;
          code: string;
          name: string | null;
          control_count: number;
          status: string;
          round: number;
          created_at: string;
          started_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          name?: string | null;
          control_count?: number;
          status?: string;
          round?: number;
          created_at?: string;
          started_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string | null;
          control_count?: number;
          status?: string;
          round?: number;
          created_at?: string;
          started_at?: string | null;
        };
        Relationships: [];
      };
      controls: {
        Row: {
          id: string;
          session_id: string;
          number: number;
          token: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          number: number;
          token: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          number?: number;
          token?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "controls_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      participants: {
        Row: {
          id: string;
          session_id: string;
          name: string;
          round: number;
          joined_at: string;
          finished_at: string | null;
          result_ms: number | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          name: string;
          round?: number;
          joined_at?: string;
          finished_at?: string | null;
          result_ms?: number | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          name?: string;
          round?: number;
          joined_at?: string;
          finished_at?: string | null;
          result_ms?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "participants_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      punches: {
        Row: {
          id: string;
          participant_id: string;
          control_id: string;
          punched_at: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          control_id: string;
          punched_at?: string;
        };
        Update: {
          id?: string;
          participant_id?: string;
          control_id?: string;
          punched_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "punches_participant_id_fkey";
            columns: ["participant_id"];
            isOneToOne: false;
            referencedRelation: "participants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "punches_control_id_fkey";
            columns: ["control_id"];
            isOneToOne: false;
            referencedRelation: "controls";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
