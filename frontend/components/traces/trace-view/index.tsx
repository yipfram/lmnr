import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { Ref, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { useTraceViewContext } from "@/components/traces/trace-view/context";
import Header from "@/components/traces/trace-view/header";
import TreeView from "@/components/traces/trace-view/tree-view";
import { enrichSpansWithPending } from "@/components/traces/trace-view/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/lib/hooks/use-toast";
import { Span, Trace } from "@/lib/traces/types";
import { cn } from "@/lib/utils";

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../ui/resizable";
import SessionPlayer, { SessionPlayerHandle } from "../session-player";
import { SpanView } from "../span-view";
import Timeline from "../timeline";

export interface TraceViewHandle {
  toggleBrowserSession: () => void;
  resetSelectedSpan: () => void;
}

interface TraceViewProps {
  traceId: string;
  propsTrace?: Trace;
  onClose: () => void;
  fullScreen?: boolean;
  ref?: Ref<TraceViewHandle>;
}

export default function TraceView({ traceId, onClose, propsTrace, fullScreen = false, ref }: TraceViewProps) {
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const pathName = usePathname();
  const { toast } = useToast();
  const projectId = params?.projectId as string;

  const [isTraceLoading, setIsTraceLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const container = useRef<HTMLDivElement>(null);
  const traceTreePanel = useRef<HTMLDivElement>(null);
  const browserSessionRef = useRef<SessionPlayerHandle>(null);

  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [timelineWidth, setTimelineWidth] = useState(0);

  const {
    spans,
    selectedSpan,
    setSelectedSpan,
    setSpans,
    collapsedSpans,
    setActiveSpans,
    showBrowserSession,
    setShowBrowserSession,
    childSpans,
    trace,
    setTrace,
  } = useTraceViewContext();

  const [browserSessionTime, setBrowserSessionTime] = useState<number | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      toggleBrowserSession: () => setShowBrowserSession((prev) => !prev),
      resetSelectedSpan: () => {
        setSelectedSpan(null);
        setTimeout(() => {
          const params = new URLSearchParams(searchParams.toString());
          params.delete("spanId");
          router.push(`${pathName}?${params.toString()}`);
        }, 10);
      },
    }),
    [searchParams, pathName, router]
  );

  const handleFetchTrace = useCallback(async () => {
    try {
      setIsTraceLoading(true);
      if (propsTrace) {
        setTrace(propsTrace);
      } else {
        const response = await fetch(`/api/projects/${projectId}/traces/${traceId}`);
        if (!response.ok) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to load trace. Please try again.",
          });
          return;
        }
        const traceData = await response.json();
        setTrace(traceData);
        if (traceData.hasBrowserSession) {
          setShowBrowserSession(true);
        }
      }
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load trace. Please try again.",
      });
    } finally {
      setIsTraceLoading(false);
    }
  }, [projectId, propsTrace, setShowBrowserSession, setTrace, toast, traceId]);

  useEffect(() => {
    handleFetchTrace();
  }, [handleFetchTrace, projectId, traceId]);

  const fetchSpans = useCallback(
    async (search: string, searchIn: string[]) => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (searchIn && searchIn.length > 0) {
          searchIn.forEach((val) => params.append("searchIn", val));
        }
        const url = `/api/projects/${projectId}/traces/${traceId}/spans?${params.toString()}`;
        const response = await fetch(url);
        const results = await response.json();
        const spans = enrichSpansWithPending(results);

        setSpans(spans);

        // If there's only one span, select it automatically
        if (spans.length === 1) {
          const params = new URLSearchParams(searchParams);
          const singleSpan = spans[0];
          setSelectedSpan(singleSpan);
          params.set("spanId", singleSpan.spanId);
          params.set("traceId", traceId as string);
          router.push(`${pathName}?${params.toString()}`);
        } else {
          setSelectedSpan(
            searchParams.get("spanId")
              ? spans.find((span: Span) => span.spanId === searchParams.get("spanId")) || null
              : null
          );
        }
      } catch (e) {
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, traceId, setSpans, setSelectedSpan, router, pathName]
  );

  useEffect(() => {
    const search = searchParams.get("search") || "";
    const searchIn = searchParams.getAll("searchIn");

    fetchSpans(search, searchIn);

    return () => {
      setTrace(null);
      setSpans([]);
      setShowBrowserSession(false);
    };
  }, [projectId, router, fetchSpans, setTrace, setSpans, setShowBrowserSession]);

  const onTimelineChange = useCallback(
    (time: number) => {
      setBrowserSessionTime(time);

      const activeSpans = spans.filter((span: Span) => {
        const spanStartTime = new Date(span.startTime).getTime();
        const spanEndTime = new Date(span.endTime).getTime();

        return spanStartTime <= time && spanEndTime >= time && span.parentSpanId !== null;
      });

      setActiveSpans(activeSpans.map((span) => span.spanId));
    },
    [setActiveSpans, spans]
  );

  useEffect(() => {
    const selectedSpan = spans.find((span: Span) => span.spanId === searchParams.get("spanId"));
    if (selectedSpan) {
      setSelectedSpan(selectedSpan);
    }
  }, [searchParams, setSelectedSpan, spans]);

  useEffect(() => {
    if (!container.current) {
      return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerHeight(height);
        setContainerWidth(width);
      }
    });
    resizeObserver.observe(container.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [container.current]);

  useEffect(() => {
    if (!traceTreePanel.current) {
      return;
    }

    requestAnimationFrame(() => {
      const newTraceTreePanelWidth = traceTreePanel.current?.getBoundingClientRect().width || 0;

      if (!selectedSpan) {
        setTimelineWidth(containerWidth);
      } else {
        setTimelineWidth(newTraceTreePanelWidth + 1);
      }
    });
  }, [containerWidth, selectedSpan]);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col h-full w-full overflow-clip">
      <Header trace={trace} fullScreen={fullScreen} onClose={onClose} refetchTrace={handleFetchTrace} />
      <div className="flex-grow flex">
        {(!trace || spans.length === 0) && (
          <div className="w-full p-4 h-full flex flex-col gap-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}
        {trace && !isTraceLoading && spans?.length > 0 && (
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel className="h-full w-full relative">
              <div className="h-full w-full relative" ref={container}>
                <div className="absolute inset-0 overflow-auto" ref={scrollAreaRef}>
                  <div className="min-w-full min-h-full inline-flex">
                    <ResizablePanelGroup className="h-full" direction="horizontal">
                      <ResizablePanel
                        className={cn("h-full w-full", { "overflow-auto": selectedSpan })}
                        defaultSize={30}
                        minSize={20}
                      >
                        <TreeView
                          scrollRef={scrollAreaRef}
                          refetchSpans={fetchSpans}
                          isLoading={isLoading}
                          timelineWidth={timelineWidth}
                          setTimelineWidth={setTimelineWidth}
                          browserSessionRef={browserSessionRef}
                          ref={traceTreePanel}
                        />
                      </ResizablePanel>
                      <ResizableHandle className="focus:bg-blue-600" withHandle />
                      <ResizablePanel defaultSize={70}>
                        {!selectedSpan ? (
                          <Timeline
                            scrollRef={scrollAreaRef}
                            spans={spans}
                            childSpans={childSpans}
                            collapsedSpans={collapsedSpans}
                            browserSessionTime={browserSessionTime}
                          />
                        ) : (
                          <div className="h-full overflow-auto">
                            <SpanView key={selectedSpan.spanId} spanId={selectedSpan.spanId} />
                          </div>
                        )}
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </div>
                </div>
              </div>
            </ResizablePanel>
            {showBrowserSession && <ResizableHandle withHandle />}
            <ResizablePanel
              style={{
                display: showBrowserSession ? "block" : "none",
              }}
            >
              <SessionPlayer
                ref={browserSessionRef}
                hasBrowserSession={trace.hasBrowserSession}
                traceId={traceId}
                onTimelineChange={onTimelineChange}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>
    </div>
  );
}
