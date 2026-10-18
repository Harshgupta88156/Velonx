"use client";
import { type ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

export function Badge({
  kind,
  children,
}: {
  kind: string;
  children: ReactNode;
}) {
  return (
    <span className={`badge ${kind}`}>
      <i />
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <CheckCircle2 size={23} />
      <p>{children}</p>
    </div>
  );
}

export function Stat({
  icon,
  label,
  value,
  detail,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${color}`}>{icon}</span>
      </div>
      <strong className="stat-value">{value}</strong>
      <div className="stat-detail">
        <span className={`mini-dot ${color}`} />
        {detail}
      </div>
    </article>
  );
}
