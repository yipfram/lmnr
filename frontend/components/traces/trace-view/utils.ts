import { SupabaseClient } from "@supabase/supabase-js";

import { Span, SpanType, Trace } from "@/lib/traces/types";

type CamelToSnake<T extends string> = T extends `${infer C0}${infer R}`
  ? `${C0 extends Lowercase<C0> ? "" : "_"}${Lowercase<C0>}${CamelToSnake<R>}`
  : "";

type CamelKeysToSnake<T> = {
  [K in keyof T as CamelToSnake<Extract<K, string>>]: T[K];
};

const dbSpanRowToSpan = (row: CamelKeysToSnake<Span>): Span => ({
  spanId: row.span_id,
  parentSpanId: row.parent_span_id,
  traceId: row.trace_id,
  spanType: row.span_type,
  name: row.name,
  path: row.attributes["lmnr.span.path"] ?? "",
  startTime: row.start_time,
  endTime: row.end_time,
  attributes: row.attributes,
  input: null,
  output: null,
  inputPreview: row.input_preview,
  outputPreview: row.output_preview,
  events: [],
  inputUrl: row.input_url,
  outputUrl: row.output_url,
  model: row.attributes["gen_ai.response.model"] ?? row.attributes["gen_ai.request.model"] ?? null,
});

export const enrichSpansWithPending = (existingSpans: Span[]): Span[] => {
  // Extract IDs for fast lookup
  const existingSpanIds = new Set(existingSpans.map((span) => span.spanId));

  // Extract existing pending spans
  const pendingSpans = existingSpans
    .filter((span) => span.pending)
    .reduce((acc, span) => acc.set(span.spanId, span), new Map<string, Span>());

  // Process spans to find missing parents
  existingSpans.forEach((span) => {
    if (!span.parentSpanId) return;

    const parentSpanIds = span.attributes["lmnr.span.ids_path"] as string[] | undefined;
    const parentSpanNames = span.attributes["lmnr.span.path"] as string[] | undefined;

    if (!parentSpanIds?.length || !parentSpanNames?.length || parentSpanIds.length !== parentSpanNames.length) {
      return;
    }

    const startTime = new Date(span.startTime);
    const endTime = new Date(span.endTime);

    parentSpanIds.forEach((spanId, i) => {
      // Skip if this span exists and is not pending
      if (existingSpanIds.has(spanId) && !pendingSpans.has(spanId)) {
        return;
      }

      if (pendingSpans.has(spanId)) {
        // Update existing pending span time range
        const pendingSpan = pendingSpans.get(spanId)!;
        const existingStartTime = new Date(pendingSpan.startTime);
        const existingEndTime = new Date(pendingSpan.endTime);

        pendingSpans.set(spanId, {
          ...pendingSpan,
          startTime: (startTime < existingStartTime ? startTime : existingStartTime).toISOString(),
          endTime: (endTime > existingEndTime ? endTime : existingEndTime).toISOString(),
        });
        return;
      }

      const pendingSpan: Span = {
        spanId,
        name: parentSpanNames[i],
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        attributes: {},
        events: [],
        traceId: span.traceId,
        input: null,
        output: null,
        inputPreview: null,
        outputPreview: null,
        spanType: SpanType.DEFAULT,
        path: "",
        inputUrl: null,
        outputUrl: null,
        pending: true,
      };

      pendingSpans.set(spanId, pendingSpan);
    });
  });

  return [...existingSpans.filter((span) => !span.pending), ...Array.from(pendingSpans.values())];
};

// ... existing code ...

export const updateTraceWithNewSpan = (currentTrace: Trace | null, newSpan: Span): Trace | null => {
  if (!currentTrace) {
    return null;
  }

  return {
    ...currentTrace,
    endTime: new Date(
      Math.max(new Date(currentTrace.endTime).getTime(), new Date(newSpan.endTime).getTime())
    ).toUTCString(),
    totalTokenCount:
      currentTrace.totalTokenCount +
      (newSpan.attributes["gen_ai.usage.input_tokens"] ?? 0) +
      (newSpan.attributes["gen_ai.usage.output_tokens"] ?? 0),
    inputTokenCount: currentTrace.inputTokenCount + (newSpan.attributes["gen_ai.usage.input_tokens"] ?? 0),
    outputTokenCount: currentTrace.outputTokenCount + (newSpan.attributes["gen_ai.usage.output_tokens"] ?? 0),
    inputCost: currentTrace.inputCost + (newSpan.attributes["gen_ai.usage.input_cost"] ?? 0),
    outputCost: currentTrace.outputCost + (newSpan.attributes["gen_ai.usage.output_cost"] ?? 0),
    cost:
      currentTrace.cost +
      (newSpan.attributes["gen_ai.usage.input_cost"] ?? 0) +
      (newSpan.attributes["gen_ai.usage.output_cost"] ?? 0),
    hasBrowserSession: currentTrace.hasBrowserSession || !!newSpan.attributes["lmnr.internal.has_browser_session"],
  };
};

export const updateSpansWithNewSpan = (currentSpans: Span[], newSpan: Span): Span[] => {
  const newSpans = [...currentSpans];
  const index = newSpans.findIndex((span) => span.spanId === newSpan.spanId);

  if (index !== -1 && newSpans[index].pending) {
    newSpans[index] = newSpan;
  } else {
    newSpans.push(newSpan);
  }

  return enrichSpansWithPending(newSpans);
};

export const setupTraceSubscription = (
  onSpanReceived: (span: Span) => void,
  onHasBrowserSession: () => void,
  supabase?: SupabaseClient,
  traceId?: string
) => {
  if (!supabase || !traceId) {
    return { unsubscribe: () => {} };
  }

  const channel = supabase
    .channel(`trace-updates-${traceId}`)
    .on<CamelKeysToSnake<Span>>(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "spans",
        filter: `trace_id=eq.${traceId}`,
      },
      (payload) => {
        if (payload.eventType === "INSERT") {
          const rtEventSpan = dbSpanRowToSpan(payload.new);

          if (rtEventSpan.attributes["lmnr.internal.has_browser_session"]) {
            onHasBrowserSession();
          }

          onSpanReceived(rtEventSpan);
        }
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
};

export const organizeSpansHierarchy = (
  spans: Span[]
): {
  childSpans: { [key: string]: Span[] };
  topLevelSpans: Span[];
} => {
  const childSpans = {} as { [key: string]: Span[] };
  const topLevelSpans = spans.filter((span: Span) => !span.parentSpanId);

  for (const span of spans) {
    if (span.parentSpanId) {
      if (!childSpans[span.parentSpanId]) {
        childSpans[span.parentSpanId] = [];
      }
      childSpans[span.parentSpanId].push(span);
    }
  }

  // Sort child spans for each parent by start time
  for (const parentId in childSpans) {
    childSpans[parentId].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  return { childSpans, topLevelSpans };
};
