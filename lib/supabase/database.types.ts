export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ai_requests: {
        Row: {
          created_at: string;
          feature: string;
          id: string;
          model: string;
          ok: boolean;
          tier: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          feature: string;
          id?: string;
          model: string;
          ok: boolean;
          tier: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          feature?: string;
          id?: string;
          model?: string;
          ok?: boolean;
          tier?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      allowed_emails: {
        Row: {
          added_at: string;
          email: string;
          note: string | null;
        };
        ComputedFields: never;
        Insert: {
          added_at?: string;
          email: string;
          note?: string | null;
        };
        Update: {
          added_at?: string;
          email?: string;
          note?: string | null;
        };
        Relationships: [];
      };
      app_admins: {
        Row: {
          added_at: string;
          email: string;
        };
        ComputedFields: never;
        Insert: {
          added_at?: string;
          email: string;
        };
        Update: {
          added_at?: string;
          email?: string;
        };
        Relationships: [];
      };
      bill_status: {
        Row: {
          bill_key: string;
          id: string;
          month: string;
          paid: boolean;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          bill_key: string;
          id?: string;
          month: string;
          paid?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          bill_key?: string;
          id?: string;
          month?: string;
          paid?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      card_bills: {
        Row: {
          amount: number;
          card_id: string;
          created_at: string;
          due_date: string | null;
          id: string;
          month: string;
          note: string | null;
          paid: boolean;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          card_id: string;
          created_at?: string;
          due_date?: string | null;
          id?: string;
          month: string;
          note?: string | null;
          paid?: boolean;
          user_id?: string;
        };
        Update: {
          amount?: number;
          card_id?: string;
          created_at?: string;
          due_date?: string | null;
          id?: string;
          month?: string;
          note?: string | null;
          paid?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "card_bills_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "credit_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      card_milestones: {
        Row: {
          card_id: string;
          created_at: string;
          deadline: string | null;
          id: string;
          name: string;
          period: string;
          reward: string | null;
          target: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          card_id: string;
          created_at?: string;
          deadline?: string | null;
          id?: string;
          name: string;
          period: string;
          reward?: string | null;
          target: number;
          user_id?: string;
        };
        Update: {
          card_id?: string;
          created_at?: string;
          deadline?: string | null;
          id?: string;
          name?: string;
          period?: string;
          reward?: string | null;
          target?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "card_milestones_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "credit_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      consents: {
        Row: {
          created_at: string;
          granted: boolean;
          id: string;
          kind: Database["public"]["Enums"]["consent_kind"];
          user_id: string;
          version: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          granted?: boolean;
          id?: string;
          kind: Database["public"]["Enums"]["consent_kind"];
          user_id?: string;
          version: string;
        };
        Update: {
          created_at?: string;
          granted?: boolean;
          id?: string;
          kind?: Database["public"]["Enums"]["consent_kind"];
          user_id?: string;
          version?: string;
        };
        Relationships: [];
      };
      credit_cards: {
        Row: {
          annual_fee: number | null;
          benefits: string[];
          best_for: string[];
          created_at: string;
          due_day: number | null;
          id: string;
          label: string;
          outstanding: number;
          rewards: string | null;
          statement_day: number | null;
          unbilled: number;
          unbilled_as_of: string | null;
          user_id: string;
          year_start: string | null;
        };
        ComputedFields: never;
        Insert: {
          annual_fee?: number | null;
          benefits?: string[];
          best_for?: string[];
          created_at?: string;
          due_day?: number | null;
          id?: string;
          label: string;
          outstanding?: number;
          rewards?: string | null;
          statement_day?: number | null;
          unbilled?: number;
          unbilled_as_of?: string | null;
          user_id?: string;
          year_start?: string | null;
        };
        Update: {
          annual_fee?: number | null;
          benefits?: string[];
          best_for?: string[];
          created_at?: string;
          due_day?: number | null;
          id?: string;
          label?: string;
          outstanding?: number;
          rewards?: string | null;
          statement_day?: number | null;
          unbilled?: number;
          unbilled_as_of?: string | null;
          user_id?: string;
          year_start?: string | null;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          amount_monthly: number;
          category: string;
          id: string;
          is_essential: boolean;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount_monthly: number;
          category: string;
          id?: string;
          is_essential?: boolean;
          user_id?: string;
        };
        Update: {
          amount_monthly?: number;
          category?: string;
          id?: string;
          is_essential?: boolean;
          user_id?: string;
        };
        Relationships: [];
      };
      goal_allocations: {
        Row: {
          goal_id: string;
          holding_id: string;
          id: string;
          percent: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          goal_id: string;
          holding_id: string;
          id?: string;
          percent: number;
          user_id?: string;
        };
        Update: {
          goal_id?: string;
          holding_id?: string;
          id?: string;
          percent?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goal_allocations_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "goal_allocations_holding_id_fkey";
            columns: ["holding_id"];
            isOneToOne: false;
            referencedRelation: "holdings";
            referencedColumns: ["id"];
          },
        ];
      };
      goal_bills: {
        Row: {
          amount: number;
          created_at: string;
          every_months: number;
          goal_id: string;
          id: string;
          name: string;
          next_due: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          every_months: number;
          goal_id: string;
          id?: string;
          name: string;
          next_due: string;
          user_id?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          every_months?: number;
          goal_id?: string;
          id?: string;
          name?: string;
          next_due?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "goal_bills_goal_id_fkey";
            columns: ["goal_id"];
            isOneToOne: false;
            referencedRelation: "goals";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          created_at: string;
          id: string;
          inflation_rate: number | null;
          loan_as_of: string | null;
          loan_emi: number | null;
          loan_emi_day: number | null;
          loan_first_emi: string | null;
          loan_foreclosure_gst: boolean;
          loan_foreclosure_pct: number | null;
          loan_months_left: number | null;
          loan_outstanding: number | null;
          loan_rate: number | null;
          name: string;
          priority: number;
          saved_amount: number;
          status: string | null;
          target_date: string | null;
          target_today: number;
          type: Database["public"]["Enums"]["goal_type"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          inflation_rate?: number | null;
          loan_as_of?: string | null;
          loan_emi?: number | null;
          loan_emi_day?: number | null;
          loan_first_emi?: string | null;
          loan_foreclosure_gst?: boolean;
          loan_foreclosure_pct?: number | null;
          loan_months_left?: number | null;
          loan_outstanding?: number | null;
          loan_rate?: number | null;
          name: string;
          priority?: number;
          saved_amount?: number;
          status?: string | null;
          target_date?: string | null;
          target_today: number;
          type: Database["public"]["Enums"]["goal_type"];
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          inflation_rate?: number | null;
          loan_as_of?: string | null;
          loan_emi?: number | null;
          loan_emi_day?: number | null;
          loan_first_emi?: string | null;
          loan_foreclosure_gst?: boolean;
          loan_foreclosure_pct?: number | null;
          loan_months_left?: number | null;
          loan_outstanding?: number | null;
          loan_rate?: number | null;
          name?: string;
          priority?: number;
          saved_amount?: number;
          status?: string | null;
          target_date?: string | null;
          target_today?: number;
          type?: Database["public"]["Enums"]["goal_type"];
          user_id?: string;
        };
        Relationships: [];
      };
      holdings: {
        Row: {
          category: string | null;
          current_value: number;
          expected_return_pct: number | null;
          id: string;
          invested: number | null;
          isin: string | null;
          kind: Database["public"]["Enums"]["holding_kind"];
          monthly_sip: number | null;
          name: string | null;
          purpose: string | null;
          sip_step_up_pct: number | null;
          source: Database["public"]["Enums"]["holding_source"];
          transition_fund: boolean;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          category?: string | null;
          current_value?: number;
          expected_return_pct?: number | null;
          id?: string;
          invested?: number | null;
          isin?: string | null;
          kind: Database["public"]["Enums"]["holding_kind"];
          monthly_sip?: number | null;
          name?: string | null;
          purpose?: string | null;
          sip_step_up_pct?: number | null;
          source?: Database["public"]["Enums"]["holding_source"];
          transition_fund?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          category?: string | null;
          current_value?: number;
          expected_return_pct?: number | null;
          id?: string;
          invested?: number | null;
          isin?: string | null;
          kind?: Database["public"]["Enums"]["holding_kind"];
          monthly_sip?: number | null;
          name?: string | null;
          purpose?: string | null;
          sip_step_up_pct?: number | null;
          source?: Database["public"]["Enums"]["holding_source"];
          transition_fund?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      income_entries: {
        Row: {
          amount: number;
          id: string;
          month: string;
          stream_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          id?: string;
          month: string;
          stream_id: string;
          user_id?: string;
        };
        Update: {
          amount?: number;
          id?: string;
          month?: string;
          stream_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "income_entries_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "income_streams";
            referencedColumns: ["id"];
          },
        ];
      };
      income_streams: {
        Row: {
          active: boolean;
          amount_monthly: number;
          created_at: string;
          fixed_monthly: number | null;
          id: string;
          is_gross: boolean;
          is_primary: boolean;
          label: string;
          type: Database["public"]["Enums"]["income_type"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          amount_monthly?: number;
          created_at?: string;
          fixed_monthly?: number | null;
          id?: string;
          is_gross?: boolean;
          is_primary?: boolean;
          label: string;
          type: Database["public"]["Enums"]["income_type"];
          user_id?: string;
        };
        Update: {
          active?: boolean;
          amount_monthly?: number;
          created_at?: string;
          fixed_monthly?: number | null;
          id?: string;
          is_gross?: boolean;
          is_primary?: boolean;
          label?: string;
          type?: Database["public"]["Enums"]["income_type"];
          user_id?: string;
        };
        Relationships: [];
      };
      insurance_policies: {
        Row: {
          cover_amount: number;
          covers: string;
          debit_day: number | null;
          id: string;
          in_budget: boolean;
          kind: Database["public"]["Enums"]["insurance_kind"];
          premium: number | null;
          premium_frequency: string;
          renewal_date: string | null;
          renewal_month: number | null;
          source: Database["public"]["Enums"]["insurance_source"];
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          cover_amount?: number;
          covers?: string;
          debit_day?: number | null;
          id?: string;
          in_budget?: boolean;
          kind: Database["public"]["Enums"]["insurance_kind"];
          premium?: number | null;
          premium_frequency?: string;
          renewal_date?: string | null;
          renewal_month?: number | null;
          source: Database["public"]["Enums"]["insurance_source"];
          user_id?: string;
        };
        Update: {
          cover_amount?: number;
          covers?: string;
          debit_day?: number | null;
          id?: string;
          in_budget?: boolean;
          kind?: Database["public"]["Enums"]["insurance_kind"];
          premium?: number | null;
          premium_frequency?: string;
          renewal_date?: string | null;
          renewal_month?: number | null;
          source?: Database["public"]["Enums"]["insurance_source"];
          user_id?: string;
        };
        Relationships: [];
      };
      liabilities: {
        Row: {
          emi: number | null;
          id: string;
          interest_rate: number | null;
          kind: Database["public"]["Enums"]["liability_kind"];
          label: string | null;
          outstanding: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          emi?: number | null;
          id?: string;
          interest_rate?: number | null;
          kind: Database["public"]["Enums"]["liability_kind"];
          label?: string | null;
          outstanding?: number;
          user_id?: string;
        };
        Update: {
          emi?: number | null;
          id?: string;
          interest_rate?: number | null;
          kind?: Database["public"]["Enums"]["liability_kind"];
          label?: string | null;
          outstanding?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      month_bills: {
        Row: {
          amount: number | null;
          card_id: string | null;
          created_at: string;
          due_day: number | null;
          id: string;
          label: string;
          month: string;
          recurring: boolean;
          series_id: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount?: number | null;
          card_id?: string | null;
          created_at?: string;
          due_day?: number | null;
          id?: string;
          label: string;
          month: string;
          recurring?: boolean;
          series_id?: string;
          user_id?: string;
        };
        Update: {
          amount?: number | null;
          card_id?: string | null;
          created_at?: string;
          due_day?: number | null;
          id?: string;
          label?: string;
          month?: string;
          recurring?: boolean;
          series_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "month_bills_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "credit_cards";
            referencedColumns: ["id"];
          },
        ];
      };
      planned_expenses: {
        Row: {
          amount: number;
          created_at: string;
          every_months: number;
          id: string;
          in_budget: boolean;
          name: string;
          next_due: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          every_months?: number;
          id?: string;
          in_budget?: boolean;
          name: string;
          next_due?: string | null;
          user_id?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          every_months?: number;
          id?: string;
          in_budget?: boolean;
          name?: string;
          next_due?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          accent: string;
          age: number | null;
          ai_enabled: boolean;
          answered_sections: string[];
          city_tier: Database["public"]["Enums"]["city_tier"] | null;
          created_at: string;
          dependents: number | null;
          disclaimer_accepted_at: string | null;
          dob: string | null;
          marital_status: Database["public"]["Enums"]["marital_status"] | null;
          name: string;
          onboarding_completed_at: string | null;
          plan_lump_sum: number | null;
          plan_monthly: number | null;
          risk_profile: Database["public"]["Enums"]["risk_profile"] | null;
          sole_earner: boolean | null;
          theme: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          accent?: string;
          age?: number | null;
          ai_enabled?: boolean;
          answered_sections?: string[];
          city_tier?: Database["public"]["Enums"]["city_tier"] | null;
          created_at?: string;
          dependents?: number | null;
          disclaimer_accepted_at?: string | null;
          dob?: string | null;
          marital_status?: Database["public"]["Enums"]["marital_status"] | null;
          name?: string;
          onboarding_completed_at?: string | null;
          plan_lump_sum?: number | null;
          plan_monthly?: number | null;
          risk_profile?: Database["public"]["Enums"]["risk_profile"] | null;
          sole_earner?: boolean | null;
          theme?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          accent?: string;
          age?: number | null;
          ai_enabled?: boolean;
          answered_sections?: string[];
          city_tier?: Database["public"]["Enums"]["city_tier"] | null;
          created_at?: string;
          dependents?: number | null;
          disclaimer_accepted_at?: string | null;
          dob?: string | null;
          marital_status?: Database["public"]["Enums"]["marital_status"] | null;
          name?: string;
          onboarding_completed_at?: string | null;
          plan_lump_sum?: number | null;
          plan_monthly?: number | null;
          risk_profile?: Database["public"]["Enums"]["risk_profile"] | null;
          sole_earner?: boolean | null;
          theme?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          config_overrides: NonNullable<Json>;
          seen_guides: string[];
          updated_at: string;
          user_id: string;
          whats_new_seen: string | null;
        };
        ComputedFields: never;
        Insert: {
          config_overrides?: NonNullable<Json>;
          seen_guides?: string[];
          updated_at?: string;
          user_id: string;
          whats_new_seen?: string | null;
        };
        Update: {
          config_overrides?: NonNullable<Json>;
          seen_guides?: string[];
          updated_at?: string;
          user_id?: string;
          whats_new_seen?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_invite: {
        Args: { p_email: string; p_note?: string };
        Returns: undefined;
      };
      caller_email: { Args: Record<PropertyKey, never>; Returns: string };
      delete_my_account: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      list_invites: {
        Args: Record<PropertyKey, never>;
        Returns: {
          added_at: string;
          email: string;
          joined: boolean;
          note: string;
        }[];
      };
      remove_invite: { Args: { p_email: string }; Returns: undefined };
    };
    Enums: {
      city_tier: "metro" | "tier2" | "tier3";
      consent_kind: "privacy_policy" | "disclaimer" | "ai_processing";
      goal_type:
        | "emergency_fund"
        | "insurance_premium_fund"
        | "wedding"
        | "house_down_payment"
        | "vehicle"
        | "education"
        | "travel"
        | "retirement"
        | "medical"
        | "custom"
        | "loan_payoff"
        | "bills_fund";
      holding_kind:
        | "savings"
        | "fd"
        | "ppf"
        | "epf"
        | "nps"
        | "mutual_fund"
        | "stock"
        | "gold"
        | "other";
      holding_source: "manual" | "cas";
      income_type:
        | "stable_salary"
        | "variable_salary"
        | "freelance"
        | "business"
        | "rental"
        | "bonus"
        | "other";
      insurance_kind: "health" | "term" | "other";
      insurance_source: "personal" | "employer" | "family";
      liability_kind:
        | "credit_card"
        | "personal_loan"
        | "car"
        | "home"
        | "education"
        | "other";
      marital_status: "single" | "married" | "other";
      risk_profile: "conservative" | "moderate" | "aggressive";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      city_tier: ["metro", "tier2", "tier3"],
      consent_kind: ["privacy_policy", "disclaimer", "ai_processing"],
      goal_type: [
        "emergency_fund",
        "insurance_premium_fund",
        "wedding",
        "house_down_payment",
        "vehicle",
        "education",
        "travel",
        "retirement",
        "medical",
        "custom",
        "loan_payoff",
        "bills_fund",
      ],
      holding_kind: [
        "savings",
        "fd",
        "ppf",
        "epf",
        "nps",
        "mutual_fund",
        "stock",
        "gold",
        "other",
      ],
      holding_source: ["manual", "cas"],
      income_type: [
        "stable_salary",
        "variable_salary",
        "freelance",
        "business",
        "rental",
        "bonus",
        "other",
      ],
      insurance_kind: ["health", "term", "other"],
      insurance_source: ["personal", "employer", "family"],
      liability_kind: [
        "credit_card",
        "personal_loan",
        "car",
        "home",
        "education",
        "other",
      ],
      marital_status: ["single", "married", "other"],
      risk_profile: ["conservative", "moderate", "aggressive"],
    },
  },
} as const;
