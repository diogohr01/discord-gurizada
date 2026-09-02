export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      server_channels: {
        Row: {
          id: string;
          kind: "text" | "voice";
          name: string;
          topic: string;
          icon: "sound" | "game" | "sleep" | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["server_channels"]["Row"], "created_at"> & { created_at?: string };
        Update: Partial<Database["public"]["Tables"]["server_channels"]["Insert"]>;
        Relationships: [];
      };
      server_logs: {
        Row: { id: string; admin: string; action: string; detail: string; created_at: string };
        Insert: Omit<Database["public"]["Tables"]["server_logs"]["Row"], "created_at"> & { created_at?: string };
        Update: Partial<Database["public"]["Tables"]["server_logs"]["Insert"]>;
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          channel_id: string | null;
          dm_identity: string | null;
          author_identity: string;
          author_name: string;
          text: string;
          kind: "text" | "thread" | "poll" | "file";
          poll: Json | null;
          file_name: string | null;
          file_mime_type: string | null;
          file_size: number | null;
          storage_path: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["chat_messages"]["Row"], "created_at"> & { created_at?: string };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          profile_key: string;
          display_name: string;
          avatar_path: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at"> & { created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          email: string;
          username: string;
          username_key: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "username_key" | "created_at" | "updated_at"> & { created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
