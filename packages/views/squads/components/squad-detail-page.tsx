"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@multica/core/api";
import { useCurrentWorkspace, useWorkspacePaths } from "@multica/core/paths";
import { useWorkspaceId } from "@multica/core/hooks";
import { agentListOptions, memberListOptions } from "@multica/core/workspace/queries";
import { useNavigation } from "../../navigation";
import { PageHeader } from "../../layout/page-header";
import { Users, Plus, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { AppLink } from "../../navigation";
import { toast } from "sonner";
import type { Squad, SquadMember, Agent } from "@multica/core/types";

export function SquadDetailPage() {
  const workspace = useCurrentWorkspace();
  const wsId = useWorkspaceId();
  const p = useWorkspacePaths();
  const { pathname, push } = useNavigation();
  const queryClient = useQueryClient();
  const squadId = pathname.split("/").pop() ?? "";

  const { data: squad } = useQuery<Squad>({
    queryKey: ["squad", workspace?.id, squadId],
    queryFn: () => api.getSquad(squadId),
    enabled: !!workspace?.id && !!squadId,
  });

  const { data: members = [], refetch: refetchMembers } = useQuery<SquadMember[]>({
    queryKey: ["squad-members", workspace?.id, squadId],
    queryFn: () => api.listSquadMembers(squadId),
    enabled: !!workspace?.id && !!squadId,
  });

  const { data: agents = [] } = useQuery(agentListOptions(wsId));
  const { data: wsMembers = [] } = useQuery(memberListOptions(wsId));

  const [showAddMember, setShowAddMember] = useState(false);
  const [addType, setAddType] = useState<"agent" | "member">("agent");
  const [addId, setAddId] = useState("");
  const [addRole, setAddRole] = useState("");

  const addMemberMut = useMutation({
    mutationFn: () => api.addSquadMember(squadId, { member_type: addType, member_id: addId, role: addRole }),
    onSuccess: () => { refetchMembers(); setShowAddMember(false); setAddId(""); setAddRole(""); toast.success("Member added"); },
    onError: () => toast.error("Failed to add member"),
  });

  const removeMemberMut = useMutation({
    mutationFn: (m: SquadMember) => api.removeSquadMember(squadId, { member_type: m.member_type, member_id: m.member_id }),
    onSuccess: () => { refetchMembers(); toast.success("Member removed"); },
    onError: () => toast.error("Failed to remove member"),
  });

  const deleteMut = useMutation({
    mutationFn: () => api.deleteSquad(squadId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["squads"] }); push(p.squads()); toast.success("Squad archived"); },
    onError: () => toast.error("Failed to archive squad"),
  });

  const getEntityName = (type: string, id: string) => {
    if (type === "agent") return agents.find((a: Agent) => a.id === id)?.name ?? id.slice(0, 8);
    return wsMembers.find((m) => m.user_id === id)?.name ?? id.slice(0, 8);
  };

  if (!squad) {
    return <div className="p-6 text-muted-foreground text-sm">Loading...</div>;
  }

  const availableAgents = agents.filter((a: Agent) => !a.archived_at && !members.some((m) => m.member_type === "agent" && m.member_id === a.id));
  const availableMembers = wsMembers.filter((m) => !members.some((sm) => sm.member_type === "member" && sm.member_id === m.user_id));

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader className="justify-between px-5">
        <div className="flex items-center gap-2">
          <AppLink href={p.squads()} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </AppLink>
          <Users className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-sm font-medium">{squad.name}</h1>
        </div>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Archive this squad?")) deleteMut.mutate(); }}>
          <Trash2 className="size-3.5 mr-1" />
          Archive
        </Button>
      </PageHeader>
      <div className="flex-1 p-6 space-y-6">
        {squad.description && (
          <p className="text-sm text-muted-foreground">{squad.description}</p>
        )}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Members ({members.length})</h3>
          <Button size="sm" variant="outline" onClick={() => setShowAddMember(true)}>
            <Plus className="size-3.5 mr-1" />
            Add Member
          </Button>
        </div>

        {showAddMember && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex gap-2">
              <select value={addType} onChange={(e) => { setAddType(e.target.value as "agent" | "member"); setAddId(""); }} className="rounded-md border bg-transparent px-2 py-1 text-sm">
                <option value="agent">Agent</option>
                <option value="member">Member</option>
              </select>
              <select value={addId} onChange={(e) => setAddId(e.target.value)} className="flex-1 rounded-md border bg-transparent px-2 py-1 text-sm">
                <option value="">Select...</option>
                {addType === "agent"
                  ? availableAgents.map((a: Agent) => <option key={a.id} value={a.id}>{a.name}</option>)
                  : availableMembers.map((m) => <option key={m.user_id} value={m.user_id}>{m.name}</option>)
                }
              </select>
              <input type="text" value={addRole} onChange={(e) => setAddRole(e.target.value)} placeholder="Role (optional)" className="w-32 rounded-md border bg-transparent px-2 py-1 text-sm" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => addMemberMut.mutate()} disabled={!addId || addMemberMut.isPending}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddMember(false)}>Cancel</Button>
            </div>
          </div>
        )}

        <div className="grid gap-2">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-md border p-3">
              <Users className="size-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{getEntityName(m.member_type, m.member_id)}</span>
                <span className="ml-2 text-xs text-muted-foreground">{m.member_type}</span>
                {m.role && <span className="ml-2 text-xs bg-accent px-1.5 py-0.5 rounded">{m.role}</span>}
              </div>
              {!(m.member_type === "agent" && squad.leader_id === m.member_id) && (
                <Button size="sm" variant="ghost" className="text-destructive h-7" onClick={() => removeMemberMut.mutate(m)}>
                  <Trash2 className="size-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
