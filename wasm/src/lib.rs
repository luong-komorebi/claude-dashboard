use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

// ─── Input types ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct DailyActivity {
    date: String,
    message_count: u64,
    session_count: u64,
    tool_call_count: u64,
}

// ─── Output types ─────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
pub struct TrendMetrics {
    /// 7-day simple moving average of message count (None for first 6 days)
    pub moving_avg_7d: Vec<Option<f64>>,
    /// 30-day simple moving average of message count (None for first 29 days)
    pub moving_avg_30d: Vec<Option<f64>>,
    /// Current consecutive-day activity streak
    pub current_streak: u32,
    /// Longest consecutive-day activity streak ever
    pub longest_streak: u32,
    /// Date + count of the single busiest day
    pub best_day: Option<BestDay>,
    /// "up" | "down" | "stable" based on last 7 days vs previous 7 days
    pub trend_7d: String,
    /// Weekly rollups sorted ascending
    pub weekly_totals: Vec<WeekSummary>,
    /// Percentage change in messages: last 7 days vs previous 7 days
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

// ─── Exported function ────────────────────────────────────────────────────────

/// Takes a JSON array of DailyActivity and returns TrendMetrics as JSON.
/// Returns an error string (prefixed with "error:") on parse failure.
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

    let n = days.len();
    let counts: Vec<f64> = days.iter().map(|d| d.message_count as f64).collect();

    // Moving averages
    let moving_avg_7d = moving_average(&counts, 7);
    let moving_avg_30d = moving_average(&counts, 30);

    // Streaks (a day with message_count > 0 counts as active)
    let (current_streak, longest_streak) = compute_streaks(&days);

    // Best day
    let best_day = days
        .iter()
        .max_by_key(|d| d.message_count)
        .filter(|d| d.message_count > 0)
        .map(|d| BestDay { date: d.date.clone(), message_count: d.message_count });

    // 7-day trend: compare last 7 days vs previous 7 days
    let (trend_7d, pct_change_7d) = compute_7d_trend(&counts);

    // Weekly rollups
    let weekly_totals = compute_weekly(&days);

    // Suppress unused-variable warning for n
    let _ = n;

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
            if i + 1 < window {
                None
            } else {
                let sum: f64 = values[i + 1 - window..=i].iter().sum();
                Some((sum / window as f64 * 10.0).round() / 10.0)
            }
        })
        .collect()
}

fn compute_streaks(days: &[DailyActivity]) -> (u32, u32) {
    let mut current = 0u32;
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

    // current streak = trailing run of active days
    for day in days.iter().rev() {
        if day.message_count > 0 {
            current += 1;
        } else {
            break;
        }
    }

    (current, longest)
}

fn compute_7d_trend(counts: &[f64]) -> (String, f64) {
    let n = counts.len();
    if n < 2 {
        return ("stable".to_string(), 0.0);
    }
    let last7: f64 = counts[n.saturating_sub(7)..].iter().sum();
    let prev7: f64 = counts[n.saturating_sub(14)..n.saturating_sub(7)].iter().sum();

    if prev7 == 0.0 {
        return if last7 > 0.0 {
            ("up".to_string(), 100.0)
        } else {
            ("stable".to_string(), 0.0)
        };
    }

    let pct = ((last7 - prev7) / prev7 * 100.0 * 10.0).round() / 10.0;
    let direction = if pct > 5.0 {
        "up"
    } else if pct < -5.0 {
        "down"
    } else {
        "stable"
    };

    (direction.to_string(), pct)
}

fn compute_weekly(days: &[DailyActivity]) -> Vec<WeekSummary> {
    // Group by ISO week start (Monday). We derive week_start from the date string.
    // Dates are assumed to be "YYYY-MM-DD" sorted ascending.
    // Simple approach: bucket by floor(day_index / 7) within the series.
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

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_input() {
        let result = compute_trends("[]");
        assert!(!result.starts_with("error:"));
        let m: TrendMetrics = serde_json::from_str(&result).unwrap();
        assert_eq!(m.current_streak, 0);
        assert_eq!(m.weekly_totals.len(), 0);
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
        assert_eq!(avgs[1], None);
        assert_eq!(avgs[2], Some(2.0));
        assert_eq!(avgs[6], Some(6.0));
    }

    #[test]
    fn trend_up() {
        // Last 7 much higher than prev 7
        let counts: Vec<f64> = (0..14).map(|i| if i < 7 { 10.0 } else { 100.0 }).collect();
        let (dir, pct) = compute_7d_trend(&counts);
        assert_eq!(dir, "up");
        assert!(pct > 0.0);
    }

    #[test]
    fn weekly_totals() {
        let json = r#"[
            {"date":"2026-01-01","message_count":10,"session_count":1,"tool_call_count":5},
            {"date":"2026-01-02","message_count":20,"session_count":2,"tool_call_count":8},
            {"date":"2026-01-08","message_count":30,"session_count":3,"tool_call_count":10}
        ]"#;
        let m: TrendMetrics = serde_json::from_str(&compute_trends(json)).unwrap();
        // 3 days → chunks of 7 → 1 week (all 3 in first chunk since < 7 items)
        assert_eq!(m.weekly_totals.len(), 1);
        assert_eq!(m.weekly_totals[0].messages, 60);
    }
}
