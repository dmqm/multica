"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@multica/core/api";
import { useWorkspaceId } from "@multica/core/hooks";
import { useWorkspacePaths } from "@multica/core/paths";
import { agentListOptions } from "@multica/core/workspace/queries";
import { useNavigation } from "../navigation";
import { Dialog, DialogContent, DialogTitle } from "@multica/ui/components/ui/dialog";
import { Button } from "@multica/ui/components/ui/button";
import { toast } from "sonner";
import type { Agent } from "@multica/core/types";

export function CreateSquadModal({ onClose }: { onClose: () => void }) {
  const router = useNavigation();
  const wsPaths = useWorkspacePaths();
  const wsId = useWorkspaceId();
  const queryClient = useQueryClient();
  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const activeAgents = agents.filter((a: Agent) => !a.archived_at && a.runtime_id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || !leaderId || submitting) return;
    setSubmitting(true);
    try {
      const squad = await api.createSquad({
        name: name.trim(),
        description: description.trim() || undefined,
        leader_id: leaderId,
      });
      queryClient.invalidateQueries({ queryKey: ["squads"] });
      onClose();
      toast.success("Squad created");
      router.push(wsPaths.squadDetail(squad.id));
    } catch {
      toast.error("Failed to create squad");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-base font-semibold">Create Squad</DialogTitle>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Frontend Team"
              autoFocus
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Leader (Agent)</label>
            <select
              value={leaderId}
              onChange={(e) => setLeaderId(e.target.value)}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Select an agent...</option>
              {activeAgents.map((a: Agent) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSubmit} disabled={!name.trim() || !leaderId || submitting}>
              {submitting ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
