/**
 * Two-state issue-comment composer — visually aligned with `chat-composer.tsx`.
 *
 * State machine (single `expanded: boolean`):
 *   - compact     → a Pressable styled as input pill. Tap → expanded.
 *   - expanded    → rounded-3xl floating card identical to chat's, with
 *                   `@ · 📷 · 📎` on the left and Send on the right,
 *                   all inside the card's bottom action row.
 *
 * Collapse is blur-driven:
 *   - onBlur + text empty + no replyingTo → collapse to compact
 *   - otherwise (has text or has replyingTo) → stay expanded; draft visible
 *
 * The `replyingTo` chip renders ABOVE the pill/card as a separate
 * rounded-2xl pill, so its geometry doesn't clash with the rounded-3xl
 * card beneath.
 *
 * Differences vs. chat composer:
 *   - No "Stop" branch — comment submit is synchronous.
 *   - Two extra action buttons inside the card: `sf:photo` and `sf:paperclip`,
 *     wired to `useFileAttach` so user can drop an image/file inline.
 *   - `replyingTo` chip + cancel-reply affordance.
 *
 * v1 punts (intentional):
 *   - No comment-drafts persistence. Chat has one (`useChatDraftsStore`),
 *     comments don't. Punt until requested — typed text only survives within
 *     a single screen mount.
 *   - No tap-outside-to-dismiss gesture. Default RN blur handlers (return
 *     key, keyboard down-swipe) drive the collapse rule reliably.
 *
 * RN limitation: text inside `<TextInput>` can't be color-styled inline. The
 * mention text shows plain grey while editing; after send the comment
 * renders as a coloured chip in the timeline via mention-chip.tsx.
 */
import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { Text } from "@/components/ui/text";
import { AutosizeTextArea } from "@/components/ui/autosize-textarea";
import { MOBILE_PLACEHOLDER_COLOR } from "@/components/ui/input-tokens";
import { useFileAttach } from "@/components/editor/use-file-attach";
import { cn } from "@/lib/utils";
import { useMentionInput } from "@/lib/use-mention-input";
import { MentionSuggestionBar } from "./mention-suggestion-bar";

interface Props {
  /** Owning issue id — attached to uploads so the backend knows where this
   *  file belongs. Required because comments always live under an issue. */
  issueId: string;
  onSubmit: (vars: {
    content: string;
    parentId?: string;
  }) => Promise<unknown> | void;
  /** When set, the composer renders a "Replying to <name>" chip above
   *  the pill/card and submits with `parentId` set to this comment id. */
  replyingTo?: { commentId: string; name: string } | null;
  onCancelReply?: () => void;
}

const ICON_COLOR = "#71717a"; // muted-foreground
const ICON_SIZE = 18;

export function CommentComposer({
  issueId,
  onSubmit,
  replyingTo,
  onCancelReply,
}: Props) {
  const mention = useMentionInput();
  const fileAttach = useFileAttach();
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Focus the TextInput one frame after expansion so RN has finished
  // laying out the newly-mounted input. `autoFocus` on a conditionally-
  // rendered TextInput is unreliable across iOS/Android first mount.
  useEffect(() => {
    if (expanded) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [expanded]);

  const handleAttachImage = async () => {
    const result = await fileAttach.pickAndUploadImage({ issueId });
    if (result) mention.insertAtCursor(`![](${result.url})`);
  };

  const handleAttachFile = async () => {
    const result = await fileAttach.pickAndUploadFile({ issueId });
    if (result) {
      // Mobile preprocess converts `[📎 name](url)` to the file-card visual,
      // round-tripping identically to web.
      mention.insertAtCursor(`[📎 ${result.filename}](${result.url})`);
    }
  };

  const trimmed = mention.text.trim();
  // Gate on `!fileAttach.uploading` to prevent the upload's deferred
  // `insertAtCursor` from racing with a send that already cleared the
  // input (would orphan the inserted markdown into the next message).
  const canSend = trimmed.length > 0 && !submitting && !fileAttach.uploading;

  async function handleSend() {
    if (!canSend) return;
    setSubmitting(true);
    const snap = mention.snapshot();
    const content = mention.serialize().trim();
    mention.reset();
    try {
      await onSubmit({ content, parentId: replyingTo?.commentId });
      // Do NOT setExpanded(false) here. Collapse is blur-driven so the
      // user can immediately send a follow-up without the card jumping.
      // When they dismiss the keyboard, the rule below collapses for them.
    } catch {
      // Restore the snapshot so the user doesn't lose what they typed.
      mention.restore(snap);
    } finally {
      setSubmitting(false);
    }
  }

  function handleBlur() {
    setFocused(false);
    // Single collapse rule — let go of the card only when the user has
    // neither a draft nor an active reply target.
    if (mention.text.trim().length === 0 && !replyingTo) {
      setExpanded(false);
    }
  }

  function handleCancelReply() {
    onCancelReply?.();
    // If text is empty too, trigger the blur rule so the card collapses
    // without forcing the user to manually dismiss the keyboard.
    if (mention.text.trim().length === 0) {
      inputRef.current?.blur();
    }
  }

  const Chip = replyingTo ? (
    <View className="flex-row items-center gap-2 rounded-2xl bg-secondary/40 mx-3 mb-1.5 px-3 py-2">
      <Text className="text-xs text-muted-foreground">↩</Text>
      <Text
        className="flex-1 text-xs text-muted-foreground"
        numberOfLines={1}
      >
        Replying to{" "}
        <Text className="text-foreground font-medium">{replyingTo.name}</Text>
      </Text>
      <Pressable
        onPress={handleCancelReply}
        hitSlop={8}
        className="h-6 w-6 items-center justify-center rounded-full active:bg-secondary"
        accessibilityLabel="Cancel reply"
      >
        <Text className="text-base text-muted-foreground">✕</Text>
      </Pressable>
    </View>
  ) : null;

  if (!expanded) {
    return (
      <View className="pt-3 pb-2">
        {Chip}
        <View className="px-3">
          <Pressable
            onPress={() => setExpanded(true)}
            className="rounded-3xl bg-secondary px-4 py-3 active:opacity-80"
            style={{ borderCurve: "continuous" }}
            accessibilityRole="button"
            accessibilityLabel="Add a comment"
          >
            <Text
              className="text-base"
              style={{ color: MOBILE_PLACEHOLDER_COLOR }}
            >
              Add a comment…
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View>
      <MentionSuggestionBar {...mention.suggestionBar} />
      {Chip}
      <View className="px-3 pt-3 pb-2">
        <View
          className={cn(
            "rounded-3xl border bg-secondary",
            focused ? "border-primary/30" : "border-border",
          )}
          style={{ borderCurve: "continuous" }}
        >
          <AutosizeTextArea
            ref={inputRef}
            value={mention.text}
            onChangeText={mention.handlers.onChangeText}
            selection={mention.selection}
            onSelectionChange={mention.handlers.onSelectionChange}
            onFocus={() => setFocused(true)}
            onBlur={handleBlur}
            placeholder="Add a comment…"
            className="px-4 pt-3 pb-1"
            editable={!submitting}
          />
          <View className="flex-row items-center px-2 pb-2 pt-1">
            <Pressable
              onPress={mention.handlers.onAtButtonPress}
              disabled={submitting || fileAttach.uploading}
              className="h-8 w-8 items-center justify-center rounded-full active:opacity-60"
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Mention"
            >
              <Image
                source="sf:at"
                tintColor={ICON_COLOR}
                style={{ width: ICON_SIZE, height: ICON_SIZE }}
              />
            </Pressable>
            <Pressable
              onPress={handleAttachImage}
              disabled={submitting || fileAttach.uploading}
              className="h-8 w-8 items-center justify-center rounded-full active:opacity-60"
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Attach image"
            >
              <Image
                source="sf:photo"
                tintColor={ICON_COLOR}
                style={{ width: ICON_SIZE, height: ICON_SIZE }}
              />
            </Pressable>
            <Pressable
              onPress={handleAttachFile}
              disabled={submitting || fileAttach.uploading}
              className="h-8 w-8 items-center justify-center rounded-full active:opacity-60"
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Attach file"
            >
              <Image
                source="sf:paperclip"
                tintColor={ICON_COLOR}
                style={{ width: ICON_SIZE, height: ICON_SIZE }}
              />
            </Pressable>
            <View className="flex-1" />
            <Pressable
              onPress={handleSend}
              disabled={!canSend}
              className={cn(
                "h-8 w-8 items-center justify-center rounded-full",
                canSend ? "bg-primary active:opacity-80" : "bg-background",
              )}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: !canSend }}
            >
              <Image
                source="sf:arrow.up"
                tintColor={canSend ? "#ffffff" : "#a1a1aa"}
                style={{ width: 16, height: 16 }}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
