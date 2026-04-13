use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};

// ═══════════════════════════════════════════════════════════════════════════
// Trends module (unchanged)
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
struct DailyActivity {
    date: String,
    message_count: u64,
    session_count: u64,
    tool_call_count: u64,
}

#[derive(Serialize, Deserialize)]
pub struct TrendMetrics {
    pub moving_avg_7d: Vec<Option<f64>>,
    pub moving_avg_30d: Vec<Option<f64>>,
    pub current_streak: u32,
    pub longest_streak: u32,
    pub best_day: Option<BestDay>,
    pub trend_7d: String,
    pub weekly_totals: Vec<WeekSummary>,
    pub pct_change_7d: f64,
}

#[derive(Serialize, Deserialize)]
pub struct BestDay {
    pub date: String,
    pub message_count: u64,
}

#[derive(Serialize, Deserialize)]
pub struct WeekSummary {
    pub week_start: String,
    pub messages: u64,
    pub sessions: u64,
    pub tool_calls: u64,
}

#[wasm_bindgen]
pub fn compute_trends(daily_json: &str) -> String {
    match compute_trends_inner(daily_json) {
        Ok(metrics) => serde_json::to_string(&metrics).unwrap_or_else(|e| format!("error:{e}")),
        Err(e) => format!("error:{e}"),
    }
}

fn compute_trends_inner(daily_json: &str) -> Result<TrendMetrics, String> {
    let days: Vec<DailyActivity> =
        serde_json::from_str(daily_json).map_err(|e| e.to_string())?;

    if days.is_empty() {
        return Ok(TrendMetrics {
            moving_avg_7d: vec![],
            moving_avg_30d: vec![],
            current_streak: 0,
            longest_streak: 0,
            best_day: None,
            trend_7d: "stable".to_string(),
            weekly_totals: vec![],
            pct_change_7d: 0.0,
        });
    }

    let counts: Vec<f64> = days.iter().map(|d| d.message_count as f64).collect();
    let moving_avg_7d = moving_average(&counts, 7);
    let moving_avg_30d = moving_average(&counts, 30);
    let (current_streak, longest_streak) = compute_streaks(&days);
    let best_day = days
        .iter()
        .max_by_key(|d| d.message_count)
        .filter(|d| d.message_count > 0)
        .map(|d| BestDay { date: d.date.clone(), message_count: d.message_count });
    let (trend_7d, pct_change_7d) = compute_7d_trend(&counts);
    let weekly_totals = compute_weekly(&days);

    Ok(TrendMetrics {
        moving_avg_7d,
        moving_avg_30d,
        current_streak,
        longest_streak,
        best_day,
        trend_7d,
        weekly_totals,
        pct_change_7d,
    })
}

fn moving_average(values: &[f64], window: usize) -> Vec<Option<f64>> {
    values
        .iter()
        .enumerate()
        .map(|(i, _)| {
            if i + 1 < window { None }
            else {
                let sum: f64 = values[i + 1 - window..=i].iter().sum();
                Some((sum / window as f64 * 10.0).round() / 10.0)
            }
        })
        .collect()
}

fn compute_streaks(days: &[DailyActivity]) -> (u32, u32) {
    let mut longest = 0u32;
    let mut run = 0u32;
    for day in days {
        if day.message_count > 0 {
            run += 1;
            if run > longest { longest = run; }
        } else {
            run = 0;
        }
    }
    let mut current = 0u32;
    for day in days.iter().rev() {
        if day.message_count > 0 { current += 1; } else { break; }
    }
    (current, longest)
}

fn compute_7d_trend(counts: &[f64]) -> (String, f64) {
    let n = counts.len();
    if n < 2 { return ("stable".to_string(), 0.0); }
    let last7: f64 = counts[n.saturating_sub(7)..].iter().sum();
    let prev7: f64 = counts[n.saturating_sub(14)..n.saturating_sub(7)].iter().sum();
    if prev7 == 0.0 {
        return if last7 > 0.0 { ("up".to_string(), 100.0) } else { ("stable".to_string(), 0.0) };
    }
    let pct = ((last7 - prev7) / prev7 * 100.0 * 10.0).round() / 10.0;
    let direction = if pct > 5.0 { "up" } else if pct < -5.0 { "down" } else { "stable" };
    (direction.to_string(), pct)
}

fn compute_weekly(days: &[DailyActivity]) -> Vec<WeekSummary> {
    let mut weeks: Vec<WeekSummary> = vec![];
    for chunk in days.chunks(7) {
        let week_start = chunk[0].date.clone();
        let messages: u64 = chunk.iter().map(|d| d.message_count).sum();
        let sessions: u64 = chunk.iter().map(|d| d.session_count).sum();
        let tool_calls: u64 = chunk.iter().map(|d| d.tool_call_count).sum();
        weeks.push(WeekSummary { week_start, messages, sessions, tool_calls });
    }
    weeks
}

// ═══════════════════════════════════════════════════════════════════════════
// Reports module — new
// ═══════════════════════════════════════════════════════════════════════════

/// Raw usage event (one per assistant turn with usage data).
#[derive(Deserialize, Clone)]
pub struct UsageEvent {
    pub timestamp: String, // ISO-8601
    pub session_id: String,
    pub project_id: String,
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_creation_input_tokens: u64,
    pub cache_read_input_tokens: u64,
}

/// Per-model pricing (per-token USD rates). Fields match LiteLLM's schema.
#[derive(Deserialize, Clone, Default)]
pub struct ModelPricing {
    #[serde(default)]
    pub input_cost_per_token: f64,
    #[serde(default)]
    pub output_cost_per_token: f64,
    #[serde(default)]
    pub cache_creation_input_token_cost: f64,
    #[serde(default)]
    pub cache_read_input_token_cost: f64,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Totals {
    pub input: u64,
    pub output: u64,
    pub cache_create: u64,
    pub cache_read: u64,
    pub total: u64,
    pub cost_usd: f64,
    pub event_count: u32,
}

#[derive(Serialize, Deserialize)]
pub struct PeriodRow {
    pub label: String,
    pub models: Vec<String>,
    #[serde(flatten)]
    pub totals: Totals,
}

#[derive(Serialize, Deserialize)]
pub struct SessionRow {
    pub session_id: String,
    pub project_id: String,
    pub start: String,
    pub end: String,
    pub duration_minutes: u32,
    pub models: Vec<String>,
    #[serde(flatten)]
    pub totals: Totals,
}

#[derive(Serialize, Deserialize)]
pub struct BlockRow {
    pub start: String,
    pub end: String, // block_start + 5h (ISO)
    pub is_active: bool,
    pub minutes_elapsed: u32,
    pub minutes_remaining: u32,
    pub models: Vec<String>,
    #[serde(flatten)]
    pub totals: Totals,
    /// tokens/minute burn rate for active blocks; 0 for completed
    pub burn_rate_per_min: f64,
    /// projected total tokens if the current rate holds for the full 5-hour window
    pub projected_total: u64,
}

#[derive(Serialize, Deserialize)]
pub struct Reports {
    pub daily: Vec<PeriodRow>,
    pub weekly: Vec<PeriodRow>,
    pub monthly: Vec<PeriodRow>,
    pub sessions: Vec<SessionRow>,
    pub blocks: Vec<BlockRow>,
    pub grand_total: Totals,
    pub unpriced_models: Vec<String>,
}

/// Input envelope that `compute_reports` expects. Everything comes over as JSON.
#[derive(Deserialize)]
struct ReportsInput {
    events: Vec<UsageEvent>,
    pricing: HashMap<String, ModelPricing>,
    /// Current wall-clock time as epoch seconds (from the browser). We accept
    /// this as input so the WASM module stays pure and testable.
    now_epoch_secs: i64,
}

#[wasm_bindgen]
pub fn compute_reports(input_json: &str) -> String {
    match compute_reports_inner(input_json) {
        Ok(r) => serde_json::to_string(&r).unwrap_or_else(|e| format!("error:{e}")),
        Err(e) => format!("error:{e}"),
    }
}

fn compute_reports_inner(input_json: &str) -> Result<Reports, String> {
    let input: ReportsInput = serde_json::from_str(input_json).map_err(|e| e.to_string())?;

    let pricing = &input.pricing;
    let mut events = input.events;
    // Sort ascending by timestamp so block detection is deterministic
    events.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

    let mut unpriced: HashSet<String> = HashSet::new();

    // ── Grand total ────────────────────────────────────────────────────────
    let mut grand = Totals::default();
    for ev in &events {
        accumulate(&mut grand, ev, pricing, &mut unpriced);
    }

    // ── Daily / Weekly / Monthly ───────────────────────────────────────────
    let daily = group_by(&events, |ev| date_part(&ev.timestamp), pricing, &mut unpriced);
    let weekly = group_by(&events, |ev| week_start(&ev.timestamp), pricing, &mut unpriced);
    let monthly = group_by(&events, |ev| month_part(&ev.timestamp), pricing, &mut unpriced);

    // ── Sessions ───────────────────────────────────────────────────────────
    let sessions = group_sessions(&events, pricing, &mut unpriced);

    // ── 5-hour blocks ──────────────────────────────────────────────────────
    let blocks = group_blocks(&events, pricing, &mut unpriced, input.now_epoch_secs);

    let mut unpriced_vec: Vec<String> = unpriced.into_iter().collect();
    unpriced_vec.sort();

    Ok(Reports {
        daily,
        weekly,
        monthly,
        sessions,
        blocks,
        grand_total: grand,
        unpriced_models: unpriced_vec,
    })
}

// ─── Accumulation helpers ────────────────────────────────────────────────────

fn accumulate(
    totals: &mut Totals,
    ev: &UsageEvent,
    pricing: &HashMap<String, ModelPricing>,
    unpriced: &mut HashSet<String>,
) {
    totals.input += ev.input_tokens;
    totals.output += ev.output_tokens;
    totals.cache_create += ev.cache_creation_input_tokens;
    totals.cache_read += ev.cache_read_input_tokens;
    totals.total += ev.input_tokens
        + ev.output_tokens
        + ev.cache_creation_input_tokens
        + ev.cache_read_input_tokens;
    totals.cost_usd += cost_of(ev, pricing, unpriced);
    totals.event_count += 1;
}

fn cost_of(
    ev: &UsageEvent,
    pricing: &HashMap<String, ModelPricing>,
    unpriced: &mut HashSet<String>,
) -> f64 {
    // Try exact match first, then strip trailing "-YYYYMMDD" or similar
    let price = pricing
        .get(&ev.model)
        .or_else(|| pricing.get(strip_date_suffix(&ev.model)))
        .cloned();

    let Some(p) = price else {
        unpriced.insert(ev.model.clone());
        return 0.0;
    };

    ev.input_tokens as f64 * p.input_cost_per_token
        + ev.output_tokens as f64 * p.output_cost_per_token
        + ev.cache_creation_input_tokens as f64 * p.cache_creation_input_token_cost
        + ev.cache_read_input_tokens as f64 * p.cache_read_input_token_cost
}

fn strip_date_suffix(model: &str) -> &str {
    // "claude-sonnet-4-5-20250929" -> "claude-sonnet-4-5"
    if let Some(idx) = model.rfind('-') {
        let suffix = &model[idx + 1..];
        if suffix.len() == 8 && suffix.chars().all(|c| c.is_ascii_digit()) {
            return &model[..idx];
        }
    }
    model
}

// ─── Period grouping (daily / weekly / monthly) ──────────────────────────────

fn group_by<F>(
    events: &[UsageEvent],
    key_fn: F,
    pricing: &HashMap<String, ModelPricing>,
    unpriced: &mut HashSet<String>,
) -> Vec<PeriodRow>
where
    F: Fn(&UsageEvent) -> String,
{
    let mut buckets: BTreeMap<String, (Totals, HashSet<String>)> = BTreeMap::new();

    for ev in events {
        let key = key_fn(ev);
        let entry = buckets.entry(key).or_default();
        accumulate(&mut entry.0, ev, pricing, unpriced);
        entry.1.insert(ev.model.clone());
    }

    buckets
        .into_iter()
        .map(|(label, (totals, models))| {
            let mut m: Vec<String> = models.into_iter().collect();
            m.sort();
            PeriodRow { label, models: m, totals }
        })
        .collect()
}

// ─── Session grouping ────────────────────────────────────────────────────────

fn group_sessions(
    events: &[UsageEvent],
    pricing: &HashMap<String, ModelPricing>,
    unpriced: &mut HashSet<String>,
) -> Vec<SessionRow> {
    struct Agg {
        start: String,
        end: String,
        project_id: String,
        totals: Totals,
        models: HashSet<String>,
    }

    let mut by_session: HashMap<String, Agg> = HashMap::new();

    for ev in events {
        let entry = by_session.entry(ev.session_id.clone()).or_insert_with(|| Agg {
            start: ev.timestamp.clone(),
            end: ev.timestamp.clone(),
            project_id: ev.project_id.clone(),
            totals: Totals::default(),
            models: HashSet::new(),
        });
        if ev.timestamp < entry.start { entry.start = ev.timestamp.clone(); }
        if ev.timestamp > entry.end { entry.end = ev.timestamp.clone(); }
        entry.models.insert(ev.model.clone());
        accumulate(&mut entry.totals, ev, pricing, unpriced);
    }

    let mut rows: Vec<SessionRow> = by_session
        .into_iter()
        .map(|(session_id, agg)| {
            let duration_minutes = duration_minutes(&agg.start, &agg.end);
            let mut models: Vec<String> = agg.models.into_iter().collect();
            models.sort();
            SessionRow {
                session_id,
                project_id: agg.project_id,
                start: agg.start,
                end: agg.end,
                duration_minutes,
                models,
                totals: agg.totals,
            }
        })
        .collect();

    // Most recent session first
    rows.sort_by(|a, b| b.start.cmp(&a.start));
    rows
}

// ─── 5-hour block grouping ───────────────────────────────────────────────────

const BLOCK_SECS: i64 = 5 * 60 * 60;

fn group_blocks(
    events: &[UsageEvent],
    pricing: &HashMap<String, ModelPricing>,
    unpriced: &mut HashSet<String>,
    now_epoch: i64,
) -> Vec<BlockRow> {
    if events.is_empty() { return vec![]; }

    struct Agg {
        start_epoch: i64,
        totals: Totals,
        models: HashSet<String>,
        first_ts: String,
    }
    let mut blocks: Vec<Agg> = vec![];

    for ev in events {
        let ts_epoch = match parse_epoch(&ev.timestamp) {
            Some(t) => t,
            None => continue,
        };

        // Fits the last block?
        let new_block = match blocks.last() {
            Some(last) if ts_epoch < last.start_epoch + BLOCK_SECS => false,
            _ => true,
        };
        if new_block {
            blocks.push(Agg {
                start_epoch: ts_epoch,
                totals: Totals::default(),
                models: HashSet::new(),
                first_ts: ev.timestamp.clone(),
            });
        }
        let last = blocks.last_mut().unwrap();
        accumulate(&mut last.totals, ev, pricing, unpriced);
        last.models.insert(ev.model.clone());
    }

    blocks
        .into_iter()
        .rev() // newest first
        .map(|agg| {
            let end_epoch = agg.start_epoch + BLOCK_SECS;
            let is_active = now_epoch < end_epoch;
            let elapsed_secs = (now_epoch - agg.start_epoch).max(0).min(BLOCK_SECS);
            let remaining_secs = if is_active { (end_epoch - now_epoch).max(0) } else { 0 };
            let elapsed_min = (elapsed_secs / 60) as u32;
            let remaining_min = (remaining_secs / 60) as u32;

            let burn_rate_per_min = if is_active && elapsed_min > 0 {
                agg.totals.total as f64 / elapsed_min as f64
            } else {
                0.0
            };
            let projected_total = if is_active && elapsed_min > 0 {
                ((agg.totals.total as f64 / elapsed_min as f64) * 300.0) as u64
            } else {
                agg.totals.total
            };

            let mut models: Vec<String> = agg.models.into_iter().collect();
            models.sort();

            BlockRow {
                start: agg.first_ts,
                end: epoch_to_iso(end_epoch),
                is_active,
                minutes_elapsed: elapsed_min,
                minutes_remaining: remaining_min,
                models,
                totals: agg.totals,
                burn_rate_per_min: (burn_rate_per_min * 10.0).round() / 10.0,
                projected_total,
            }
        })
        .collect()
}

// ─── Date helpers ────────────────────────────────────────────────────────────
// We intentionally avoid chrono to keep the WASM binary small. Parsing is
// limited to the format claude-code writes: "YYYY-MM-DDTHH:MM:SS[.fff]Z".

fn date_part(ts: &str) -> String {
    ts.get(..10).unwrap_or("unknown").to_string()
}

fn month_part(ts: &str) -> String {
    ts.get(..7).unwrap_or("unknown").to_string()
}

fn week_start(ts: &str) -> String {
    // Compute Monday of the week (UTC). Requires parsing the date into a day-count.
    let Some(date) = ts.get(..10) else { return "unknown".to_string(); };
    let Some((y, m, d)) = parse_ymd(date) else { return date.to_string(); };

    let epoch_days = ymd_to_epoch_days(y, m, d);
    // 1970-01-01 was a Thursday. Thursday = day 3 (Mon=0..Sun=6).
    let weekday = ((epoch_days + 3) % 7 + 7) % 7; // Mon=0 .. Sun=6
    let monday_days = epoch_days - weekday;
    let (wy, wm, wd) = epoch_days_to_ymd(monday_days);
    format!("{wy:04}-{wm:02}-{wd:02}")
}

fn parse_ymd(s: &str) -> Option<(i32, u32, u32)> {
    let b = s.as_bytes();
    if b.len() < 10 { return None; }
    let y: i32 = s[0..4].parse().ok()?;
    let m: u32 = s[5..7].parse().ok()?;
    let d: u32 = s[8..10].parse().ok()?;
    Some((y, m, d))
}

// Days since 1970-01-01 (proleptic Gregorian). Algorithm from Howard Hinnant.
fn ymd_to_epoch_days(y: i32, m: u32, d: u32) -> i64 {
    let y = y - (m <= 2) as i32;
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as i64; // [0, 399]
    let doy = (153 * (m as i64 + (if m > 2 { -3 } else { 9 })) + 2) / 5 + d as i64 - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era as i64 * 146097 + doe - 719468
}

fn epoch_days_to_ymd(days: i64) -> (i32, u32, u32) {
    let days = days + 719468;
    let era = if days >= 0 { days } else { days - 146096 } / 146097;
    let doe = (days - era * 146097) as i64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = y + (m <= 2) as i64;
    (y as i32, m as u32, d as u32)
}

fn parse_epoch(ts: &str) -> Option<i64> {
    // Expects "YYYY-MM-DDTHH:MM:SS[.fff]Z" — we ignore sub-seconds.
    let (y, m, d) = parse_ymd(ts.get(..10)?)?;
    let tail = ts.get(11..)?;
    let b = tail.as_bytes();
    if b.len() < 8 { return None; }
    let h: i64 = tail[0..2].parse().ok()?;
    let min: i64 = tail[3..5].parse().ok()?;
    let s: i64 = tail[6..8].parse().ok()?;
    let days = ymd_to_epoch_days(y, m, d);
    Some(days * 86400 + h * 3600 + min * 60 + s)
}

fn epoch_to_iso(epoch: i64) -> String {
    let days = epoch.div_euclid(86400);
    let rem = epoch.rem_euclid(86400);
    let (y, m, d) = epoch_days_to_ymd(days);
    let h = rem / 3600;
    let min = (rem % 3600) / 60;
    let s = rem % 60;
    format!("{y:04}-{m:02}-{d:02}T{h:02}:{min:02}:{s:02}Z")
}

fn duration_minutes(start: &str, end: &str) -> u32 {
    match (parse_epoch(start), parse_epoch(end)) {
        (Some(a), Some(b)) if b >= a => ((b - a) / 60) as u32,
        _ => 0,
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// Forecasting — Holt-Winters (additive) + anomaly detection
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
struct ForecastInput {
    daily: Vec<f64>,
    horizon: usize,
    season_length: usize,
}

#[derive(Serialize, Deserialize)]
pub struct ForecastPoint {
    pub value: f64,
    pub lower: f64,
    pub upper: f64,
}

#[derive(Serialize, Deserialize)]
pub struct AnomalyMarker {
    pub index: usize,
    pub value: f64,
    pub expected: f64,
    pub z_score: f64,
    pub kind: String, // "spike" | "drop"
}

#[derive(Serialize, Deserialize)]
pub struct ForecastOutput {
    pub forecast: Vec<ForecastPoint>,
    pub fitted: Vec<f64>,
    pub alpha: f64,
    pub beta: f64,
    pub gamma: f64,
    pub rmse: f64,
    pub anomalies: Vec<AnomalyMarker>,
}

/// Additive Holt-Winters triple exponential smoothing with weekly seasonality.
/// Returns (fitted_values, forecast_values).
fn holt_winters_additive(
    series: &[f64],
    alpha: f64,
    beta: f64,
    gamma: f64,
    m: usize,
    horizon: usize,
) -> (Vec<f64>, Vec<f64>) {
    let n = series.len();

    // Not enough data for a full 2-season init — degrade gracefully
    if n < 2 * m {
        let fitted = series.to_vec();
        let last = series.last().copied().unwrap_or(0.0);
        return (fitted, vec![last; horizon]);
    }

    // Initial level = mean of first season
    let mut level = series[..m].iter().sum::<f64>() / m as f64;

    // Initial trend = slope between first-season avg and second-season avg
    let second_avg = series[m..2 * m].iter().sum::<f64>() / m as f64;
    let mut trend = (second_avg - level) / m as f64;

    // Initial seasonality = actual minus level for each position in first season
    let mut seasonal = vec![0.0; m];
    for i in 0..m {
        seasonal[i] = series[i] - level;
    }

    let mut fitted = Vec::with_capacity(n);

    for (t, &x) in series.iter().enumerate() {
        let s_idx = t % m;
        let prev_level = level;
        let prev_trend = trend;

        // One-step-ahead fit uses previous values
        fitted.push(prev_level + prev_trend + seasonal[s_idx]);

        // Updates
        level = alpha * (x - seasonal[s_idx]) + (1.0 - alpha) * (prev_level + prev_trend);
        trend = beta * (level - prev_level) + (1.0 - beta) * prev_trend;
        seasonal[s_idx] = gamma * (x - level) + (1.0 - gamma) * seasonal[s_idx];
    }

    // Multi-step forecast
    let mut forecast = Vec::with_capacity(horizon);
    for h in 1..=horizon {
        let s_idx = (n + h - 1) % m;
        forecast.push(level + h as f64 * trend + seasonal[s_idx]);
    }

    (fitted, forecast)
}

fn rmse(actual: &[f64], fitted: &[f64]) -> f64 {
    if actual.is_empty() {
        return 0.0;
    }
    let n = actual.len() as f64;
    let sum: f64 = actual
        .iter()
        .zip(fitted)
        .map(|(a, f)| (a - f).powi(2))
        .sum();
    (sum / n).sqrt()
}

/// Grid search over α, β, γ to minimize in-sample RMSE.
fn grid_search_hw(
    series: &[f64],
    m: usize,
    horizon: usize,
) -> (f64, f64, f64, Vec<f64>, Vec<f64>, f64) {
    let grid = [0.1, 0.3, 0.5, 0.7, 0.9];
    let mut best = (0.5, 0.1, 0.3, f64::INFINITY);

    for &a in &grid {
        for &b in &grid {
            for &g in &grid {
                let (fitted, _) = holt_winters_additive(series, a, b, g, m, 0);
                // Skip the first 2 seasons (init noise)
                let skip = (2 * m).min(series.len());
                let err = rmse(&series[skip..], &fitted[skip..]);
                if err < best.3 {
                    best = (a, b, g, err);
                }
            }
        }
    }

    let (fitted, forecast) = holt_winters_additive(series, best.0, best.1, best.2, m, horizon);
    (best.0, best.1, best.2, fitted, forecast, best.3)
}

#[wasm_bindgen]
pub fn compute_forecast(input_json: &str) -> String {
    match compute_forecast_inner(input_json) {
        Ok(r) => serde_json::to_string(&r).unwrap_or_else(|e| format!("error:{e}")),
        Err(e) => format!("error:{e}"),
    }
}

fn compute_forecast_inner(input_json: &str) -> Result<ForecastOutput, String> {
    let input: ForecastInput = serde_json::from_str(input_json).map_err(|e| e.to_string())?;
    let m = input.season_length.max(1);
    let horizon = input.horizon.max(1);

    if input.daily.is_empty() {
        return Ok(ForecastOutput {
            forecast: vec![],
            fitted: vec![],
            alpha: 0.0,
            beta: 0.0,
            gamma: 0.0,
            rmse: 0.0,
            anomalies: vec![],
        });
    }

    let (alpha, beta, gamma, fitted, forecast, err) =
        grid_search_hw(&input.daily, m, horizon);

    // 80% confidence interval = ± 1.28σ. Band widens with horizon.
    let base_band = 1.28 * err;
    let forecast_points: Vec<ForecastPoint> = forecast
        .iter()
        .enumerate()
        .map(|(i, &v)| {
            let widened = base_band * (1.0 + i as f64 * 0.08).sqrt();
            ForecastPoint {
                value: v.max(0.0),
                lower: (v - widened).max(0.0),
                upper: (v + widened).max(0.0),
            }
        })
        .collect();

    // Anomaly detection: residuals vs fitted; skip first 2 seasons
    let mut anomalies = vec![];
    let skip = (2 * m).min(input.daily.len());
    if err > 1e-9 {
        for i in skip..input.daily.len() {
            let residual = input.daily[i] - fitted[i];
            let z = residual / err;
            if z.abs() > 2.5 {
                anomalies.push(AnomalyMarker {
                    index: i,
                    value: input.daily[i],
                    expected: (fitted[i] * 100.0).round() / 100.0,
                    z_score: (z * 100.0).round() / 100.0,
                    kind: if z > 0.0 { "spike" } else { "drop" }.to_string(),
                });
            }
        }
    }

    Ok(ForecastOutput {
        forecast: forecast_points,
        fitted,
        alpha,
        beta,
        gamma,
        rmse: (err * 100.0).round() / 100.0,
        anomalies,
    })
}

// ═══════════════════════════════════════════════════════════════════════════
// Insights — rule-based observations over usage events
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
struct InsightsInput {
    events: Vec<UsageEvent>,
    pricing: HashMap<String, ModelPricing>,
}

#[derive(Serialize, Deserialize)]
pub struct Insight {
    pub title: String,
    pub description: String,
    pub severity: String, // "info" | "warning" | "alert"
    pub category: String, // "cost" | "usage" | "efficiency" | "anomaly"
    pub icon: String,     // single emoji or glyph
}

#[wasm_bindgen]
pub fn compute_insights(input_json: &str) -> String {
    match compute_insights_inner(input_json) {
        Ok(r) => serde_json::to_string(&r).unwrap_or_else(|e| format!("error:{e}")),
        Err(e) => format!("error:{e}"),
    }
}

fn compute_insights_inner(input_json: &str) -> Result<Vec<Insight>, String> {
    let input: InsightsInput =
        serde_json::from_str(input_json).map_err(|e| e.to_string())?;
    let mut insights = vec![];
    if input.events.is_empty() {
        return Ok(insights);
    }

    let mut events = input.events;
    events.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));
    let mut unpriced: HashSet<String> = HashSet::new();

    // Aggregate by day + by session + by model
    let mut daily: BTreeMap<String, f64> = BTreeMap::new();
    let mut session_costs: HashMap<String, f64> = HashMap::new();
    let mut model_cost: HashMap<String, f64> = HashMap::new();
    let mut total_cost = 0.0_f64;
    let mut total_tokens = 0_u64;

    for ev in &events {
        let cost = cost_of(ev, &input.pricing, &mut unpriced);
        total_cost += cost;
        total_tokens += ev.input_tokens
            + ev.output_tokens
            + ev.cache_creation_input_tokens
            + ev.cache_read_input_tokens;

        let date = ev.timestamp.get(..10).unwrap_or("unknown").to_string();
        *daily.entry(date).or_default() += cost;
        *session_costs.entry(ev.session_id.clone()).or_default() += cost;
        *model_cost.entry(ev.model.clone()).or_default() += cost;
    }

    let daily_vec: Vec<(String, f64)> =
        daily.iter().map(|(k, v)| (k.clone(), *v)).collect();
    let n_days = daily_vec.len();

    // ── Rule 1: Week-over-week cost change ───────────────────────────────
    if n_days >= 14 {
        let last_7: f64 = daily_vec[n_days - 7..].iter().map(|(_, c)| c).sum();
        let prev_7: f64 = daily_vec[n_days - 14..n_days - 7]
            .iter()
            .map(|(_, c)| c)
            .sum();
        if prev_7 > 0.0 {
            let pct = (last_7 - prev_7) / prev_7 * 100.0;
            if pct.abs() >= 15.0 {
                let direction = if pct > 0.0 { "up" } else { "down" };
                insights.push(Insight {
                    title: format!("Cost trending {} {:.0}% week-over-week", direction, pct.abs()),
                    description: format!(
                        "Last 7 days: ${:.2} · previous 7: ${:.2}",
                        last_7, prev_7
                    ),
                    severity: if pct > 50.0 {
                        "warning"
                    } else {
                        "info"
                    }
                    .to_string(),
                    category: "cost".to_string(),
                    icon: if pct > 0.0 { "📈" } else { "📉" }.to_string(),
                });
            }
        }
    }

    // ── Rule 2: Top sessions dominate spend ─────────────────────────────
    let mut sorted_sessions: Vec<(String, f64)> =
        session_costs.into_iter().collect();
    sorted_sessions.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    if sorted_sessions.len() >= 3 && total_cost > 0.01 {
        let top_3_cost: f64 = sorted_sessions.iter().take(3).map(|(_, c)| c).sum();
        let pct = top_3_cost / total_cost * 100.0;
        if pct >= 30.0 {
            let top = &sorted_sessions[0];
            insights.push(Insight {
                title: format!("3 sessions = {:.0}% of all spend", pct),
                description: format!(
                    "Biggest: {} at ${:.2}",
                    top.0.chars().take(8).collect::<String>(),
                    top.1
                ),
                severity: if pct >= 60.0 { "warning" } else { "info" }.to_string(),
                category: "cost".to_string(),
                icon: "🎯".to_string(),
            });
        }
    }

    // ── Rule 3: Runaway single session ──────────────────────────────────
    if let Some((top_id, top_cost)) = sorted_sessions.first() {
        if *top_cost > 5.0 && total_cost > 0.0 && *top_cost / total_cost > 0.35 {
            insights.push(Insight {
                title: "Runaway session detected".to_string(),
                description: format!(
                    "Session {} consumed ${:.2} ({:.0}% of total)",
                    top_id.chars().take(8).collect::<String>(),
                    top_cost,
                    top_cost / total_cost * 100.0
                ),
                severity: "alert".to_string(),
                category: "anomaly".to_string(),
                icon: "⚠️".to_string(),
            });
        }
    }

    // ── Rule 4: Opus-heavy usage ─────────────────────────────────────────
    if total_cost > 1.0 {
        let opus_cost: f64 = model_cost
            .iter()
            .filter(|(k, _)| k.contains("opus"))
            .map(|(_, v)| v)
            .sum();
        let opus_pct = opus_cost / total_cost * 100.0;
        if opus_pct >= 50.0 {
            insights.push(Insight {
                title: format!("Opus is {:.0}% of your spend", opus_pct),
                description:
                    "Consider Sonnet or Haiku for tasks that don't need Opus's reasoning"
                        .to_string(),
                severity: "info".to_string(),
                category: "efficiency".to_string(),
                icon: "💡".to_string(),
            });
        }
    }

    // ── Rule 5: Cache hit rate ──────────────────────────────────────────
    let total_input: u64 = events.iter().map(|e| e.input_tokens).sum();
    let total_cache_read: u64 = events.iter().map(|e| e.cache_read_input_tokens).sum();
    let total_cache_create: u64 = events.iter().map(|e| e.cache_creation_input_tokens).sum();
    let total_cache = total_cache_read + total_cache_create;
    if total_cache > 0 {
        let hit_rate = total_cache_read as f64 / total_cache as f64 * 100.0;
        if hit_rate < 30.0 && total_cache_create > 10_000 {
            insights.push(Insight {
                title: format!("Low cache hit rate: {:.0}%", hit_rate),
                description: format!(
                    "You wrote {} cache tokens but only read back {}",
                    fmt_k(total_cache_create),
                    fmt_k(total_cache_read)
                ),
                severity: "info".to_string(),
                category: "efficiency".to_string(),
                icon: "💾".to_string(),
            });
        } else if hit_rate >= 70.0 {
            insights.push(Insight {
                title: format!("Excellent cache hit rate: {:.0}%", hit_rate),
                description: "You're getting great value from prompt caching".to_string(),
                severity: "info".to_string(),
                category: "efficiency".to_string(),
                icon: "✨".to_string(),
            });
        }
    }

    // ── Rule 6: Month projection vs last month ──────────────────────────
    if n_days >= 7 {
        let month_by: BTreeMap<String, f64> = daily_vec
            .iter()
            .fold(BTreeMap::new(), |mut acc, (d, c)| {
                let m = d.get(..7).unwrap_or("?").to_string();
                *acc.entry(m).or_default() += c;
                acc
            });
        let months: Vec<(&String, &f64)> = month_by.iter().collect();
        if months.len() >= 2 {
            let (this_m, this_c) = months[months.len() - 1];
            let (prev_m, prev_c) = months[months.len() - 2];
            let days_so_far = daily_vec
                .iter()
                .filter(|(d, _)| d.starts_with(this_m.as_str()))
                .count() as f64;
            if days_so_far > 0.0 && *prev_c > 0.01 {
                let daily_rate = *this_c / days_so_far;
                let projected = daily_rate * 30.0;
                let pct = (projected - *prev_c) / *prev_c * 100.0;
                if pct.abs() >= 10.0 {
                    insights.push(Insight {
                        title: format!(
                            "Projected {} total: ${:.0}",
                            this_m, projected
                        ),
                        description: format!(
                            "{:+.0}% vs {} (${:.2})",
                            pct, prev_m, prev_c
                        ),
                        severity: if pct > 50.0 {
                            "warning"
                        } else {
                            "info"
                        }
                        .to_string(),
                        category: "cost".to_string(),
                        icon: "🔮".to_string(),
                    });
                }
            }
        }
    }

    // ── Rule 7: Tokens summary (always-on info)──────────────────────────
    insights.push(Insight {
        title: format!("{} total tokens across {} events", fmt_k(total_tokens), events.len()),
        description: format!("${:.2} API-equivalent total spend", total_cost),
        severity: "info".to_string(),
        category: "usage".to_string(),
        icon: "📊".to_string(),
    });

    // Sort: alerts first, warnings next, info last
    insights.sort_by_key(|i| match i.severity.as_str() {
        "alert" => 0,
        "warning" => 1,
        _ => 2,
    });

    Ok(insights)
}

fn fmt_k(n: u64) -> String {
    if n >= 1_000_000 {
        format!("{:.1}M", n as f64 / 1_000_000.0)
    } else if n >= 1_000 {
        format!("{:.1}k", n as f64 / 1_000.0)
    } else {
        n.to_string()
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// What-If simulator — recompute cost under model substitutions
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
struct WhatIfInput {
    events: Vec<UsageEvent>,
    pricing: HashMap<String, ModelPricing>,
    swaps: Vec<ModelSwap>,
}

#[derive(Deserialize, Clone)]
struct ModelSwap {
    from_contains: String,
    to: String,
}

#[derive(Serialize, Deserialize)]
pub struct WhatIfResult {
    pub original_cost: f64,
    pub simulated_cost: f64,
    pub savings: f64,
    pub savings_pct: f64,
    pub affected_events: u32,
    pub by_original_model: Vec<WhatIfModelBreakdown>,
}

#[derive(Serialize, Deserialize)]
pub struct WhatIfModelBreakdown {
    pub model: String,
    pub original: f64,
    pub simulated: f64,
    pub events: u32,
}

#[wasm_bindgen]
pub fn compute_what_if(input_json: &str) -> String {
    match compute_what_if_inner(input_json) {
        Ok(r) => serde_json::to_string(&r).unwrap_or_else(|e| format!("error:{e}")),
        Err(e) => format!("error:{e}"),
    }
}

fn compute_what_if_inner(input_json: &str) -> Result<WhatIfResult, String> {
    let input: WhatIfInput =
        serde_json::from_str(input_json).map_err(|e| e.to_string())?;

    let mut unpriced: HashSet<String> = HashSet::new();
    let mut original_total = 0.0_f64;
    let mut simulated_total = 0.0_f64;
    let mut affected = 0_u32;

    #[derive(Default)]
    struct Agg {
        original: f64,
        simulated: f64,
        events: u32,
    }
    let mut by_model: HashMap<String, Agg> = HashMap::new();

    for ev in &input.events {
        let original = cost_of(ev, &input.pricing, &mut unpriced);
        original_total += original;

        // Find matching swap rule (first match wins)
        let swap = input
            .swaps
            .iter()
            .find(|s| ev.model.to_lowercase().contains(&s.from_contains.to_lowercase()));

        let simulated = if let Some(sw) = swap {
            affected += 1;
            let swapped = UsageEvent {
                model: sw.to.clone(),
                ..ev.clone()
            };
            cost_of(&swapped, &input.pricing, &mut unpriced)
        } else {
            original
        };
        simulated_total += simulated;

        let entry = by_model.entry(ev.model.clone()).or_default();
        entry.original += original;
        entry.simulated += simulated;
        entry.events += 1;
    }

    let savings = original_total - simulated_total;
    let savings_pct = if original_total > 0.0 {
        savings / original_total * 100.0
    } else {
        0.0
    };

    let mut breakdown: Vec<WhatIfModelBreakdown> = by_model
        .into_iter()
        .map(|(model, agg)| WhatIfModelBreakdown {
            model,
            original: agg.original,
            simulated: agg.simulated,
            events: agg.events,
        })
        .collect();
    breakdown.sort_by(|a, b| b.original.partial_cmp(&a.original).unwrap_or(std::cmp::Ordering::Equal));

    Ok(WhatIfResult {
        original_cost: original_total,
        simulated_cost: simulated_total,
        savings,
        savings_pct: (savings_pct * 100.0).round() / 100.0,
        affected_events: affected,
        by_original_model: breakdown,
    })
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(test)]
mod tests {
    use super::*;

    // ─── Trends tests ─────────────────────────────────────────────────────

    #[test]
    fn empty_input() {
        let result = compute_trends("[]");
        assert!(!result.starts_with("error:"));
        let m: TrendMetrics = serde_json::from_str(&result).unwrap();
        assert_eq!(m.current_streak, 0);
    }

    #[test]
    fn streak_calculation() {
        let json = r#"[
            {"date":"2026-01-01","message_count":10,"session_count":1,"tool_call_count":5},
            {"date":"2026-01-02","message_count":20,"session_count":2,"tool_call_count":8},
            {"date":"2026-01-03","message_count":0,"session_count":0,"tool_call_count":0},
            {"date":"2026-01-04","message_count":15,"session_count":1,"tool_call_count":4},
            {"date":"2026-01-05","message_count":5,"session_count":1,"tool_call_count":2}
        ]"#;
        let m: TrendMetrics = serde_json::from_str(&compute_trends(json)).unwrap();
        assert_eq!(m.current_streak, 2);
        assert_eq!(m.longest_streak, 2);
    }

    #[test]
    fn moving_average_window() {
        let values = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0];
        let avgs = moving_average(&values, 3);
        assert_eq!(avgs[0], None);
        assert_eq!(avgs[2], Some(2.0));
        assert_eq!(avgs[6], Some(6.0));
    }

    #[test]
    fn trend_up() {
        let counts: Vec<f64> = (0..14).map(|i| if i < 7 { 10.0 } else { 100.0 }).collect();
        let (dir, pct) = compute_7d_trend(&counts);
        assert_eq!(dir, "up");
        assert!(pct > 0.0);
    }

    #[test]
    fn weekly_totals() {
        let json = r#"[
            {"date":"2026-01-01","message_count":10,"session_count":1,"tool_call_count":5},
            {"date":"2026-01-02","message_count":20,"session_count":2,"tool_call_count":8}
        ]"#;
        let m: TrendMetrics = serde_json::from_str(&compute_trends(json)).unwrap();
        assert_eq!(m.weekly_totals.len(), 1);
        assert_eq!(m.weekly_totals[0].messages, 30);
    }

    // ─── Reports tests ─────────────────────────────────────────────────────

    fn sample_input(now_epoch: i64) -> String {
        format!(r#"{{
            "events": [
                {{"timestamp":"2026-04-10T10:00:00Z","session_id":"s1","project_id":"p","model":"claude-sonnet-4-6","input_tokens":100,"output_tokens":500,"cache_creation_input_tokens":1000,"cache_read_input_tokens":2000}},
                {{"timestamp":"2026-04-10T11:30:00Z","session_id":"s1","project_id":"p","model":"claude-sonnet-4-6","input_tokens":200,"output_tokens":800,"cache_creation_input_tokens":500,"cache_read_input_tokens":3000}},
                {{"timestamp":"2026-04-12T09:15:00Z","session_id":"s2","project_id":"p","model":"claude-opus-4-6","input_tokens":50,"output_tokens":300,"cache_creation_input_tokens":2000,"cache_read_input_tokens":0}}
            ],
            "pricing": {{
                "claude-sonnet-4-6": {{"input_cost_per_token":3e-6,"output_cost_per_token":1.5e-5,"cache_creation_input_token_cost":3.75e-6,"cache_read_input_token_cost":3e-7}},
                "claude-opus-4-6": {{"input_cost_per_token":1.5e-5,"output_cost_per_token":7.5e-5,"cache_creation_input_token_cost":1.875e-5,"cache_read_input_token_cost":1.5e-6}}
            }},
            "now_epoch_secs": {now_epoch}
        }}"#)
    }

    #[test]
    fn reports_empty() {
        let r: Reports = serde_json::from_str(&compute_reports(
            r#"{"events":[],"pricing":{},"now_epoch_secs":0}"#
        )).unwrap();
        assert_eq!(r.daily.len(), 0);
        assert_eq!(r.grand_total.total, 0);
    }

    #[test]
    fn reports_daily_grouping() {
        let r: Reports = serde_json::from_str(&compute_reports(&sample_input(2_000_000_000))).unwrap();
        // Events on 2026-04-10 and 2026-04-12 → 2 daily rows
        assert_eq!(r.daily.len(), 2);
        assert_eq!(r.daily[0].label, "2026-04-10");
        assert_eq!(r.daily[1].label, "2026-04-12");
        // First day has 3600 total tokens (100+500+1000+2000 + 200+800+500+3000)
        assert_eq!(r.daily[0].totals.total, 8100);
        assert_eq!(r.daily[0].totals.event_count, 2);
    }

    #[test]
    fn reports_session_grouping() {
        let r: Reports = serde_json::from_str(&compute_reports(&sample_input(2_000_000_000))).unwrap();
        assert_eq!(r.sessions.len(), 2);
        // Newest first
        assert!(r.sessions[0].start >= r.sessions[1].start);
        // s1 spans 1h30m
        let s1 = r.sessions.iter().find(|s| s.session_id == "s1").unwrap();
        assert_eq!(s1.duration_minutes, 90);
    }

    #[test]
    fn reports_cost_calculation() {
        let r: Reports = serde_json::from_str(&compute_reports(&sample_input(2_000_000_000))).unwrap();
        // Event 1: sonnet-4-6  input 100 * 3e-6 + output 500 * 1.5e-5 + cache_create 1000 * 3.75e-6 + cache_read 2000 * 3e-7
        //        = 0.0003 + 0.0075 + 0.00375 + 0.0006 = 0.01215
        // Event 2: sonnet-4-6  200 * 3e-6 + 800 * 1.5e-5 + 500 * 3.75e-6 + 3000 * 3e-7
        //        = 0.0006 + 0.012 + 0.001875 + 0.0009 = 0.015375
        // Event 3: opus-4-6   50 * 1.5e-5 + 300 * 7.5e-5 + 2000 * 1.875e-5 + 0
        //        = 0.00075 + 0.0225 + 0.0375 = 0.06075
        // Total: 0.01215 + 0.015375 + 0.06075 = 0.088275
        let grand = r.grand_total.cost_usd;
        assert!((grand - 0.088275).abs() < 1e-9, "got {grand}");
    }

    #[test]
    fn reports_unpriced_model() {
        let input = r#"{
            "events": [{"timestamp":"2026-04-10T10:00:00Z","session_id":"s","project_id":"p","model":"unknown-model","input_tokens":100,"output_tokens":200,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}],
            "pricing": {},
            "now_epoch_secs": 2000000000
        }"#;
        let r: Reports = serde_json::from_str(&compute_reports(input)).unwrap();
        assert_eq!(r.unpriced_models, vec!["unknown-model"]);
        assert_eq!(r.grand_total.cost_usd, 0.0);
    }

    #[test]
    fn reports_blocks_rolling_window() {
        // 3 events: two within 5h, one 6h later → 2 blocks
        let input = r#"{
            "events": [
                {"timestamp":"2026-04-10T10:00:00Z","session_id":"s","project_id":"p","model":"claude-sonnet-4-6","input_tokens":100,"output_tokens":200,"cache_creation_input_tokens":0,"cache_read_input_tokens":0},
                {"timestamp":"2026-04-10T12:00:00Z","session_id":"s","project_id":"p","model":"claude-sonnet-4-6","input_tokens":50,"output_tokens":100,"cache_creation_input_tokens":0,"cache_read_input_tokens":0},
                {"timestamp":"2026-04-10T16:30:00Z","session_id":"s","project_id":"p","model":"claude-sonnet-4-6","input_tokens":10,"output_tokens":20,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}
            ],
            "pricing": {"claude-sonnet-4-6": {"input_cost_per_token":3e-6,"output_cost_per_token":1.5e-5,"cache_creation_input_token_cost":3.75e-6,"cache_read_input_token_cost":3e-7}},
            "now_epoch_secs": 2000000000
        }"#;
        let r: Reports = serde_json::from_str(&compute_reports(input)).unwrap();
        // 10:00 starts block 1, 12:00 within (ends 15:00), 16:30 starts block 2
        assert_eq!(r.blocks.len(), 2);
        // Newest first
        assert!(r.blocks[0].start > r.blocks[1].start);
    }

    #[test]
    fn week_start_is_monday() {
        // 2026-04-12 is a Sunday → Monday is 2026-04-06
        assert_eq!(week_start("2026-04-12T10:00:00Z"), "2026-04-06");
        // 2026-04-06 is a Monday → itself
        assert_eq!(week_start("2026-04-06T10:00:00Z"), "2026-04-06");
        // 2026-04-08 is a Wednesday → 2026-04-06
        assert_eq!(week_start("2026-04-08T10:00:00Z"), "2026-04-06");
    }

    #[test]
    fn strip_date_suffix_variants() {
        assert_eq!(strip_date_suffix("claude-sonnet-4-5-20250929"), "claude-sonnet-4-5");
        assert_eq!(strip_date_suffix("claude-sonnet-4-6"), "claude-sonnet-4-6");
        assert_eq!(strip_date_suffix("claude-haiku-4-5"), "claude-haiku-4-5");
    }

    // ─── Forecast tests ───────────────────────────────────────────────────

    #[test]
    fn forecast_empty() {
        let r: ForecastOutput = serde_json::from_str(&compute_forecast(
            r#"{"daily":[],"horizon":7,"season_length":7}"#,
        ))
        .unwrap();
        assert_eq!(r.forecast.len(), 0);
        assert_eq!(r.fitted.len(), 0);
    }

    #[test]
    fn forecast_short_series_degrades_gracefully() {
        // Only 5 days, season is 7 — should return flat forecast of last value
        let input = r#"{"daily":[10.0, 12.0, 15.0, 11.0, 13.0],"horizon":7,"season_length":7}"#;
        let r: ForecastOutput = serde_json::from_str(&compute_forecast(input)).unwrap();
        assert_eq!(r.forecast.len(), 7);
        // Last value was 13.0 — forecast should be flat
        for p in &r.forecast {
            assert!((p.value - 13.0).abs() < 0.01, "got {}", p.value);
        }
    }

    #[test]
    fn forecast_captures_weekly_seasonality() {
        // 4 weeks of "weekdays have 10, weekends have 2" pattern
        let mut daily = vec![];
        for _ in 0..4 {
            daily.extend_from_slice(&[10.0, 10.0, 10.0, 10.0, 10.0, 2.0, 2.0]);
        }
        let input = format!(
            r#"{{"daily":{},"horizon":7,"season_length":7}}"#,
            serde_json::to_string(&daily).unwrap()
        );
        let r: ForecastOutput = serde_json::from_str(&compute_forecast(&input)).unwrap();
        assert_eq!(r.forecast.len(), 7);
        // The first 5 forecast points should be close to 10, last 2 close to 2
        for (i, p) in r.forecast.iter().enumerate() {
            let expected = if i < 5 { 10.0 } else { 2.0 };
            assert!(
                (p.value - expected).abs() < 1.5,
                "day {i}: got {}, expected ~{}",
                p.value,
                expected
            );
        }
    }

    #[test]
    fn forecast_detects_anomaly_spike() {
        // 3 weeks of flat ~10, then one spike at day 22
        let mut daily = vec![10.0; 21];
        daily.push(50.0); // big spike
        daily.push(10.0);
        daily.push(10.0);
        let input = format!(
            r#"{{"daily":{},"horizon":3,"season_length":7}}"#,
            serde_json::to_string(&daily).unwrap()
        );
        let r: ForecastOutput = serde_json::from_str(&compute_forecast(&input)).unwrap();
        // Should detect at least one spike
        assert!(
            r.anomalies.iter().any(|a| a.kind == "spike"),
            "expected a spike anomaly, got: {:?}",
            r.anomalies.len()
        );
    }

    // ─── Insights tests ───────────────────────────────────────────────────

    #[test]
    fn insights_empty() {
        let r: Vec<Insight> = serde_json::from_str(&compute_insights(
            r#"{"events":[],"pricing":{}}"#,
        ))
        .unwrap();
        assert_eq!(r.len(), 0);
    }

    #[test]
    fn insights_generates_total_summary() {
        let input = r#"{
            "events": [{"timestamp":"2026-04-10T10:00:00Z","session_id":"s1","project_id":"p","model":"claude-sonnet-4-6","input_tokens":100,"output_tokens":500,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}],
            "pricing": {"claude-sonnet-4-6":{"input_cost_per_token":3e-6,"output_cost_per_token":1.5e-5,"cache_creation_input_token_cost":0,"cache_read_input_token_cost":0}}
        }"#;
        let r: Vec<Insight> = serde_json::from_str(&compute_insights(input)).unwrap();
        // Should always include the total summary
        assert!(r.iter().any(|i| i.category == "usage"));
    }

    #[test]
    fn insights_detect_runaway_session() {
        // One session eating most of the cost
        let input = r#"{
            "events": [
                {"timestamp":"2026-04-10T10:00:00Z","session_id":"runaway","project_id":"p","model":"claude-opus-4-6","input_tokens":1000000,"output_tokens":500000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0},
                {"timestamp":"2026-04-10T11:00:00Z","session_id":"s2","project_id":"p","model":"claude-opus-4-6","input_tokens":100,"output_tokens":50,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}
            ],
            "pricing": {"claude-opus-4-6":{"input_cost_per_token":1.5e-5,"output_cost_per_token":7.5e-5,"cache_creation_input_token_cost":0,"cache_read_input_token_cost":0}}
        }"#;
        let r: Vec<Insight> = serde_json::from_str(&compute_insights(input)).unwrap();
        assert!(r.iter().any(|i| i.category == "anomaly"));
    }

    // ─── What-If tests ────────────────────────────────────────────────────

    #[test]
    fn what_if_swap_sonnet_to_haiku() {
        let input = r#"{
            "events": [
                {"timestamp":"2026-04-10T10:00:00Z","session_id":"s","project_id":"p","model":"claude-sonnet-4-6","input_tokens":1000,"output_tokens":2000,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}
            ],
            "pricing": {
                "claude-sonnet-4-6":{"input_cost_per_token":3e-6,"output_cost_per_token":1.5e-5,"cache_creation_input_token_cost":0,"cache_read_input_token_cost":0},
                "claude-haiku-4-5":{"input_cost_per_token":1e-6,"output_cost_per_token":5e-6,"cache_creation_input_token_cost":0,"cache_read_input_token_cost":0}
            },
            "swaps": [{"from_contains":"sonnet","to":"claude-haiku-4-5"}]
        }"#;
        let r: WhatIfResult = serde_json::from_str(&compute_what_if(input)).unwrap();
        // Original: 1000*3e-6 + 2000*1.5e-5 = 0.003 + 0.03 = 0.033
        // Simulated: 1000*1e-6 + 2000*5e-6 = 0.001 + 0.01 = 0.011
        // Savings: 0.022
        assert!((r.original_cost - 0.033).abs() < 1e-9);
        assert!((r.simulated_cost - 0.011).abs() < 1e-9);
        assert!((r.savings - 0.022).abs() < 1e-9);
        assert_eq!(r.affected_events, 1);
    }

    #[test]
    fn what_if_no_matching_swap() {
        let input = r#"{
            "events": [
                {"timestamp":"2026-04-10T10:00:00Z","session_id":"s","project_id":"p","model":"claude-opus-4-6","input_tokens":100,"output_tokens":200,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}
            ],
            "pricing": {"claude-opus-4-6":{"input_cost_per_token":1.5e-5,"output_cost_per_token":7.5e-5,"cache_creation_input_token_cost":0,"cache_read_input_token_cost":0}},
            "swaps": [{"from_contains":"sonnet","to":"claude-haiku-4-5"}]
        }"#;
        let r: WhatIfResult = serde_json::from_str(&compute_what_if(input)).unwrap();
        assert_eq!(r.affected_events, 0);
        assert_eq!(r.savings, 0.0);
        assert_eq!(r.original_cost, r.simulated_cost);
    }
}
