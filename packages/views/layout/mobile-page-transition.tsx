"use client";

import { useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useIsMobile } from "@multica/ui/hooks/use-mobile";
import { useNavigation } from "../navigation";
import { useWorkspaceSlug, paths } from "@multica/core/paths";

// Mobile-only route transition. Wraps DashboardLayout's main content area
// in AnimatePresence keyed by pathname so that route changes produce an
// iOS-style slide rather than a hard cut. Desktop renders children directly.
//
// Two transition shapes:
// - Sibling tab swap (e.g. Inbox -> Issues): cross-fade with a small vertical
//   nudge — no horizontal direction is meaningful between unrelated tops.
// - Drill / pop (entering or leaving a detail page): slide horizontally,
//   right-to-left for push, left-to-right for back. We detect drill by
//   comparing current depth to the previous pathname's depth: deeper means
//   push, shallower means pop, equal means tab swap.
//
// Chat route is special — ChatPage renders null (the real ChatWindow lives
// in the dashboard layout's `extra` slot and manages its own enter/exit
// animation). Running AnimatePresence on a null element produces a blank
// gap during tab switches. We skip the wrapper entirely on chat routes.
//
// pathname can be "" before NavigationAdapter mounts; skip animating the
// empty key so the very first render doesn't flash.
const PATH_DEPTH_RE = /\//g;
function pathDepth(p: string) {
  // count slashes — sufficient to distinguish /a/b vs /a/b/c without brittle
  // segment-by-segment compares (workspace slug, ids, etc. all just bump depth).
  return (p.match(PATH_DEPTH_RE) ?? []).length;
}

export function MobilePageTransition({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const { pathname } = useNavigation();
  const prevRef = useRef(pathname);
  const slug = useWorkspaceSlug();

  if (!isMobile) return <>{children}</>;

  // ChatPage renders null — ChatWindow in the `extra` slot owns its own
  // animation. Wrapping null in AnimatePresence produces an empty gap
  // during Inbox/Issues ↔ Chat tab switches.
  const chatPath = slug ? paths.workspace(slug).chat() : null;
  const isChatRoute = !!chatPath && pathname === chatPath;
  if (isChatRoute) return <>{children}</>;

  const prev = prevRef.current;
  prevRef.current = pathname;

  const prevDepth = pathDepth(prev);
  const curDepth = pathDepth(pathname);
  const direction =
    curDepth > prevDepth ? "push" : curDepth < prevDepth ? "pop" : "swap";

  // iOS uses ~50% screen translate; we use 24px because cross-fade does most
  // of the lift and a full slide on a single mounted element would feel
  // heavier than the hardware can keep up with under a route transition.
  //
  // Tab swap uses pure opacity fade — no spatial offset — so adjacent tabs
  // feel like peers fading in/out together rather than pages sliding past
  // each other.
  const initial =
    direction === "push"
      ? { opacity: 0, x: 24, y: 0 }
      : direction === "pop"
        ? { opacity: 0, x: -24, y: 0 }
        : { opacity: 0, x: 0, y: 0 };
  const exit =
    direction === "push"
      ? { opacity: 0, x: -16, y: 0 }
      : direction === "pop"
        ? { opacity: 0, x: 16, y: 0 }
        : { opacity: 0, x: 0, y: 0 };

  // mode="popLayout" runs exit + enter in parallel (vs "wait" which runs
  // them sequentially, creating a blank gap). Tab swaps get 150ms so the
  // bar feels instantly responsive; push/pop get 200ms with the iOS sheet
  // easing curve for a natural slide.
  const duration = direction === "swap" ? 0.15 : 0.2;
  const ease: [number, number, number, number] =
    direction === "swap" ? [0.4, 0, 0.2, 1] : [0.32, 0.72, 0, 1];

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={pathname || "_init"}
        initial={initial}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={exit}
        transition={{ duration, ease }}
        className="flex flex-1 min-h-0 flex-col transform-gpu"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
