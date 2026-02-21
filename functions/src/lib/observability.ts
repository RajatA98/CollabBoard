import {Langfuse} from "langfuse";

// ---------------------------------------------------------------------------
// Clients — initialized lazily from env vars
// ---------------------------------------------------------------------------

let langfuse: Langfuse | null = null;

function getLangfuse(): Langfuse | null {
  if (langfuse) return langfuse;
  const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  const baseUrl = (process.env.LANGFUSE_HOST ?? process.env.LANGFUSE_BASE_URL)?.trim();
  if (!secretKey || !publicKey) return null;
  langfuse = new Langfuse({secretKey, publicKey, ...(baseUrl ? {baseUrl} : {})});
  return langfuse;
}

// ---------------------------------------------------------------------------
// Span wrapper
// ---------------------------------------------------------------------------

interface Span {
  end(output: {result?: unknown}): void;
  error(err: unknown): void;
}

function noopSpan(): Span {
  return {
    end() { /* noop */ },
    error() { /* noop */ },
  };
}

// ---------------------------------------------------------------------------
// Trace wrapper
// ---------------------------------------------------------------------------

export interface Trace {
  logTokens(usage: {inputTokens: number; outputTokens: number}): void;
  startSpan(name: string, input: unknown): Span;
  end(output: {output?: unknown; usage?: unknown}): void;
  error(err: unknown): void;
}

function noopTrace(): Trace {
  return {
    logTokens() { /* noop */ },
    startSpan() {
      return noopSpan();
    },
    end() { /* noop */ },
    error() { /* noop */ },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function traceAgentCall(config: {
  name: string;
  input: unknown;
  metadata: Record<string, unknown>;
}): Promise<Trace> {
  try {
    const lf = getLangfuse();
    if (!lf) return noopTrace();

    const trace = lf.trace({
      name: config.name,
      input: config.input,
      metadata: config.metadata,
    });

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    return {
      logTokens({inputTokens, outputTokens}) {
        try {
          totalInputTokens += inputTokens;
          totalOutputTokens += outputTokens;
          trace.update({
            metadata: {
              ...config.metadata,
              totalInputTokens,
              totalOutputTokens,
            },
          });
        } catch { /* non-blocking */ }
      },

      startSpan(name: string, input: unknown): Span {
        try {
          const spanName = (name && String(name).trim()) || "span";
          const span = trace.span({name: spanName, input});
          return {
            end(output: {result?: unknown}) {
              try {
                span.end({output});
              } catch { /* non-blocking */ }
            },
            error(err: unknown) {
              try {
                span.end({
                  output: {error: err instanceof Error ? err.message : String(err)},
                  level: "ERROR",
                });
              } catch { /* non-blocking */ }
            },
          };
        } catch {
          return noopSpan();
        }
      },

      end(output: {output?: unknown; usage?: unknown}) {
        try {
          trace.update({
            output: output.output,
            metadata: {
              ...config.metadata,
              totalInputTokens,
              totalOutputTokens,
              ...(output.usage ? {usage: output.usage} : {}),
            },
          });
        } catch { /* non-blocking */ }
      },

      error(err: unknown) {
        try {
          trace.update({
            output: {error: err instanceof Error ? err.message : String(err)},
            metadata: {...config.metadata, status: "error"},
          });
        } catch { /* non-blocking */ }
      },
    };
  } catch {
    return noopTrace();
  }
}

/** Flush all queued Langfuse events. Use shutdownAsync so all spans (e.g. getBoardState) are sent. */
export async function flushAll(): Promise<void> {
  try {
    const lf = getLangfuse();
    if (lf) {
      await lf.shutdownAsync();
    }
  } catch {
    // Non-blocking — never crash the agent over observability
  }
}
