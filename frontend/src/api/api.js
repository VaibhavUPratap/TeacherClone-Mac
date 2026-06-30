import { supabase } from '../supabase';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export async function apiRequest(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  
  // Get current session token
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || `API request failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Helper for SSE streaming.
 * @param {string} path - API path (e.g. /chat/stream?question=...)
 * @param {function} onToken - Callback for each new token
 * @param {function} onDone - Callback when stream finishes
 * @param {function} onError - Callback on error
 */
export async function streamRequest(path, onToken, onDone, onError) {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`);
    if (!response.ok) throw new Error(`Stream failed: ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      // SSE format is "data: content\n\n"
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const content = line.replace("data: ", "");
          if (content) onToken(content);
        }
      }
    }
    if (onDone) onDone();
  } catch (err) {
    if (onError) onError(err);
    else console.error("Streaming error:", err);
  }
}

