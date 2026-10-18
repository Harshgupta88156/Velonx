import type { Attribution, Locale } from "@/lib/types";

const copy = {
  en: { title: "Why this forecast (SHAP)", note: "Exact SHAP values for the ridge model's first forecast day: baseline plus each factor's push equals the forecast. They describe the model, not clinical causes.", baseline: "Average daily demand (baseline)", forecast: "Forecast for next day", units: "units", yesterday: "Yesterday's demand", weekday: "Same weekday last week", mean: "7-day mean" },
  hi: { title: "यह पूर्वानुमान क्यों (SHAP)", note: "रिज मॉडल के पहले पूर्वानुमान दिन के सटीक SHAP मान: आधार रेखा और हर कारक का प्रभाव जोड़कर पूर्वानुमान बनता है। ये मॉडल का वर्णन करते हैं, चिकित्सीय कारण नहीं।", baseline: "औसत दैनिक मांग (आधार रेखा)", forecast: "अगले दिन का पूर्वानुमान", units: "इकाइयाँ", yesterday: "कल की मांग", weekday: "पिछले सप्ताह इसी दिन", mean: "7-दिन औसत" },
  mr: { title: "हा अंदाज का (SHAP)", note: "रिज मॉडेलच्या पहिल्या अंदाज दिवसाचे अचूक SHAP मूल्य: आधाररेषा आणि प्रत्येक घटकाचा प्रभाव मिळून अंदाज बनतो. हे मॉडेलचे वर्णन आहे, वैद्यकीय कारणे नाहीत.", baseline: "सरासरी दैनिक मागणी (आधाररेषा)", forecast: "पुढील दिवसाचा अंदाज", units: "युनिट", yesterday: "कालची मागणी", weekday: "मागील आठवड्यातील तोच वार", mean: "7-दिवसांची सरासरी" },
} as const;
const labelKey = { lastDay: "yesterday", sameWeekdayLastWeek: "weekday", weekMean: "mean" } as const;

export default function ShapPanel({ attribution, locale }: { attribution: Attribution; locale: Locale }) {
  const c = copy[locale];
  const max = Math.max(...attribution.contributions.map((x) => Math.abs(x.shap)), 0.0001);
  const f = (n: number) => (Math.round(n * 10) / 10).toLocaleString(locale);
  return (
    <div className="shap-panel" style={{ marginTop: 16 }}>
      <h4 style={{ margin: "0 0 4px" }}>{c.title}</h4>
      <p className="muted" style={{ fontSize: 12, margin: "0 0 10px" }}>{c.note}</p>
      <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>{c.baseline}</span><strong>{f(attribution.baseline)} {c.units}</strong></div>
        {attribution.contributions.map((x) => (
          <div key={x.feature} style={{ display: "grid", gridTemplateColumns: "minmax(120px,1fr) 2fr 64px", gap: 8, alignItems: "center" }}>
            <span>{c[labelKey[x.feature]]} ({f(x.input)})</span>
            <span aria-hidden style={{ position: "relative", height: 10, background: "#eef1f5", borderRadius: 2 }}>
              <span style={{ position: "absolute", top: 0, bottom: 0, left: x.shap >= 0 ? "50%" : `${50 - (Math.abs(x.shap) / max) * 50}%`, width: `${(Math.abs(x.shap) / max) * 50}%`, background: x.shap >= 0 ? "#25624b" : "#af3434", borderRadius: 2 }} />
            </span>
            <strong style={{ textAlign: "right" }}>{x.shap >= 0 ? "+" : ""}{f(x.shap)}</strong>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--line)", paddingTop: 6 }}><span>{c.forecast}</span><strong>{f(attribution.prediction)} {c.units}</strong></div>
      </div>
    </div>
  );
}
