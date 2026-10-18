"use client";
import { useState } from "react";
import type { Intelligence, Locale, Snapshot } from "@/lib/types";
import { resilience } from "@/lib/resilience";

const copy = {
  en: { resTitle: "District resilience score", resNote: "Equal-weight average of four shares of current records. Unknown records are excluded. A prototype policy, not a staff-performance or clinical measure.", stock: "Medicine stock healthy", beds: "Facilities under 85% bed occupancy", staffing: "Facilities with at least 80% recorded duty cover", laboratory: "Lab tests operational with reagents", of: "of", na: "No data",
    whatTitle: "What-if transfer preview", whatNote: "Adjust the quantity to see stock cover before approving. This is a preview only; nothing is reserved or moved.", quantity: "Quantity", recipient: "Recipient cover", donor: "Donor cover", days: "days", safety: "Donor stays above safety stock", breach: "Donor would fall below safety stock", none: "No transfer recommendations right now.",
    timeTitle: "Shortage timeline (next 14 days)", timeNote: "Projected from forecast demand. Act-by date assumes one day for dispatch and transit (policy assumption).", date: "Projected shortage", act: "Act by", noTime: "No shortage projected within 14 days." },
  hi: { resTitle: "जिला सहनशीलता स्कोर", resNote: "वर्तमान रिकॉर्ड के चार अनुपातों का समान-भार औसत। अज्ञात रिकॉर्ड शामिल नहीं हैं। यह प्रोटोटाइप नीति है, कर्मचारी प्रदर्शन या चिकित्सीय माप नहीं।", stock: "दवा स्टॉक ठीक", beds: "85% से कम बिस्तर भराव वाली सुविधाएँ", staffing: "कम से कम 80% दर्ज चिकित्सक उपस्थिति वाली सुविधाएँ", laboratory: "अभिकर्मक सहित चालू जाँचें", of: "में से", na: "डेटा नहीं",
    whatTitle: "स्थानांतरण पूर्वावलोकन (क्या होगा यदि)", whatNote: "स्वीकृति से पहले मात्रा बदलकर स्टॉक कवर देखें। यह केवल पूर्वावलोकन है; कुछ आरक्षित या स्थानांतरित नहीं होता।", quantity: "मात्रा", recipient: "प्राप्तकर्ता कवर", donor: "दाता कवर", days: "दिन", safety: "दाता सुरक्षा स्टॉक से ऊपर रहेगा", breach: "दाता सुरक्षा स्टॉक से नीचे जाएगा", none: "अभी कोई स्थानांतरण अनुशंसा नहीं।",
    timeTitle: "कमी की समयरेखा (अगले 14 दिन)", timeNote: "पूर्वानुमानित मांग पर आधारित। कार्रवाई की तिथि में प्रेषण और परिवहन के लिए एक दिन माना गया है (नीतिगत धारणा)।", date: "अनुमानित कमी", act: "कार्रवाई की तिथि", noTime: "14 दिनों में कोई कमी अनुमानित नहीं।" },
  mr: { resTitle: "जिल्हा सक्षमता गुण", resNote: "सध्याच्या नोंदींच्या चार प्रमाणांची समान-भार सरासरी. अज्ञात नोंदी वगळल्या आहेत. हे प्रोटोटाइप धोरण आहे, कर्मचारी कामगिरी किंवा वैद्यकीय मापन नाही.", stock: "औषध साठा समाधानकारक", beds: "85% पेक्षा कमी खाट वापर असलेल्या सुविधा", staffing: "किमान 80% नोंदवलेली डॉक्टर उपस्थिती असलेल्या सुविधा", laboratory: "अभिकर्मकासह चालू चाचण्या", of: "पैकी", na: "डेटा नाही",
    whatTitle: "हस्तांतरण पूर्वावलोकन (जर असे झाले तर)", whatNote: "मंजुरीपूर्वी प्रमाण बदलून साठा कव्हर पहा. हे फक्त पूर्वावलोकन आहे; काहीही राखीव किंवा हलवले जात नाही.", quantity: "प्रमाण", recipient: "प्राप्तकर्ता कव्हर", donor: "दाता कव्हर", days: "दिवस", safety: "दाता सुरक्षा साठ्याच्या वर राहील", breach: "दाता सुरक्षा साठ्याच्या खाली जाईल", none: "सध्या हस्तांतरण शिफारस नाही.",
    timeTitle: "कमतरता वेळापत्रक (पुढील 14 दिवस)", timeNote: "अंदाजित मागणीवर आधारित. कृतीची तारीख पाठवणी आणि वाहतुकीसाठी एक दिवस गृहीत धरते (धोरणात्मक गृहीतक).", date: "अंदाजित कमतरता", act: "कृती करण्याची तारीख", noTime: "14 दिवसांत कमतरता अपेक्षित नाही." },
} as const;

const addDays = (v: string, n: number) => new Date(Date.parse(v) + n * 864e5).toISOString().slice(0, 10);

export default function PlanningPanel({ snapshot, intelligence, locale }: { snapshot: Snapshot; intelligence: Intelligence; locale: Locale }) {
  const c = copy[locale];
  const r = resilience(snapshot, intelligence);
  const recs = intelligence.recommendations;
  const [index, setIndex] = useState(0);
  const rec = recs[Math.min(index, Math.max(0, recs.length - 1))];
  const [qty, setQty] = useState<number | null>(null);
  const q = rec ? Math.min(qty ?? rec.quantity, rec.quantity) : 0;
  const find = (facilityId: string) => intelligence.inventory.find((i) => i.facilityId === facilityId && i.medicineId === rec?.medicineId);
  const rIns = rec && find(rec.recipientId), dIns = rec && find(rec.donorId);
  const cover = (avail?: number, demand?: number) => (avail !== undefined && demand ? Math.round((avail / demand) * 10) / 10 : null);
  const name = (id: string) => snapshot.facilities.find((f) => f.id === id)?.name ?? id;
  const med = (id: string) => snapshot.medicines.find((m) => m.id === id)?.name ?? id;
  const donorAfter = dIns ? dIns.available - q : 0;
  const timeline = intelligence.inventory
    .filter((i) => i.shortageDate && Date.parse(i.shortageDate) <= Date.parse(snapshot.asOf) + 14 * 864e5)
    .sort((a, b) => a.shortageDate!.localeCompare(b.shortageDate!));
  const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString(locale));
  return (
    <div style={{ display: "grid", gap: 16, marginBottom: 16 }}>
      <section className="panel" aria-labelledby="res-title">
        <div className="panel-heading"><div><h2 id="res-title">{c.resTitle}</h2><p className="muted">{c.resNote}</p></div><strong style={{ fontSize: 28 }}>{r.score === null ? c.na : r.score}</strong></div>
        <ul style={{ listStyle: "none", margin: 0, padding: "0 20px 16px", display: "grid", gap: 6 }}>
          {r.components.map((x) => (
            <li key={x.key} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span>{c[x.key]}</span><strong>{x.score === null ? c.na : `${x.score}% (${x.numerator} ${c.of} ${x.denominator})`}</strong>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel" aria-labelledby="what-title">
        <div className="panel-heading"><div><h2 id="what-title">{c.whatTitle}</h2><p className="muted">{c.whatNote}</p></div></div>
        <div style={{ padding: "0 20px 16px", display: "grid", gap: 10 }}>
          {!rec ? <p className="muted">{c.none}</p> : (
            <>
              <select aria-label={c.whatTitle} value={index} onChange={(e) => { setIndex(Number(e.target.value)); setQty(null); }} style={{ border: "1px solid var(--line)", borderRadius: 4, padding: 8 }}>
                {recs.map((x, i) => <option key={x.id} value={i}>{med(x.medicineId)}: {name(x.donorId)} → {name(x.recipientId)}</option>)}
              </select>
              <label style={{ display: "grid", gap: 4 }}>{c.quantity}: <strong>{q}</strong>
                <input type="range" min={0} max={rec.quantity} value={q} onChange={(e) => setQty(Number(e.target.value))} style={{ padding: 0 }} />
              </label>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <span>{c.recipient}: <strong>{fmt(cover(rIns ? rIns.available : undefined, rIns?.dailyDemand))} → {fmt(cover(rIns ? rIns.available + q : undefined, rIns?.dailyDemand))} {c.days}</strong></span>
                <span>{c.donor}: <strong>{fmt(cover(dIns?.available, dIns?.dailyDemand))} → {fmt(cover(donorAfter, dIns?.dailyDemand))} {c.days}</strong></span>
              </div>
              <span className={donorAfter >= rec.donorSafetyStock ? "teal-text" : "red-text"}>{donorAfter >= rec.donorSafetyStock ? c.safety : c.breach}</span>
            </>
          )}
        </div>
      </section>
      <section className="panel" aria-labelledby="time-title">
        <div className="panel-heading"><div><h2 id="time-title">{c.timeTitle}</h2><p className="muted">{c.timeNote}</p></div></div>
        {!timeline.length ? <p className="muted" style={{ padding: "0 20px 16px" }}>{c.noTime}</p> : (
          <div className="table-scroll"><table><thead><tr><th>{c.timeTitle.split(" (")[0]}</th><th>{c.date}</th><th>{c.act}</th></tr></thead>
            <tbody>{timeline.map((i) => <tr key={i.inventoryId}><td>{med(i.medicineId)} · {name(i.facilityId)}</td><td>{i.shortageDate}</td><td>{addDays(i.shortageDate!, -1)}</td></tr>)}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
