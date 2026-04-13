/**
 * TypeScript mirrors of the Rust `Reports` types in wasm/src/lib.rs.
 *
 * The WASM module ships auto-generated `.d.ts` files, but its exports are
 * just `compute_reports(s: string): string` — the inner JSON schema isn't
 * typed. These interfaces give us autocomplete on the parsed result.
 */

export interface Totals {
  input: number
  output: number
  cache_create: number
  cache_read: number
  total: number
  cost_usd: number
  event_count: number
}

export interface PeriodRow extends Totals {
  label: string
  models: string[]
}

export interface SessionRow extends Totals {
  session_id: string
  project_id: string
  start: string
  end: string
  duration_minutes: number
  models: string[]
}

export interface BlockRow extends Totals {
  start: string
  end: string
  is_active: boolean
  minutes_elapsed: number
  minutes_remaining: number
  models: string[]
  burn_rate_per_min: number
  projected_total: number
}

export interface Reports {
  daily: PeriodRow[]
  weekly: PeriodRow[]
  monthly: PeriodRow[]
  sessions: SessionRow[]
  blocks: BlockRow[]
  grand_total: Totals
  unpriced_models: string[]
}

export interface ModelPricing {
  input_cost_per_token?: number
  output_cost_per_token?: number
  cache_creation_input_token_cost?: number
  cache_read_input_token_cost?: number
}

export type PricingTable = Record<string, ModelPricing>
