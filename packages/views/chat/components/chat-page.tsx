"use client";

import { useEffect } from "react";
import { useChatStore } from "@multica/core/chat";
import { useIsMobile } from "@multica/ui/hooks/use-mobile";
import { paths, useWorkspaceSlug } from "@multica/core/paths";
import { useNavigation } from "../../navigation";
import { ChatWindow } from "./chat-window";

// Mobile: ChatPage renders ChatWindow as a regular route child, peer of
// Inbox and Issues inside AnimatePresence. Three pages share one animation
// system instead of Chat managing its own motion.div in the `extra` slot.
//
// Desktop /chat has no meaning — chat is a floating window. Anyone landing
// here gets the floating window opened and bounced to /issues.
export function ChatPage() {
  const setOpen = useChatStore((s) => s.setOpen);
  const { replace } = useNavigation();
  const slug = useWorkspaceSlug();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return;
    if (!slug) return;
    setOpen(true);
    replace(paths.workspace(slug).issues());
  }, [isMobile, slug, setOpen, replace]);

  if (isMobile) return <ChatWindow embedded />;
  return null;
}
