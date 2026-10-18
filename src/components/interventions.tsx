"use client";
import { useState } from "react";
import type { FacilityRisk, Facility, Locale } from "@/lib/types";
import type { Intervention } from "@/lib/db";

const copy = {
  en: { title: "Facility interventions", help: "Administrator acknowledgement and follow-up for facilities flagged critical or on watch. Risk reflects resource scarcity and reporting gaps, not staff performance.", none: "No facility currently needs intervention.", open: "Open", acknowledged: "Acknowledged", in_progress: "In progress", resolved: "Resolved", note: "Action note (min 5 characters)", save: "Save", adminOnly: "Only the district administrator can record interventions.", critical: "Critical", watch: "Watch" },
  hi: { title: "सुविधा हस्तक्षेप", help: "गंभीर या निगरानी वाली सुविधाओं के लिए प्रशासक की स्वीकृति और अनुवर्ती कार्रवाई। जोखिम संसाधन की कमी और रिपोर्टिंग अंतराल दर्शाता है, कर्मचारियों का प्रदर्शन नहीं।", none: "अभी किसी सुविधा को हस्तक्षेप की आवश्यकता नहीं है।", open: "खुला", acknowledged: "स्वीकृत", in_progress: "प्रगति में", resolved: "समाधान हुआ", note: "कार्रवाई नोट (कम से कम 5 अक्षर)", save: "सहेजें", adminOnly: "केवल जिला प्रशासक हस्तक्षेप दर्ज कर सकते हैं।", critical: "गंभीर", watch: "निगरानी" },
  mr: { title: "सुविधा हस्तक्षेप", help: "गंभीर किंवा निरीक्षणातील सुविधांसाठी प्रशासकाची पोचपावती आणि पाठपुरावा. जोखीम संसाधनांची कमतरता आणि अहवालातील तफावत दर्शवते, कर्मचाऱ्यांची कामगिरी नाही.", none: "सध्या कोणत्याही सुविधेला हस्तक्षेपाची गरज नाही.", open: "खुले", acknowledged: "पोचपावती दिली", in_progress: "प्रगतीत", resolved: "निराकरण झाले", note: "कृती टीप (किमान ५ अक्षरे)", save: "जतन करा", adminOnly: "फक्त जिल्हा प्रशासक हस्तक्षेप नोंदवू शकतात.", critical: "गंभीर", watch: "निरीक्षण" },
} as const;
const next = { open: "acknowledged", acknowledged: "in_progress", in_progress: "resolved" } as const;

export default function Interventions({ facilities, risks, interventions, isAdmin, busy, locale, onSave }: {
  facilities: Facility[]; risks: FacilityRisk[]; interventions: Intervention[]; isAdmin: boolean; busy: boolean; locale: Locale;
  onSave: (facilityId: string, status: Intervention["status"], note: string) => void;
}) {
  const c = copy[locale];
  const [notes, setNotes] = useState<Record<string, string>>({});
  const flagged = risks.filter((r) => r.level !== "stable");
  const current = (id: string) => interventions.find((i) => i.facilityId === id);
  return (
    <section className="panel interventions-panel" aria-labelledby="interventions-title">
      <div className="panel-heading"><div><h2 id="interventions-title">{c.title}</h2><p className="muted">{c.help}</p></div></div>
      {!isAdmin && <p className="muted" style={{ padding: "0 20px" }}>{c.adminOnly}</p>}
      {!flagged.length && <p className="muted" style={{ padding: "0 20px 16px" }}>{c.none}</p>}
      <ul style={{ listStyle: "none", margin: 0, padding: "0 20px 16px", display: "grid", gap: 10 }}>
        {flagged.map((r) => {
          const cur = current(r.facilityId);
          const status = cur?.status ?? "open";
          const to = status === "resolved" ? null : next[status];
          const note = notes[r.facilityId] ?? "";
          return (
            <li key={r.facilityId} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
              <strong>{facilities.find((f) => f.id === r.facilityId)?.name ?? r.facilityId}</strong>
              <span className="muted">{c[r.level as "critical" | "watch"]} · {r.score}</span>
              <span className="muted">{c[status]}</span>
              {isAdmin && to && (
                <>
                  <input aria-label={c.note} placeholder={c.note} value={note} style={{ flex: "1 1 220px", width: "auto" }}
                    onChange={(e) => setNotes({ ...notes, [r.facilityId]: e.target.value })} />
                  <button className="button secondary small" disabled={busy || note.trim().length < 5}
                    onClick={() => { onSave(r.facilityId, to, note.trim()); setNotes({ ...notes, [r.facilityId]: "" }); }}>
                    {c.save}: {c[to]}
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
