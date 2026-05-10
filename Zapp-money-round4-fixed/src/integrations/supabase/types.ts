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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      academy_lessons: {
        Row: {
          category: string
          coin_reward: number
          content_body: string | null
          content_type: string
          content_url: string | null
          created_at: string
          description: string | null
          has_quiz: boolean
          id: string
          min_time_seconds: number
          quiz_pass_required: boolean
          sort_order: number
          status: string
          title: string
        }
        Insert: {
          category?: string
          coin_reward?: number
          content_body?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          description?: string | null
          has_quiz?: boolean
          id?: string
          min_time_seconds?: number
          quiz_pass_required?: boolean
          sort_order?: number
          status?: string
          title: string
        }
        Update: {
          category?: string
          coin_reward?: number
          content_body?: string | null
          content_type?: string
          content_url?: string | null
          created_at?: string
          description?: string | null
          has_quiz?: boolean
          id?: string
          min_time_seconds?: number
          quiz_pass_required?: boolean
          sort_order?: number
          status?: string
          title?: string
        }
        Relationships: []
      }
      academy_quizzes: {
        Row: {
          correct_index: number
          created_at: string
          id: string
          lesson_id: string
          options: Json
          question: string
          sort_order: number
        }
        Insert: {
          correct_index?: number
          created_at?: string
          id?: string
          lesson_id: string
          options?: Json
          question: string
          sort_order?: number
        }
        Update: {
          correct_index?: number
          created_at?: string
          id?: string
          lesson_id?: string
          options?: Json
          question?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          bonus_reward: number
          code: string
          color_class: string
          created_at: string
          criteria: Json
          description: string
          icon: string
          id: string
          name: string
          sort_order: number
          status: string
        }
        Insert: {
          bonus_reward?: number
          code: string
          color_class?: string
          created_at?: string
          criteria?: Json
          description: string
          icon?: string
          id?: string
          name: string
          sort_order?: number
          status?: string
        }
        Update: {
          bonus_reward?: number
          code?: string
          color_class?: string
          created_at?: string
          criteria?: Json
          description?: string
          icon?: string
          id?: string
          name?: string
          sort_order?: number
          status?: string
        }
        Relationships: []
      }
      coin_wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      currencies: {
        Row: {
          code: string
          country: string | null
          created_at: string
          id: string
          name: string
          status: string
          symbol: string
          zc_rate: number
        }
        Insert: {
          code: string
          country?: string | null
          created_at?: string
          id?: string
          name: string
          status?: string
          symbol?: string
          zc_rate?: number
        }
        Update: {
          code?: string
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: string
          symbol?: string
          zc_rate?: number
        }
        Relationships: []
      }
      daily_rewards: {
        Row: {
          claimed_at: string
          coin_reward: number
          id: string
          streak_day: number
          user_id: string
        }
        Insert: {
          claimed_at?: string
          coin_reward?: number
          id?: string
          streak_day?: number
          user_id: string
        }
        Update: {
          claimed_at?: string
          coin_reward?: number
          id?: string
          streak_day?: number
          user_id?: string
        }
        Relationships: []
      }
      earn_completions: {
        Row: {
          coin_reward: number
          completed_at: string
          id: string
          opportunity_id: string
          provider_reference: string | null
          status: string
          user_id: string
        }
        Insert: {
          coin_reward?: number
          completed_at?: string
          id?: string
          opportunity_id: string
          provider_reference?: string | null
          status?: string
          user_id: string
        }
        Update: {
          coin_reward?: number
          completed_at?: string
          id?: string
          opportunity_id?: string
          provider_reference?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "earn_completions_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "earn_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      earn_opportunities: {
        Row: {
          availability_type: string
          category: string
          coin_reward: number
          cooldown_hours: number | null
          created_at: string
          description: string | null
          estimated_fiat_value: number | null
          estimated_minutes: number
          external_reference_id: string | null
          id: string
          max_completions: number | null
          provider: string
          provider_config: Json | null
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          availability_type?: string
          category?: string
          coin_reward?: number
          cooldown_hours?: number | null
          created_at?: string
          description?: string | null
          estimated_fiat_value?: number | null
          estimated_minutes?: number
          external_reference_id?: string | null
          id?: string
          max_completions?: number | null
          provider?: string
          provider_config?: Json | null
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          availability_type?: string
          category?: string
          coin_reward?: number
          cooldown_hours?: number | null
          created_at?: string
          description?: string | null
          estimated_fiat_value?: number | null
          estimated_minutes?: number
          external_reference_id?: string | null
          id?: string
          max_completions?: number | null
          provider?: string
          provider_config?: Json | null
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      fee_config: {
        Row: {
          created_at: string
          description: string | null
          fee_type: string
          fixed_fee: number
          id: string
          max_fee: number
          min_fee: number
          percentage_fee: number
          product_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fee_type: string
          fixed_fee?: number
          id?: string
          max_fee?: number
          min_fee?: number
          percentage_fee?: number
          product_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fee_type?: string
          fixed_fee?: number
          id?: string
          max_fee?: number
          min_fee?: number
          percentage_fee?: number
          product_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      feed_events: {
        Row: {
          amount: number | null
          created_at: string
          description: string | null
          event_type: string
          hide_amount: boolean
          id: string
          meta: Json | null
          title: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description?: string | null
          event_type: string
          hide_amount?: boolean
          id?: string
          meta?: Json | null
          title: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string | null
          event_type?: string
          hide_amount?: boolean
          id?: string
          meta?: Json | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      feed_likes: {
        Row: {
          created_at: string
          event_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_likes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "feed_events"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_visibility_settings: {
        Row: {
          anonymous_mode: boolean
          created_at: string
          id: string
          show_activity: boolean
          show_amounts: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          anonymous_mode?: boolean
          created_at?: string
          id?: string
          show_activity?: boolean
          show_amounts?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          anonymous_mode?: boolean
          created_at?: string
          id?: string
          show_activity?: boolean
          show_amounts?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      international_transfers: {
        Row: {
          completed_at: string | null
          corridor_id: string | null
          created_at: string
          destination_amount: number
          destination_currency: string
          exchange_rate: number
          fee_amount: number
          id: string
          meta: Json | null
          provider_reference: string | null
          recipient_identifier: string
          reference: string | null
          sender_id: string
          source_amount: number
          source_currency: string
          status: string
          zc_bridge_amount: number
        }
        Insert: {
          completed_at?: string | null
          corridor_id?: string | null
          created_at?: string
          destination_amount: number
          destination_currency: string
          exchange_rate: number
          fee_amount?: number
          id?: string
          meta?: Json | null
          provider_reference?: string | null
          recipient_identifier: string
          reference?: string | null
          sender_id: string
          source_amount: number
          source_currency?: string
          status?: string
          zc_bridge_amount: number
        }
        Update: {
          completed_at?: string | null
          corridor_id?: string | null
          created_at?: string
          destination_amount?: number
          destination_currency?: string
          exchange_rate?: number
          fee_amount?: number
          id?: string
          meta?: Json | null
          provider_reference?: string | null
          recipient_identifier?: string
          reference?: string | null
          sender_id?: string
          source_amount?: number
          source_currency?: string
          status?: string
          zc_bridge_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "international_transfers_corridor_id_fkey"
            columns: ["corridor_id"]
            isOneToOne: false
            referencedRelation: "transfer_corridors"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_completions: {
        Row: {
          coin_reward: number
          completed_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          coin_reward?: number
          completed_at?: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          coin_reward?: number
          completed_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      networks: {
        Row: {
          color_class: string
          created_at: string
          id: string
          name: string
          sort_order: number
          status: string
          type: string
        }
        Insert: {
          color_class?: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          status?: string
          type?: string
        }
        Update: {
          color_class?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          status?: string
          type?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          meta: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          meta?: Json | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          meta?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          callback_data: Json | null
          created_at: string
          currency: string
          id: string
          meta: Json | null
          provider: string | null
          provider_reference: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          callback_data?: Json | null
          created_at?: string
          currency?: string
          id?: string
          meta?: Json | null
          provider?: string | null
          provider_reference?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          callback_data?: Json | null
          created_at?: string
          currency?: string
          id?: string
          meta?: Json | null
          provider?: string | null
          provider_reference?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payout_methods: {
        Row: {
          created_at: string
          details: Json
          id: string
          is_default: boolean
          label: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          is_default?: boolean
          label: string
          status?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          is_default?: boolean
          label?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          coin_balance: number
          created_at: string
          full_name: string | null
          id: string
          kyc_status: string
          phone_number: string | null
          referral_code: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          coin_balance?: number
          created_at?: string
          full_name?: string | null
          id?: string
          kyc_status?: string
          phone_number?: string | null
          referral_code?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          coin_balance?: number
          created_at?: string
          full_name?: string | null
          id?: string
          kyc_status?: string
          phone_number?: string | null
          referral_code?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      quiz_answers: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          lesson_id: string
          quiz_id: string
          selected_index: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          lesson_id: string
          quiz_id: string
          selected_index: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          lesson_id?: string
          quiz_id?: string
          selected_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "academy_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "academy_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
          reward_coins: number
        }
        Insert: {
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
          reward_coins?: number
        }
        Update: {
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
          reward_coins?: number
        }
        Relationships: []
      }
      rewarded_ad_sessions: {
        Row: {
          created_at: string
          id: string
          provider: string
          provider_reference: string | null
          reward_amount: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider?: string
          provider_reference?: string | null
          reward_amount?: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          provider?: string
          provider_reference?: string | null
          reward_amount?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      survey_completions: {
        Row: {
          completed_at: string
          id: string
          reward_coins: number
          survey_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          reward_coins?: number
          survey_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          reward_coins?: number
          survey_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_completions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          estimated_minutes: number
          id: string
          reward_coins: number
          title: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          estimated_minutes?: number
          id?: string
          reward_coins?: number
          title: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          estimated_minutes?: number
          id?: string
          reward_coins?: number
          title?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          meta: Json | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          meta?: Json | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          meta?: Json | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      transfer_corridors: {
        Row: {
          created_at: string
          destination_currency_id: string
          fee_percentage: number
          flat_fee: number
          id: string
          max_amount: number
          min_amount: number
          source_currency_id: string
          status: string
        }
        Insert: {
          created_at?: string
          destination_currency_id: string
          fee_percentage?: number
          flat_fee?: number
          id?: string
          max_amount?: number
          min_amount?: number
          source_currency_id: string
          status?: string
        }
        Update: {
          created_at?: string
          destination_currency_id?: string
          fee_percentage?: number
          flat_fee?: number
          id?: string
          max_amount?: number
          min_amount?: number
          source_currency_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_corridors_destination_currency_id_fkey"
            columns: ["destination_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_corridors_source_currency_id_fkey"
            columns: ["source_currency_id"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          bonus_paid: number
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          bonus_paid?: number
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          bonus_paid?: number
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_claim_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_claim_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_claim_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voucher_brands: {
        Row: {
          category: string
          color_class: string
          created_at: string
          id: string
          image_url: string | null
          name: string
          sort_order: number
          status: string
        }
        Insert: {
          category?: string
          color_class?: string
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          sort_order?: number
          status?: string
        }
        Update: {
          category?: string
          color_class?: string
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          sort_order?: number
          status?: string
        }
        Relationships: []
      }
      voucher_products: {
        Row: {
          api_reference: string | null
          brand_id: string
          created_at: string
          id: string
          price: number
          status: string
          value: number
        }
        Insert: {
          api_reference?: string | null
          brand_id: string
          created_at?: string
          id?: string
          price: number
          status?: string
          value: number
        }
        Update: {
          api_reference?: string | null
          brand_id?: string
          created_at?: string
          id?: string
          price?: number
          status?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "voucher_products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "voucher_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_ledger: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          reference: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          reference?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          reference?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          fee_amount: number
          id: string
          net_amount: number
          payout_method_id: string | null
          provider_reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          created_at?: string
          fee_amount?: number
          id?: string
          net_amount?: number
          payout_method_id?: string | null
          provider_reference?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          fee_amount?: number
          id?: string
          net_amount?: number
          payout_method_id?: string | null
          provider_reference?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_get_all_profiles: {
        Args: never
        Returns: {
          avatar_url: string | null
          coin_balance: number
          created_at: string
          full_name: string | null
          id: string
          kyc_status: string
          phone_number: string | null
          referral_code: string | null
          updated_at: string
          user_id: string
          username: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_get_all_transactions: {
        Args: never
        Returns: {
          amount: number
          created_at: string
          description: string
          id: string
          meta: Json | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_daily_reward: {
        Args: never
        Returns: {
          claimed_at: string
          coin_reward: number
          id: string
          streak_day: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "daily_rewards"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_academy_lesson: {
        Args: { p_lesson_id: string }
        Returns: {
          coin_reward: number
          completed_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "lesson_completions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_earn_opportunity: {
        Args: { p_opportunity_id: string }
        Returns: {
          coin_reward: number
          completed_at: string
          id: string
          opportunity_id: string
          provider_reference: string | null
          status: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "earn_completions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_survey: {
        Args: { p_survey_id: string }
        Returns: {
          completed_at: string
          id: string
          reward_coins: number
          survey_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "survey_completions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      convert_coins: {
        Args: { p_coins: number }
        Returns: {
          amount: number
          created_at: string
          description: string
          id: string
          meta: Json | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      evaluate_user_badges: {
        Args: never
        Returns: {
          awarded_at: string
          badge_id: string
          bonus_paid: number
          id: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "user_badges"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_wallet_balance: { Args: { p_user_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_international_transfer: {
        Args: {
          p_corridor_id: string
          p_destination_currency: string
          p_recipient: string
          p_source_amount: number
        }
        Returns: {
          completed_at: string | null
          corridor_id: string | null
          created_at: string
          destination_amount: number
          destination_currency: string
          exchange_rate: number
          fee_amount: number
          id: string
          meta: Json | null
          provider_reference: string | null
          recipient_identifier: string
          reference: string | null
          sender_id: string
          source_amount: number
          source_currency: string
          status: string
          zc_bridge_amount: number
        }
        SetofOptions: {
          from: "*"
          to: "international_transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      process_purchase: {
        Args: {
          p_amount: number
          p_description: string
          p_meta?: Json
          p_type: Database["public"]["Enums"]["transaction_type"]
        }
        Returns: {
          amount: number
          created_at: string
          description: string
          id: string
          meta: Json | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      process_withdrawal: {
        Args: { p_amount: number; p_payout_method_id?: string }
        Returns: {
          admin_notes: string | null
          amount: number
          created_at: string
          fee_amount: number
          id: string
          net_amount: number
          payout_method_id: string | null
          provider_reference: string | null
          status: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "withdrawal_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      top_up_wallet: {
        Args: { p_amount: number }
        Returns: {
          amount: number
          created_at: string
          description: string
          id: string
          meta: Json | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transfer_funds: {
        Args: {
          p_amount: number
          p_message?: string
          p_recipient_username: string
        }
        Returns: {
          amount: number
          created_at: string
          description: string
          id: string
          meta: Json | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      transaction_status: "completed" | "pending" | "failed"
      transaction_type:
        | "airtime"
        | "electricity"
        | "voucher"
        | "topup"
        | "transfer"
        | "survey_reward"
        | "coin_conversion"
        | "withdrawal"
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
      app_role: ["admin", "moderator", "user"],
      transaction_status: ["completed", "pending", "failed"],
      transaction_type: [
        "airtime",
        "electricity",
        "voucher",
        "topup",
        "transfer",
        "survey_reward",
        "coin_conversion",
        "withdrawal",
      ],
    },
  },
} as const
