use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};
use anyhow::Result;

use claude_dashboard::data::{self, DashboardData};

type AppState = Arc<RwLock<DashboardData>>;

pub async fn serve(port: u16) -> Result<()> {
    let data = data::load_all().await.unwrap_or_else(|_| DashboardData {
        stats: Default::default(),
        usage: Default::default(),
        projects: vec![],
        plugins: vec![],
        todos: Default::default(),
        sessions: vec![],
        settings: Default::default(),
    });

    let state: AppState = Arc::new(RwLock::new(data));

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/api/stats", get(get_stats))
        .route("/api/usage", get(get_usage))
        .route("/api/projects", get(get_projects))
        .route("/api/plugins", get(get_plugins))
        .route("/api/todos", get(get_todos))
        .route("/api/sessions", get(get_sessions))
        .route("/api/settings", get(get_settings))
        .route("/api/all", get(get_all))
        .route("/api/refresh", post(refresh))
        .layer(cors)
        .with_state(state);

    let addr = format!("127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    eprintln!("API server listening on http://{}", addr);
    axum::serve(listener, app).await?;
    Ok(())
}

async fn get_stats(State(state): State<AppState>) -> Json<serde_json::Value> {
    let data = state.read().await;
    Json(serde_json::to_value(&data.stats).unwrap())
}

async fn get_usage(State(state): State<AppState>) -> Json<serde_json::Value> {
    let data = state.read().await;
    Json(serde_json::to_value(&data.usage).unwrap())
}

async fn get_projects(State(state): State<AppState>) -> Json<serde_json::Value> {
    let data = state.read().await;
    Json(serde_json::to_value(&data.projects).unwrap())
}

async fn get_plugins(State(state): State<AppState>) -> Json<serde_json::Value> {
    let data = state.read().await;
    Json(serde_json::to_value(&data.plugins).unwrap())
}

async fn get_todos(State(state): State<AppState>) -> Json<serde_json::Value> {
    let data = state.read().await;
    Json(serde_json::to_value(&data.todos).unwrap())
}

async fn get_sessions(State(state): State<AppState>) -> Json<serde_json::Value> {
    let data = state.read().await;
    Json(serde_json::to_value(&data.sessions).unwrap())
}

async fn get_settings(State(state): State<AppState>) -> Json<serde_json::Value> {
    let data = state.read().await;
    Json(serde_json::to_value(&data.settings).unwrap())
}

async fn get_all(State(state): State<AppState>) -> Json<serde_json::Value> {
    let data = state.read().await;
    Json(serde_json::to_value(&*data).unwrap())
}

async fn refresh(State(state): State<AppState>) -> Json<serde_json::Value> {
    match data::load_all().await {
        Ok(new_data) => {
            let mut w = state.write().await;
            *w = new_data;
            Json(serde_json::json!({ "ok": true }))
        }
        Err(e) => Json(serde_json::json!({ "ok": false, "error": e.to_string() })),
    }
}
