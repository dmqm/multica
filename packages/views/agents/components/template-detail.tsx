"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Loader2,
  Lock,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { agentTemplateDetailOptions } from "@multica/core/agents/queries";
import { runtimeModelsOptions } from "@multica/core/runtimes";
import type {
  AgentTemplateSummary,
  MemberWithUser,
  RuntimeDevice,
} from "@multica/core/types";
import { Button } from "@multica/ui/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@multica/ui/components/ui/popover";
import { Label } from "@multica/ui/components/ui/label";
import { cn } from "@multica/ui/lib/utils";
import { useT } from "../../i18n";
import { ProviderLogo } from "../../runtimes/components/provider-logo";
import { ActorAvatar } from "../../common/actor-avatar";
import { ModelDropdown } from "./model-dropdown";
import { getAccentClass, getTemplateIcon } from "./template-picker";

export interface TemplateDetailUseOptions {
  runtimeId: string;
  model: string;
}

interface TemplateDetailProps {
  template: AgentTemplateSummary;
  /** Workspace runtimes — used to populate the runtime picker. */
  runtimes: RuntimeDevice[];
  runtimesLoading?: boolean;
  /** Members of the workspace, used to label runtime owners. */
  members: MemberWithUser[];
  /** Current user id, used to grey-out private runtimes owned by others. */
  currentUserId: string | null;
  /** Fired when the user clicks "Use this template". The dialog calls the
   *  create API with the runtime + model the user picked here. */
  onUse: (template: AgentTemplateSummary, options: TemplateDetailUseOptions) => void;
  /** True while the parent's create request is in flight; we disable the
   *  Use button so the user can't double-click. */
  creating?: boolean;
  /** Upstream URLs the server reported as unreachable on the most recent
   *  create attempt. Surfaces an inline error banner so the user knows
   *  *why* Create didn't navigate. */
  failedURLs?: readonly string[] | null;
}

/**
 * Step 3 of the create-agent flow: a read-only preview of the picked
 * template — runtime + model picker, instructions, skill list, and a
 * "Use this template" CTA. The CTA stays disabled until the user picks
 * a runtime *and* a model (or the runtime explicitly doesn't support
 * per-agent model selection, in which case model is auto-cleared and
 * not required).
 */
export function TemplateDetail({
  template,
  runtimes,
  runtimesLoading,
  members,
  currentUserId,
  onUse,
  creating = false,
  failedURLs,
}: TemplateDetailProps) {
  const { t } = useT("agents");
  const { data: detail, isLoading, error } = useQuery(
    agentTemplateDetailOptions(template.slug),
  );

  const Icon = getTemplateIcon(template.icon);
  const accentClass = getAccentClass(template.accent);

  // Runtime + model state — local to this step so the form path's own
  // selection is untouched. User must pick both before Use is enabled.
  const [selectedRuntimeId, setSelectedRuntimeId] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [runtimeOpen, setRuntimeOpen] = useState(false);

  const isRuntimeDisabledForUser = (r: RuntimeDevice): boolean => {
    if (!currentUserId) return false;
    if (r.owner_id === currentUserId) return false;
    return r.visibility !== "public";
  };

  const sortedRuntimes = useMemo(() => {
    return [...runtimes].sort((a, b) => {
      const aMine = a.owner_id === currentUserId;
      const bMine = b.owner_id === currentUserId;
      if (aMine && !bMine) return -1;
      if (!aMine && bMine) return 1;
      const aDisabled = isRuntimeDisabledForUser(a);
      const bDisabled = isRuntimeDisabledForUser(b);
      if (!aDisabled && bDisabled) return -1;
      if (aDisabled && !bDisabled) return 1;
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtimes, currentUserId]);

  const selectedRuntime =
    runtimes.find((r) => r.id === selectedRuntimeId) ?? null;
  const selectedRuntimeLocked =
    selectedRuntime != null && isRuntimeDisabledForUser(selectedRuntime);

  const getOwnerMember = (ownerId: string | null) => {
    if (!ownerId) return null;
    return members.find((m) => m.user_id === ownerId) ?? null;
  };

  // Query the selected runtime's model catalog so we can tell whether the
  // runtime supports per-agent model selection at all. Cached by TanStack
  // Query so ModelDropdown's own subscription reuses the same data.
  const modelsQuery = useQuery(
    runtimeModelsOptions(
      selectedRuntime?.status === "online" ? selectedRuntime.id : null,
    ),
  );
  const modelSupported = modelsQuery.data?.supported ?? true;

  // Use CTA is enabled only when:
  //   - a runtime is picked and not locked
  //   - either the runtime doesn't support per-agent model selection
  //     (model is irrelevant), or the user picked a non-empty model.
  const modelSatisfied = !modelSupported || model.trim() !== "";
  const canUse =
    !creating &&
    !!selectedRuntime &&
    !selectedRuntimeLocked &&
    modelSatisfied;

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-6">
          {/* failedURLs banner — sits above the header so it's the first
              thing the user sees after the spinner clears on a 422. */}
          {failedURLs && failedURLs.length > 0 && (
            <div className="mb-5 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="font-medium text-destructive">
                {t(($) => $.create_dialog.template_failure.title)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t(($) => $.create_dialog.template_failure.body)}
              </div>
              <ul className="mt-2 space-y-0.5 text-xs">
                {failedURLs.map((u) => (
                  <li key={u} className="break-all font-mono">
                    {u}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Header: icon + name + description. Same rhythm as the picker
              card so the user reads the transition as "the same item,
              expanded". */}
          <div className="flex items-start gap-3">
            <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-lg", accentClass)}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">{template.name}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{template.description}</p>
              {template.category ? (
                <div className="mt-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {template.category}
                </div>
              ) : null}
            </div>
          </div>

          {/* Runtime + model selectors — required before Use is enabled.
              Two-column grid so they read as a single configuration row. */}
          <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <Label className="text-xs text-muted-foreground">
                {t(($) => $.create_dialog.runtime_label)}
              </Label>
              <Popover open={runtimeOpen} onOpenChange={setRuntimeOpen}>
                <PopoverTrigger
                  disabled={runtimes.length === 0 && !runtimesLoading}
                  className="flex w-full min-w-0 items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 mt-1.5 text-left text-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                >
                  {runtimesLoading ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                  ) : selectedRuntime ? (
                    <ProviderLogo provider={selectedRuntime.provider} className="h-4 w-4 shrink-0" />
                  ) : (
                    <Cloud className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {runtimesLoading
                          ? t(($) => $.create_dialog.runtime_loading)
                          : selectedRuntime?.name ?? t(($) => $.create_dialog.runtime_none)}
                      </span>
                      {selectedRuntime?.runtime_mode === "cloud" && (
                        <span className="shrink-0 rounded bg-info/10 px-1.5 py-0.5 text-xs font-medium text-info">
                          {t(($) => $.create_dialog.runtime_cloud_badge)}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {selectedRuntime
                        ? getOwnerMember(selectedRuntime.owner_id)?.name ?? selectedRuntime.device_info
                        : t(($) => $.create_dialog.runtime_register_first)}
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${runtimeOpen ? "rotate-180" : ""}`} />
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-[var(--anchor-width)] p-1 max-h-60 overflow-y-auto"
                >
                  {sortedRuntimes.map((device) => {
                    const ownerMember = getOwnerMember(device.owner_id);
                    const disabled = isRuntimeDisabledForUser(device);
                    const disabledTitle = disabled
                      ? t(($) => $.create_dialog.runtime_private_locked_tooltip)
                      : undefined;
                    return (
                      <button
                        key={device.id}
                        type="button"
                        disabled={disabled}
                        title={disabledTitle}
                        onClick={() => {
                          if (disabled) return;
                          setSelectedRuntimeId(device.id);
                          // Picking a new runtime clears the model — the
                          // catalog (and "supported" flag) changes per
                          // runtime, so any previously-picked model is
                          // potentially invalid.
                          setModel("");
                          setRuntimeOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                          disabled
                            ? "cursor-not-allowed opacity-50"
                            : device.id === selectedRuntimeId
                              ? "bg-accent"
                              : "hover:bg-accent/50"
                        }`}
                      >
                        <ProviderLogo provider={device.provider} className="h-4 w-4 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{device.name}</span>
                            {device.runtime_mode === "cloud" && (
                              <span className="shrink-0 rounded bg-info/10 px-1.5 py-0.5 text-xs font-medium text-info">
                                {t(($) => $.create_dialog.runtime_cloud_badge)}
                              </span>
                            )}
                            {disabled && (
                              <span className="shrink-0 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                <Lock className="h-3 w-3" />
                                {t(($) => $.create_dialog.runtime_private_badge)}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            {ownerMember ? (
                              <>
                                <ActorAvatar actorType="member" actorId={ownerMember.user_id} size={14} />
                                <span className="truncate">{ownerMember.name}</span>
                              </>
                            ) : (
                              <span className="truncate">{device.device_info}</span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            device.status === "online" ? "bg-success" : "bg-muted-foreground/40"
                          }`}
                        />
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
            </div>

            <ModelDropdown
              runtimeId={selectedRuntime?.id ?? null}
              runtimeOnline={selectedRuntime?.status === "online"}
              value={model}
              onChange={setModel}
              disabled={!selectedRuntime}
            />
          </section>

          {/* Skill list */}
          <section className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(($) => $.create_dialog.template_detail.skill_count, {
                count: template.skills.length,
              })}
            </h3>
            <ul className="mt-3 space-y-2">
              {template.skills.map((s) => (
                <li
                  key={s.source_url}
                  className="rounded-lg border bg-card px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" />
                    <span className="font-mono text-xs font-medium">{s.cached_name}</span>
                  </div>
                  {s.cached_description ? (
                    <p className="mt-1 ml-6 text-xs text-muted-foreground">
                      {s.cached_description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          {/* Instructions — lazy fetch + loading/error states */}
          <section className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(($) => $.create_dialog.template_detail.instructions_label)}
            </h3>
            <div className="mt-3 rounded-lg border bg-muted/30 px-4 py-3">
              {isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t(($) => $.create_dialog.template_detail.instructions_loading)}
                </div>
              ) : error ? (
                <div className="text-xs text-destructive">
                  {error instanceof Error
                    ? error.message
                    : t(($) => $.create_dialog.template_detail.load_failed)}
                </div>
              ) : (
                <pre className="max-h-60 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
                  {detail?.instructions ?? ""}
                </pre>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Sticky CTA footer */}
      <div className="flex items-center justify-end gap-2 border-t bg-background px-5 py-3">
        <Button
          onClick={() =>
            selectedRuntime &&
            onUse(template, { runtimeId: selectedRuntime.id, model: model.trim() })
          }
          disabled={!canUse}
          title={
            selectedRuntimeLocked
              ? t(($) => $.create_dialog.runtime_private_locked_tooltip)
              : undefined
          }
          className="gap-1.5"
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t(($) => $.create_dialog.template_detail.creating)}
            </>
          ) : (
            <>
              {t(($) => $.create_dialog.template_detail.use)}
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </>
  );
}
