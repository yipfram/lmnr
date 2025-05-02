import { useVirtualizer } from "@tanstack/react-virtual";
import { isEmpty } from "lodash";
import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { memo, RefObject, useEffect, useState } from "react";

import SearchSpansInput from "@/components/traces/search-spans-input";
import { SessionPlayerHandle } from "@/components/traces/session-player";
import SpanCard from "@/components/traces/span-card";
import StatsShields from "@/components/traces/stats-shields";
import { useTraceViewContext } from "@/components/traces/trace-view/context";
import {
  setupTraceSubscription,
  updateSpansWithNewSpan,
  updateTraceWithNewSpan,
} from "@/components/traces/trace-view/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserContext } from "@/contexts/user-context";
import { cn } from "@/lib/utils";

interface TreeViewProps {
  isLoading: boolean;
  refetchSpans: (search: string, searchIn: string[]) => Promise<void>;
  timelineWidth: number;
  setTimelineWidth: (width: number) => void;
  browserSessionRef: RefObject<SessionPlayerHandle | null>;
  ref: RefObject<HTMLDivElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>; // Accept scroll ref from parent
}
const TreeView = ({
  isLoading,
  refetchSpans,
  timelineWidth,
  setTimelineWidth,
  browserSessionRef,
  ref,
  scrollRef,
}: TreeViewProps) => {
  const router = useRouter();
  const pathName = usePathname();
  const searchParams = useSearchParams();
  const { supabaseClient: supabase } = useUserContext();
  const {
    trace,
    setTrace,
    activeSpans,
    selectedSpan,
    setSelectedSpan,
    setSpans,
    collapsedSpans,
    setCollapsedSpans,
    childSpans,
    topLevelSpans,
    setShowBrowserSession,
  } = useTraceViewContext();
  const [searchEnabled, setSearchEnabled] = useState(!!searchParams.get("search"));
  const virtualizer = useVirtualizer({
    count: topLevelSpans.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 36,
    overscan: 5,
    getItemKey: (index) => topLevelSpans[index].spanId,
  });

  const items = virtualizer.getVirtualItems();

  useEffect(() => {
    const subscription = setupTraceSubscription(
      (spanRow) => {
        setTrace((currentTrace) => updateTraceWithNewSpan(currentTrace, spanRow));
        setSpans((currentSpans) => updateSpansWithNewSpan(currentSpans, spanRow));
      },
      () => setShowBrowserSession(true),
      supabase
    );

    return subscription.unsubscribe;
  }, [setShowBrowserSession, setSpans, setTrace, supabase]);

  if (!trace) {
    return null;
  }

  return (
    <div
      className={cn("p-0 border-r left-0 bg-background flex-none h-full w-full", {
        "sticky z-auto": !selectedSpan,
      })}
    >
      <div className="flex flex-col pb-4 relative" ref={ref}>
        {searchEnabled ? (
          <SearchSpansInput
            setSearchEnabled={setSearchEnabled}
            submit={refetchSpans}
            filterBoxClassName="top-10"
            className="rounded-none border-0 border-b ring-0"
          />
        ) : (
          <StatsShields
            className="px-2 h-10 sticky top-0 bg-background z-50 border-b w-full"
            startTime={trace.startTime}
            endTime={trace.endTime}
            totalTokenCount={trace.totalTokenCount}
            inputTokenCount={trace.inputTokenCount}
            outputTokenCount={trace.outputTokenCount}
            inputCost={trace.inputCost}
            outputCost={trace.outputCost}
            cost={trace.cost}
          >
            <Button size="icon" onClick={() => setSearchEnabled(true)} variant="outline" className="h-[22px] w-[22px]">
              <Search size={14} />
            </Button>
          </StatsShields>
        )}

        <div className="flex flex-col pt-1">
          {isLoading && (
            <div className="gap-y-2 px-2 mt-1">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}
          {!isLoading && !isEmpty(topLevelSpans) && (
            <div
              style={{
                height: virtualizer.getTotalSize(),
                width: "100%",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${items[0]?.start ?? 0}px)`,
                }}
              >
                {items.map((virtualRow) => {
                  const span = topLevelSpans[virtualRow.index];
                  return (
                    <div
                      key={virtualRow.key}
                      ref={virtualizer.measureElement}
                      data-index={virtualRow.index}
                      className="pl-6 relative"
                    >
                      <SpanCard
                        activeSpans={activeSpans}
                        traceStartTime={trace.startTime}
                        parentY={ref.current?.getBoundingClientRect().y || 0}
                        span={span}
                        childSpans={childSpans}
                        depth={1}
                        selectedSpan={selectedSpan}
                        containerWidth={timelineWidth}
                        collapsedSpans={collapsedSpans}
                        onToggleCollapse={(spanId) => {
                          setCollapsedSpans((prev) => {
                            const next = new Set(prev);
                            if (next.has(spanId)) {
                              next.delete(spanId);
                            } else {
                              next.add(spanId);
                            }
                            return next;
                          });
                        }}
                        onSpanSelect={(span) => {
                          const params = new URLSearchParams(searchParams);
                          setSelectedSpan(span);
                          setTimelineWidth(ref.current!.getBoundingClientRect().width + 1);
                          params.set("spanId", span.spanId);
                          router.push(`${pathName}?${searchParams.toString()}`);
                        }}
                        onSelectTime={(time) => {
                          browserSessionRef.current?.goto(time);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!isLoading && isEmpty(topLevelSpans) && (
            <span className="text-base text-secondary-foreground mx-auto mt-4">No spans found.</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default memo(TreeView);
