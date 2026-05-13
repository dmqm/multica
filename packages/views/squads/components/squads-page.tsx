"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@multica/core/api";
import { useCurrentWorkspace, useWorkspacePaths } from "@multica/core/paths";
import { AppLink } from "../../navigation";
import { PageHeader } from "../../layout/page-header";
import { Users, Plus } from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { useModalStore } from "@multica/core/modals";
import type { Squad } from "@multica/core/types";

export function SquadsPage() {
  const workspace = useCurrentWorkspace();
  const p = useWorkspacePaths();
  const { data: squads = [], isLoading } = useQuery<Squad[]>({
    queryKey: ["squads", workspace?.id],
    queryFn: () => api.listSquads(),
    enabled: !!workspace?.id,
  });

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader className="justify-between px-5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-sm font-medium">Squads</h1>
          {!isLoading && squads.length > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">{squads.length}</span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => useModalStore.getState().open("create-squad")}>
          <Plus className="size-3.5 mr-1.5" />
          New Squad
        </Button>
      </PageHeader>
      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Loading...</div>
        ) : squads.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Users className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No squads yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {squads.map((squad) => (
              <AppLink
                key={squad.id}
                href={p.squadDetail(squad.id)}
                className="flex items-center gap-3 rounded-lg border p-4 hover:bg-accent/50 transition-colors"
              >
                <Users className="size-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{squad.name}</p>
                  {squad.description && (
                    <p className="text-sm text-muted-foreground truncate">{squad.description}</p>
                  )}
                </div>
              </AppLink>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
