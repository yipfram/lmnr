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
import { ScrollArea, ScrollBar } from "../../ui/scroll-area";
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
  }, [searchParams, spans]);

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

  const [treeViewWidth, setTreeViewWidth] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        const savedWidth = localStorage.getItem("trace-view:tree-view-width");
        return savedWidth ? parseInt(savedWidth, 10) : 384;
      }
      return 384;
    } catch (e) {
      return 384;
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("trace-view:tree-view-width", treeViewWidth.toString());
      }
    } catch (e) {}
  }, [treeViewWidth]);

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
            <ResizablePanel>
              <div className="flex h-full w-full relative" ref={container}>
                <ScrollArea
                  className="overflow-auto w-1 flex-grow"
                  style={{
                    width: timelineWidth,
                    height: containerHeight,
                  }}
                >
                  <table className="w-full h-full">
                    <tbody className="w-full">
                      <tr
                        className="flex"
                        style={{
                          minHeight: containerHeight,
                        }}
                      >
                        <td
                          className={cn(
                            "p-0 border-r left-0 bg-background flex-none",
                            !selectedSpan ? "sticky z-50" : ""
                          )}
                          style={{
                            width: treeViewWidth,
                            maxWidth: treeViewWidth,
                            position: "relative",
                          }}
                        >
                          <TreeView
                            refetchSpans={fetchSpans}
                            isLoading={isLoading}
                            timelineWidth={timelineWidth}
                            setTimelineWidth={setTimelineWidth}
                            browserSessionRef={browserSessionRef}
                            ref={traceTreePanel}
                          />
                          {!selectedSpan && (
                            <div
                              className="absolute top-0 right-0 h-full w-1 bg-border z-50 cursor-col-resize hover:bg-blue-400 transition-colors"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const startX = e.clientX;
                                const startWidth = treeViewWidth;

                                const handleMouseMove = (moveEvent: MouseEvent) => {
                                  const newWidth = Math.max(
                                    200,
                                    Math.min(containerWidth / 2, startWidth + moveEvent.clientX - startX)
                                  );
                                  setTreeViewWidth(newWidth);
                                };

                                const handleMouseUp = () => {
                                  document.removeEventListener("mousemove", handleMouseMove);
                                  document.removeEventListener("mouseup", handleMouseUp);
                                };

                                document.addEventListener("mousemove", handleMouseMove);
                                document.addEventListener("mouseup", handleMouseUp);
                              }}
                            />
                          )}
                        </td>
                        {!selectedSpan && (
                          <td className="flex flex-grow w-full p-0 relative">
                            <Timeline
                              spans={spans}
                              childSpans={childSpans}
                              collapsedSpans={collapsedSpans}
                              browserSessionTime={browserSessionTime}
                            />
                          </td>
                        )}
                      </tr>
                    </tbody>
                  </table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
                {selectedSpan && (
                  <div style={{ width: containerWidth - timelineWidth }}>
                    <SpanView key={selectedSpan.spanId} spanId={selectedSpan.spanId} />
                  </div>
                )}
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
