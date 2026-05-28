"use client";

import React from "react";
import type { InboxItem } from "@multica/core/types";
import { useT } from "../i18n";
import type { TrayIssue, TrayTask } from "./useTrayDashboardData";

export interface TrayDashboardProps {
  unreadCount: number;
  unreadItems: InboxItem[];
  issues: TrayIssue[];
  tasks: TrayTask[];
}

export function TrayDashboard({ unreadCount, unreadItems, issues, tasks }: TrayDashboardProps) {
  const { t } = useT("tray");
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        fontSize: "13px",
        color: "#1a1a2e",
        backgroundColor: "#ffffff",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
{/* eslint-disable-next-line i18next/no-literal-string -- brand name, not translatable */}
        <span style={{ fontWeight: 600 }}>Multica</span>
        {unreadCount > 0 && (
          <span
            style={{
              backgroundColor: "#ef4444",
              color: "white",
              borderRadius: "999px",
              padding: "1px 8px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </div>

      <Section title="Unread mentions" count={unreadItems.length}>
        {unreadItems.length === 0 ? (
          <EmptyMessage>{t(($) => $.empty.unread_mentions)}</EmptyMessage>
        ) : (
          unreadItems.map((item) => (
            <InboxRow key={item.id} item={item} />
          ))
        )}
      </Section>

      <Section title="My active issues" count={issues.length}>
        {issues.length === 0 ? (
          <EmptyMessage>{t(($) => $.empty.active_issues)}</EmptyMessage>
        ) : (
          issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))
        )}
      </Section>

      <Section title="Running agent tasks" count={tasks.length}>
        {tasks.length === 0 ? (
          <EmptyMessage>{t(($) => $.empty.running_tasks)}</EmptyMessage>
        ) : (
          tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: "1px solid #f3f4f6" }}>
      <div
        style={{
          padding: "8px 16px",
          fontSize: "11px",
          fontWeight: 600,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{title}</span>
        {count > 0 && (
          <span
            style={{
              backgroundColor: "#f3f4f6",
              borderRadius: "999px",
              padding: "0 6px",
              fontSize: "11px",
              color: "#374151",
            }}
          >
            {count}
          </span>
        )}
      </div>
      <div>{children}</div>
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "12px 16px",
        color: "#9ca3af",
        fontSize: "12px",
      }}>
      {children}
    </div>
  );
}

function InboxRow({ item }: { item: InboxItem }) {
  const details = item.details as Record<string, string> | null;
  const issueIdentifier = details?.issue_identifier ?? "";

  return (
    <div
      style={{
        padding: "6px 16px",
        borderTop: "1px solid #f9fafb",
        cursor: "default",
      }}>
      <div style={{ fontSize: "12px", color: "#374151" }}>
        {issueIdentifier ? `${issueIdentifier}: ` : ""}
        {item.title}
      </div>
    </div>
  );
}

function IssueRow({ issue }: { issue: TrayIssue }) {
  const statusColor =
    issue.status === "in_progress"
      ? "#3b82f6"
      : issue.status === "blocked"
        ? "#ef4444"
        : "#6b7280";

  const statusLabel =
    issue.status === "in_progress"
      ? "In progress"
      : issue.status === "blocked"
        ? "Blocked"
        : issue.status;

  return (
    <div
      style={{
        padding: "6px 16px",
        borderTop: "1px solid #f9fafb",
        cursor: "default",
      }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
        }}>
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: statusColor,
            flexShrink: 0,
          }}
        />
        <span style={{ color: "#9ca3af", flexShrink: 0 }}>{issue.identifier}</span>
        <span
          style={{
            color: "#374151",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
          {issue.title}
        </span>
        <span
          style={{
            fontSize: "10px",
            color: statusColor,
            marginLeft: "auto",
            flexShrink: 0,
          }}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: TrayTask }) {
  const { t } = useT("tray");
  const statusColor =
    task.status === "running" ? "#22c55e" : task.status === "queued" ? "#f59e0b" : "#6b7280";
  const statusLabel =
    task.status === "running" ? "Running" : task.status === "queued" ? "Queued" : task.status;

  return (
    <div
      style={{
        padding: "6px 16px",
        borderTop: "1px solid #f9fafb",
        cursor: "default",
      }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "12px",
        }}>
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: statusColor,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            color: "#374151",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
          {t(($) => $.task_label, { id: task.id.slice(0, 8) })}
        </span>
        <span
          style={{
            fontSize: "10px",
            color: statusColor,
            marginLeft: "auto",
            flexShrink: 0,
          }}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}
