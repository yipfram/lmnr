import { useSearchParams } from "next/navigation";
import { createContext, Dispatch, PropsWithChildren, SetStateAction, useContext, useMemo, useState } from "react";

import { organizeSpansHierarchy } from "@/components/traces/trace-view/utils";
import { Span, Trace } from "@/lib/traces/types";

type TraceViewContextType = {
  trace: Trace | null;
  setTrace: Dispatch<SetStateAction<Trace | null>>;
  spans: Span[];
  setSpans: Dispatch<SetStateAction<Span[]>>;
  selectedSpan: Span | null;
  setSelectedSpan: Dispatch<SetStateAction<Span | null>>;
  activeSpans: string[];
  collapsedSpans: Set<string>;
  setCollapsedSpans: Dispatch<SetStateAction<Set<string>>>;
  setActiveSpans: Dispatch<SetStateAction<string[]>>;
  showBrowserSession: boolean;
  setShowBrowserSession: Dispatch<SetStateAction<boolean>>;
  childSpans: { [key: string]: Span[] };
  topLevelSpans: Span[];
};

export const TraceViewContext = createContext<TraceViewContextType>({
  trace: null,
  setTrace: () => {},
  spans: [],
  selectedSpan: null,
  collapsedSpans: new Set(),
  setCollapsedSpans: () => {},
  setSelectedSpan: () => {},
  setSpans: () => {},
  activeSpans: [],
  setActiveSpans: () => {},
  showBrowserSession: false,
  setShowBrowserSession: () => {},
  childSpans: {},
  topLevelSpans: [],
});

export const useTraceViewContext = () => useContext(TraceViewContext);

export const TraceViewContextProvider = ({ children }: PropsWithChildren<{ propsTrace?: Trace }>) => {
  const searchParams = useSearchParams();
  const [trace, setTrace] = useState<Trace | null>(null);
  const [spans, setSpans] = useState<Span[]>([]);
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(
    searchParams.get("spanId") ? spans.find((span: Span) => span.spanId === searchParams.get("spanId")) || null : null
  );
  const [collapsedSpans, setCollapsedSpans] = useState<Set<string>>(new Set());
  const [activeSpans, setActiveSpans] = useState<string[]>([]);

  const [showBrowserSession, setShowBrowserSession] = useState(false);

  const { childSpans, topLevelSpans } = useMemo(() => organizeSpansHierarchy(spans), [spans]);

  const value = useMemo<TraceViewContextType>(
    () => ({
      trace,
      setTrace,
      spans,
      setSpans,
      activeSpans,
      setActiveSpans,
      collapsedSpans,
      setCollapsedSpans,
      showBrowserSession,
      selectedSpan,
      setSelectedSpan,
      setShowBrowserSession,
      childSpans,
      topLevelSpans,
    }),
    [activeSpans, childSpans, collapsedSpans, selectedSpan, showBrowserSession, spans, topLevelSpans, trace]
  );
  return <TraceViewContext.Provider value={value}>{children}</TraceViewContext.Provider>;
};
