use futures_util::StreamExt;
use reqwest::{redirect::Policy, Client, Response};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::{ipc::Channel, Manager, State};
use tokio_util::sync::CancellationToken;
use url::Url;

const MAX_PROMPT_CHARACTERS: usize = 200_000;
const MAX_RESPONSE_BYTES: usize = 4 * 1024 * 1024;
const WEB_READER_URL: &str = "https://serkanozel.me/api/codexray/read-url";

#[derive(Clone)]
struct RuntimeState {
    client: Client,
    requests: Arc<Mutex<HashMap<u64, CancellationToken>>>,
}

impl RuntimeState {
    fn new() -> Self {
        let client = Client::builder()
            .redirect(Policy::none())
            .connect_timeout(Duration::from_secs(5))
            .build()
            .expect("failed to create HTTP client");
        Self {
            client,
            requests: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn cancel_all(&self) {
        let requests = self
            .requests
            .lock()
            .expect("local AI request lock poisoned");
        for token in requests.values() {
            token.cancel();
        }
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CompletionRequest {
    request_id: u64,
    base_url: String,
    model: String,
    bearer_token: Option<String>,
    messages: Vec<ChatMessage>,
    temperature: f64,
    max_tokens: u32,
    json_mode: bool,
    context_window: u32,
    locale: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompletionResult {
    text: String,
    reasoning: String,
    model: String,
    finish_reason: String,
    prompt_tokens: Option<u64>,
    completion_tokens: Option<u64>,
    reasoning_tokens: Option<u64>,
    queue_ms: u64,
    first_token_ms: Option<u64>,
    inference_ms: u64,
    schema_mode: &'static str,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct AiEvent {
    request_id: u64,
    #[serde(rename = "type")]
    kind: &'static str,
    text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    queue_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    first_token_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    inference_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    completion_tokens: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProbeRequest {
    base_url: String,
    model: String,
    bearer_token: String,
    context_window: u32,
    max_output_tokens: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Capabilities {
    chat: bool,
    streaming: bool,
    structured_output: &'static str,
    advanced_workflows: bool,
    reasoning_overhead: u32,
    usable_output_tokens: u32,
    checked_at: u64,
    probe_version: u8,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbeResult {
    normalized_base_url: String,
    capabilities: Capabilities,
}

#[derive(Debug, Serialize)]
struct ReaderResult {
    status: u16,
    body: String,
}

fn normalize_base_url(value: &str) -> Result<String, String> {
    let mut parsed = Url::parse(value.trim())
        .map_err(|_| "Local AI endpoint is not a valid URL.".to_string())?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("Local AI endpoint must use HTTP or HTTPS.".to_string());
    }
    if !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err(
            "Local AI endpoint cannot contain credentials, a query, or a fragment.".to_string(),
        );
    }
    match parsed.host_str() {
        Some("localhost") => parsed
            .set_host(Some("127.0.0.1"))
            .map_err(|_| "Invalid loopback host.".to_string())?,
        Some("127.0.0.1") | Some("::1") | Some("[::1]") => {}
        _ => return Err("Local AI endpoint must use localhost, 127.0.0.1, or [::1].".to_string()),
    }
    if parsed.port_or_known_default().is_none() {
        return Err("Local AI endpoint has an invalid port.".to_string());
    }
    let trimmed = parsed.path().trim_end_matches('/').to_string();
    parsed.set_path(if trimmed.is_empty() { "/v1" } else { &trimmed });
    Ok(parsed.as_str().trim_end_matches('/').to_string())
}

fn endpoint(base_url: &str, resource: &str) -> Result<String, String> {
    Ok(format!("{}/{}", normalize_base_url(base_url)?, resource))
}

fn validate_messages(messages: &[ChatMessage]) -> Result<(), String> {
    if messages.is_empty() || messages.len() > 64 {
        return Err("A completion must contain between 1 and 64 messages.".to_string());
    }
    let mut total = 0usize;
    for message in messages {
        if !matches!(message.role.as_str(), "system" | "user" | "assistant") {
            return Err("Completion message role is not allowed.".to_string());
        }
        total = total.saturating_add(message.content.len());
        if message.content.len() > 100_000 || total > MAX_PROMPT_CHARACTERS {
            return Err("Completion prompt exceeded the local safety limit.".to_string());
        }
    }
    Ok(())
}

fn request_builder(
    client: &Client,
    url: String,
    token: Option<&str>,
    body: Value,
) -> reqwest::RequestBuilder {
    let request = client.post(url).json(&body);
    match token.filter(|value| !value.is_empty()) {
        Some(value) => request.bearer_auth(value),
        None => request,
    }
}

async fn error_for_response(response: Response) -> Result<Response, String> {
    let status = response.status();
    if status.is_success() {
        return Ok(response);
    }
    Err(http_error_message(status.as_u16()))
}

fn http_error_message(status: u16) -> String {
    if status == 401 {
        return "Local AI endpoint returned HTTP 401. Enter its API key in the session Bearer token field."
            .to_string();
    }
    format!("Local AI endpoint returned HTTP {status}.")
}

fn completion_body(request: &CompletionRequest, stream: bool) -> Value {
    let mut body = json!({
        "model": request.model,
        "messages": request.messages,
        "temperature": request.temperature.clamp(0.0, 2.0),
        "max_tokens": request.max_tokens.clamp(1, 32_768),
        "stream": stream
    });
    if request.json_mode {
        body["response_format"] = json!({ "type": "json_object" });
    }
    body
}

fn parse_usage(value: &Value) -> (Option<u64>, Option<u64>, Option<u64>) {
    let usage = value.get("usage");
    (
        usage
            .and_then(|item| item.get("prompt_tokens"))
            .and_then(Value::as_u64),
        usage
            .and_then(|item| item.get("completion_tokens"))
            .and_then(Value::as_u64),
        usage
            .and_then(|item| item.pointer("/completion_tokens_details/reasoning_tokens"))
            .and_then(Value::as_u64),
    )
}

fn absolute_timeout_seconds(max_tokens: u32) -> u64 {
    // Active token production is already bounded by max_tokens, response size,
    // cancellation, and the 90-second inactivity timeout. Give slow local
    // reasoning models enough wall time to finish instead of cutting a healthy
    // stream near the end of a medium output budget.
    (900 + u64::from(max_tokens) / 8).clamp(1_800, 3_600)
}

fn is_retryable_reasoning_only(answer: &str, reasoning: &str, finish_reason: &str) -> bool {
    answer.is_empty() && !reasoning.is_empty() && finish_reason == "length"
}

async fn collect_non_streaming(
    state: &RuntimeState,
    request: &CompletionRequest,
) -> Result<CompletionResult, String> {
    validate_messages(&request.messages)?;
    let started = Instant::now();
    let response = request_builder(
        &state.client,
        endpoint(&request.base_url, "chat/completions")?,
        request.bearer_token.as_deref(),
        completion_body(request, false),
    )
    .timeout(Duration::from_secs(absolute_timeout_seconds(
        request.max_tokens,
    )))
    .send()
    .await
    .map_err(|error| format!("Local AI request failed: {error}"))?;
    let response = error_for_response(response).await?;
    let bytes = response
        .bytes()
        .await
        .map_err(|_| "Local AI response could not be read.".to_string())?;
    if bytes.len() > MAX_RESPONSE_BYTES {
        return Err("Local AI response exceeded the safety limit.".to_string());
    }
    let value: Value = serde_json::from_slice(&bytes)
        .map_err(|_| "Local AI returned invalid JSON.".to_string())?;
    let text = value
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let reasoning = value
        .pointer("/choices/0/message/reasoning_content")
        .or_else(|| value.pointer("/choices/0/message/reasoning"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let finish_reason = value
        .pointer("/choices/0/finish_reason")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_string();
    let (prompt_tokens, completion_tokens, reasoning_tokens) = parse_usage(&value);
    Ok(CompletionResult {
        text,
        reasoning,
        model: request.model.clone(),
        finish_reason,
        prompt_tokens,
        completion_tokens,
        reasoning_tokens,
        queue_ms: 0,
        first_token_ms: None,
        inference_ms: started.elapsed().as_millis() as u64,
        schema_mode: if request.json_mode {
            "json-object"
        } else {
            "none"
        },
    })
}

fn send_event(channel: Option<&Channel<AiEvent>>, event: AiEvent) {
    if let Some(channel) = channel {
        let _ = channel.send(event);
    }
}

async fn collect_streaming(
    state: &RuntimeState,
    request: &CompletionRequest,
    cancellation: CancellationToken,
    channel: Option<&Channel<AiEvent>>,
) -> Result<CompletionResult, String> {
    validate_messages(&request.messages)?;
    let started = Instant::now();
    send_event(
        channel,
        AiEvent {
            request_id: request.request_id,
            kind: "running",
            text: "Waiting for the first token from the local endpoint.".to_string(),
            queue_ms: Some(0),
            first_token_ms: None,
            inference_ms: None,
            completion_tokens: None,
            finish_reason: None,
        },
    );
    let response = request_builder(
        &state.client,
        endpoint(&request.base_url, "chat/completions")?,
        request.bearer_token.as_deref(),
        completion_body(request, true),
    )
    .send()
    .await
    .map_err(|error| format!("Local AI request failed: {error}"))?;
    let response = error_for_response(response).await?;
    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut answer = String::new();
    let mut reasoning = String::new();
    let mut finish_reason = "unknown".to_string();
    let mut prompt_tokens = None;
    let mut completion_tokens = None;
    let mut reasoning_tokens = None;
    let mut first_token_ms = None;
    let mut last_heartbeat = Instant::now();
    let mut total_bytes = 0usize;
    let mut saw_done = false;

    loop {
        if started.elapsed() > Duration::from_secs(absolute_timeout_seconds(request.max_tokens)) {
            return Err("Local AI request exceeded the absolute timeout.".to_string());
        }
        let next = tokio::select! {
            _ = cancellation.cancelled() => return Err("Local AI request was cancelled.".to_string()),
            value = tokio::time::timeout(Duration::from_secs(90), stream.next()) =>
                value.map_err(|_| "Local AI stream became inactive.".to_string())?,
        };
        let Some(chunk) = next else { break };
        let chunk = chunk.map_err(|error| format!("Local AI stream failed: {error}"))?;
        total_bytes = total_bytes.saturating_add(chunk.len());
        if total_bytes > MAX_RESPONSE_BYTES {
            return Err("Local AI response exceeded the safety limit.".to_string());
        }
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        buffer = buffer.replace("\r\n", "\n");
        while let Some(boundary) = buffer.find("\n\n") {
            let event_block = buffer[..boundary].to_string();
            buffer.drain(..boundary + 2);
            for line in event_block.lines() {
                let Some(data) = line.strip_prefix("data:") else {
                    continue;
                };
                let payload = data.trim();
                if payload.is_empty() {
                    continue;
                }
                if payload == "[DONE]" {
                    saw_done = true;
                    continue;
                }
                let value: Value = serde_json::from_str(payload)
                    .map_err(|_| "Local AI returned an invalid SSE event.".to_string())?;
                let content = value
                    .pointer("/choices/0/delta/content")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                let reasoning_content = value
                    .pointer("/choices/0/delta/reasoning_content")
                    .or_else(|| value.pointer("/choices/0/delta/reasoning"))
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if !content.is_empty() || !reasoning_content.is_empty() {
                    if !content.is_empty() {
                        answer.push_str(content);
                        send_event(
                            channel,
                            AiEvent {
                                request_id: request.request_id,
                                kind: "answer-delta",
                                text: content.to_string(),
                                queue_ms: None,
                                first_token_ms,
                                inference_ms: None,
                                completion_tokens: None,
                                finish_reason: None,
                            },
                        );
                    }
                    if !reasoning_content.is_empty() {
                        reasoning.push_str(reasoning_content);
                        send_event(
                            channel,
                            AiEvent {
                                request_id: request.request_id,
                                kind: "reasoning-delta",
                                text: reasoning_content.to_string(),
                                queue_ms: None,
                                first_token_ms,
                                inference_ms: None,
                                completion_tokens: None,
                                finish_reason: None,
                            },
                        );
                    }
                    let elapsed = started.elapsed().as_millis() as u64;
                    if first_token_ms.is_none() {
                        first_token_ms = Some(elapsed);
                        send_event(
                            channel,
                            AiEvent {
                                request_id: request.request_id,
                                kind: "first-token",
                                text: "The local endpoint produced its first token.".to_string(),
                                queue_ms: None,
                                first_token_ms,
                                inference_ms: None,
                                completion_tokens: None,
                                finish_reason: None,
                            },
                        );
                    } else if last_heartbeat.elapsed() >= Duration::from_millis(250) {
                        last_heartbeat = Instant::now();
                        send_event(
                            channel,
                            AiEvent {
                                request_id: request.request_id,
                                kind: "streaming",
                                text: "The local endpoint is still producing output.".to_string(),
                                queue_ms: None,
                                first_token_ms,
                                inference_ms: None,
                                completion_tokens: None,
                                finish_reason: None,
                            },
                        );
                    }
                }
                if let Some(reason) = value
                    .pointer("/choices/0/finish_reason")
                    .and_then(Value::as_str)
                {
                    finish_reason = reason.to_string();
                }
                let usage = parse_usage(&value);
                if usage.0.is_some() {
                    prompt_tokens = usage.0;
                }
                if usage.1.is_some() {
                    completion_tokens = usage.1;
                }
                if usage.2.is_some() {
                    reasoning_tokens = usage.2;
                }
            }
        }
    }
    if !buffer.trim().is_empty() || (!saw_done && finish_reason == "unknown") {
        return Err("Local AI stream closed unexpectedly.".to_string());
    }
    send_event(
        channel,
        AiEvent {
            request_id: request.request_id,
            kind: "validating",
            text: "Validating the completed local-model response.".to_string(),
            queue_ms: None,
            first_token_ms,
            inference_ms: None,
            completion_tokens,
            finish_reason: Some(finish_reason.clone()),
        },
    );
    // A reasoning model can spend the whole generation budget in its hidden
    // trace and finish with `length` before emitting the requested answer.
    // Return that bounded, typed result so the provider-neutral frontend can
    // retry with a larger budget. Other empty streams remain protocol errors.
    if answer.is_empty() && !is_retryable_reasoning_only(&answer, &reasoning, &finish_reason) {
        return Err("Local AI stream completed without visible content.".to_string());
    }
    Ok(CompletionResult {
        text: answer,
        reasoning,
        model: request.model.clone(),
        finish_reason,
        prompt_tokens,
        completion_tokens,
        reasoning_tokens,
        queue_ms: 0,
        first_token_ms,
        inference_ms: started.elapsed().as_millis() as u64,
        schema_mode: if request.json_mode {
            "json-object"
        } else {
            "none"
        },
    })
}

#[tauri::command]
async fn list_models(
    base_url: String,
    bearer_token: String,
    state: State<'_, RuntimeState>,
) -> Result<Vec<String>, String> {
    let request = state.client.get(endpoint(&base_url, "models")?);
    let request = if bearer_token.is_empty() {
        request
    } else {
        request.bearer_auth(&bearer_token)
    };
    let response = request
        .send()
        .await
        .map_err(|error| format!("Model discovery failed: {error}"))?;
    let response = error_for_response(response).await?;
    let bytes = response
        .bytes()
        .await
        .map_err(|_| "Model discovery response could not be read.".to_string())?;
    if bytes.len() > MAX_RESPONSE_BYTES {
        return Err("Model discovery response exceeded the safety limit.".to_string());
    }
    let value: Value = serde_json::from_slice(&bytes)
        .map_err(|_| "Model discovery returned invalid JSON.".to_string())?;
    let mut models = Vec::new();
    if let Some(items) = value.get("data").and_then(Value::as_array) {
        for item in items {
            if let Some(id) = item.get("id").and_then(Value::as_str) {
                models.push(id.to_string());
            }
        }
    }
    if models.is_empty() {
        if let Some(items) = value.get("models").and_then(Value::as_array) {
            for item in items {
                if let Some(id) = item.get("name").and_then(Value::as_str) {
                    models.push(id.to_string());
                }
            }
        }
    }
    models.sort();
    models.dedup();
    Ok(models)
}

#[tauri::command]
async fn probe_model(
    request: ProbeRequest,
    state: State<'_, RuntimeState>,
) -> Result<ProbeResult, String> {
    let normalized = normalize_base_url(&request.base_url)?;
    if request.model.trim().is_empty() {
        return Err("Select or enter a model ID first.".to_string());
    }
    let base = CompletionRequest {
        request_id: 0,
        base_url: normalized.clone(),
        model: request.model.clone(),
        bearer_token: (!request.bearer_token.is_empty()).then_some(request.bearer_token.clone()),
        messages: vec![ChatMessage {
            role: "user".to_string(),
            content: "Reply with exactly OK.".to_string(),
        }],
        temperature: 0.0,
        // Reasoning models can spend the first 100+ tokens in reasoning_content
        // before producing visible content. Keep the synthetic probe bounded,
        // but large enough to observe the actual assistant response.
        max_tokens: request.max_output_tokens.clamp(256, 512),
        json_mode: false,
        context_window: request.context_window,
        locale: "en".to_string(),
    };
    let stream = collect_streaming(&state, &base, CancellationToken::new(), None).await?;
    if stream.text.trim().is_empty() {
        return Err("Streaming compatibility check returned no text.".to_string());
    }

    let mut native_valid = 0_u8;
    let mut prompt_valid = 0_u8;
    let mut reasoning_samples = Vec::new();
    for json_mode in [true, false] {
        for _ in 0..3 {
            let trial = CompletionRequest {
                request_id: 0,
                base_url: normalized.clone(),
                model: request.model.clone(),
                bearer_token: (!request.bearer_token.is_empty())
                    .then_some(request.bearer_token.clone()),
                messages: vec![ChatMessage {
                    role: "user".to_string(),
                    content: "Return exactly this JSON object and nothing else: {\"ok\":true}"
                        .to_string(),
                }],
                temperature: 0.0,
                max_tokens: request.max_output_tokens.clamp(256, 512),
                json_mode,
                context_window: request.context_window,
                locale: "en".to_string(),
            };
            if let Ok(result) = collect_non_streaming(&state, &trial).await {
                if let Some(tokens) = result.reasoning_tokens {
                    reasoning_samples.push(tokens);
                }
                if probe_schema_matches(&result.text) {
                    if json_mode {
                        native_valid += 1;
                    } else {
                        prompt_valid += 1;
                    }
                }
            }
        }
        if native_valid == 3 {
            break;
        }
    }
    let structured_output = classify_structured_output(native_valid, prompt_valid);
    let structured_ok = structured_output != "none";
    let reasoning_overhead = if reasoning_samples.is_empty() {
        0
    } else {
        (reasoning_samples.iter().sum::<u64>() / reasoning_samples.len() as u64)
            .min(u32::MAX as u64) as u32
    };
    let checked_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    Ok(ProbeResult {
        normalized_base_url: normalized,
        capabilities: Capabilities {
            chat: true,
            streaming: true,
            structured_output,
            advanced_workflows: structured_ok,
            reasoning_overhead,
            usable_output_tokens: request.max_output_tokens.saturating_sub(reasoning_overhead),
            checked_at,
            probe_version: 2,
        },
    })
}

fn parse_json_object(text: &str) -> Result<Value, String> {
    let trimmed = text
        .trim()
        .strip_prefix("```json")
        .or_else(|| text.trim().strip_prefix("```"))
        .unwrap_or(text.trim())
        .trim()
        .strip_suffix("```")
        .unwrap_or(text.trim())
        .trim();
    let cleaned = extract_balanced_object(trimmed).unwrap_or(trimmed);
    let value: Value = serde_json::from_str(cleaned)
        .map_err(|_| "Probe did not return valid JSON.".to_string())?;
    if !value.is_object() {
        return Err("Probe did not return a JSON object.".to_string());
    }
    Ok(value)
}

fn extract_balanced_object(text: &str) -> Option<&str> {
    let mut start = None;
    let mut depth = 0_u32;
    let mut quoted = false;
    let mut escaped = false;
    for (index, character) in text.char_indices() {
        if quoted {
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if character == '"' {
                quoted = false;
            }
            continue;
        }
        if character == '"' {
            quoted = true;
        } else if character == '{' {
            if start.is_none() {
                start = Some(index);
            }
            depth += 1;
        } else if character == '}' && depth > 0 {
            depth -= 1;
            if depth == 0 {
                return start.map(|value| &text[value..=index]);
            }
        }
    }
    None
}

fn probe_schema_matches(text: &str) -> bool {
    matches!(
        parse_json_object(text),
        Ok(Value::Object(object))
            if object.len() == 1 && object.get("ok") == Some(&Value::Bool(true))
    )
}

fn classify_structured_output(native_valid: u8, prompt_valid: u8) -> &'static str {
    if native_valid == 3 {
        "native"
    } else if prompt_valid >= 1 {
        "prompt-only"
    } else {
        "none"
    }
}

#[tauri::command]
async fn run_completion(
    request: CompletionRequest,
    on_event: Channel<AiEvent>,
    state: State<'_, RuntimeState>,
) -> Result<CompletionResult, String> {
    let _ = (&request.context_window, &request.locale);
    let token = CancellationToken::new();
    state
        .requests
        .lock()
        .expect("local AI request lock poisoned")
        .insert(request.request_id, token.clone());
    send_event(
        Some(&on_event),
        AiEvent {
            request_id: request.request_id,
            kind: "queued",
            text: "Queued on the selected local endpoint.".to_string(),
            queue_ms: Some(0),
            first_token_ms: None,
            inference_ms: None,
            completion_tokens: None,
            finish_reason: None,
        },
    );
    let result = collect_streaming(&state, &request, token, Some(&on_event)).await;
    state
        .requests
        .lock()
        .expect("local AI request lock poisoned")
        .remove(&request.request_id);
    if let Ok(completion) = &result {
        send_event(
            Some(&on_event),
            AiEvent {
                request_id: request.request_id,
                kind: "completed",
                text: "Local inference completed.".to_string(),
                queue_ms: Some(completion.queue_ms),
                first_token_ms: completion.first_token_ms,
                inference_ms: Some(completion.inference_ms),
                completion_tokens: completion.completion_tokens,
                finish_reason: Some(completion.finish_reason.clone()),
            },
        );
    }
    result
}

#[tauri::command]
async fn cancel_completion(request_id: u64, state: State<'_, RuntimeState>) -> Result<(), String> {
    if let Some(token) = state
        .requests
        .lock()
        .expect("local AI request lock poisoned")
        .get(&request_id)
    {
        token.cancel();
    }
    Ok(())
}

#[tauri::command]
fn cancel_all_completions(state: State<'_, RuntimeState>) {
    state.cancel_all();
}

#[tauri::command]
async fn read_web_source(
    url: String,
    state: State<'_, RuntimeState>,
) -> Result<ReaderResult, String> {
    if url.len() > 4_096 {
        return Err("Web source URL is too long.".to_string());
    }
    let parsed = Url::parse(&url).map_err(|_| "Web source URL is invalid.".to_string())?;
    if parsed.scheme() != "https" {
        return Err("Web source URL must use HTTPS.".to_string());
    }
    let response = state
        .client
        .post(WEB_READER_URL)
        .json(&json!({ "version": 1, "url": url }))
        .timeout(Duration::from_secs(25))
        .send()
        .await
        .map_err(|error| format!("Web reader request failed: {error}"))?;
    let status = response.status().as_u16();
    let bytes = response
        .bytes()
        .await
        .map_err(|_| "Web reader response could not be read.".to_string())?;
    if bytes.len() > 1024 * 1024 {
        return Err("Web reader response exceeded the safety limit.".to_string());
    }
    Ok(ReaderResult {
        status,
        body: String::from_utf8_lossy(&bytes).into_owned(),
    })
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|_| "External link is invalid.".to_string())?;
    if parsed.scheme() != "https"
        || parsed.host_str().is_none()
        || !parsed.username().is_empty()
        || parsed.password().is_some()
    {
        return Err("Only credential-free HTTPS links can be opened externally.".to_string());
    }
    open::that_detached(parsed.as_str())
        .map_err(|_| "The system browser could not be opened.".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let (Some(icon), Some(window)) = (
                app.default_window_icon().cloned(),
                app.get_webview_window("main"),
            ) {
                window.set_icon(icon)?;
            }
            Ok(())
        })
        .plugin(
            tauri::plugin::Builder::<tauri::Wry>::new("navigation-guard")
                .on_navigation(|_webview, url| {
                    let host = url.host_str().unwrap_or_default();
                    (url.scheme() == "http" || url.scheme() == "https") && host == "tauri.localhost"
                        || (cfg!(debug_assertions)
                            && url.scheme() == "http"
                            && host == "127.0.0.1"
                            && url.port() == Some(5173))
                })
                .build(),
        )
        .manage(RuntimeState::new())
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                window.state::<RuntimeState>().cancel_all();
            }
        })
        .invoke_handler(tauri::generate_handler![
            list_models,
            probe_model,
            run_completion,
            cancel_completion,
            cancel_all_completions,
            read_web_source,
            open_external_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running CodeXRay");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loopback_urls_are_normalized() {
        assert_eq!(
            normalize_base_url("http://localhost:11434/v1/").unwrap(),
            "http://127.0.0.1:11434/v1"
        );
        assert_eq!(
            normalize_base_url("http://[::1]:8001/v1").unwrap(),
            "http://[::1]:8001/v1"
        );
    }

    #[test]
    fn non_loopback_and_credential_urls_are_rejected() {
        assert!(normalize_base_url("https://example.com/v1").is_err());
        assert!(normalize_base_url("http://token@127.0.0.1:8001/v1").is_err());
        assert!(normalize_base_url("http://127.0.0.1:8001/v1?x=1").is_err());
    }

    #[test]
    fn probe_json_parser_accepts_plain_or_fenced_objects() {
        assert!(parse_json_object("{\"ok\":true}").is_ok());
        assert!(parse_json_object("```json\n{\"ok\":true}\n```").is_ok());
        assert!(parse_json_object("answer: {\"ok\":true} trailing").is_ok());
        assert!(parse_json_object("[]").is_err());
        assert!(probe_schema_matches("{\"ok\":true}"));
        assert!(!probe_schema_matches("{\"ok\":false}"));
        assert!(!probe_schema_matches("{\"ok\":true,\"extra\":1}"));
    }

    #[test]
    fn structured_output_requires_three_native_trials() {
        assert_eq!(classify_structured_output(3, 0), "native");
        assert_eq!(classify_structured_output(2, 1), "prompt-only");
        assert_eq!(classify_structured_output(0, 0), "none");
    }

    #[test]
    fn authentication_errors_are_actionable_without_echoing_credentials() {
        let message = http_error_message(401);
        assert!(message.contains("session Bearer token"));
        assert!(!message.contains("Authorization"));
    }

    #[test]
    fn completion_timeout_scales_with_the_requested_output_budget() {
        assert_eq!(absolute_timeout_seconds(512), 1_800);
        assert_eq!(absolute_timeout_seconds(6_656), 1_800);
        assert!(absolute_timeout_seconds(16_384) > 1_200);
        assert_eq!(absolute_timeout_seconds(32_768), 3_600);
        assert_eq!(absolute_timeout_seconds(u32::MAX), 3_600);
    }

    #[test]
    fn reasoning_only_length_stop_is_returned_for_a_bounded_retry() {
        assert!(is_retryable_reasoning_only("", "hidden trace", "length"));
        assert!(!is_retryable_reasoning_only("", "", "length"));
        assert!(!is_retryable_reasoning_only("", "hidden trace", "stop"));
    }
}
