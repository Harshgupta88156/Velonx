import type { Locale } from "@/lib/types";

// Feature-scoped catalogue. Typing every locale against the English keys makes
// a missing or extra translation a compile error.
const en = {
  title: "Why this forecast (SHAP)",
  note: "Exact SHAP values for the ridge model's first forecast day: baseline plus each factor's push equals the forecast. They describe the model, not clinical causes.",
  baseline: "Average daily demand (baseline)",
  forecast: "Forecast for next day",
  units: "units",
  yesterday: "Yesterday's demand",
  weekday: "Same weekday last week",
  mean: "7-day mean",
};
type Copy = Record<keyof typeof en, string>;
const hi: Copy = {
  title: "यह पूर्वानुमान क्यों (SHAP)",
  note: "रिज मॉडल के पहले पूर्वानुमान दिन के सटीक SHAP मान: आधार रेखा और हर कारक का प्रभाव जोड़कर पूर्वानुमान बनता है। ये मॉडल का वर्णन करते हैं, चिकित्सीय कारण नहीं।",
  baseline: "औसत दैनिक मांग (आधार रेखा)",
  forecast: "अगले दिन का पूर्वानुमान",
  units: "इकाइयाँ",
  yesterday: "कल की मांग",
  weekday: "पिछले सप्ताह इसी दिन",
  mean: "7-दिन औसत",
};
const mr: Copy = {
  title: "हा अंदाज का (SHAP)",
  note: "रिज मॉडेलच्या पहिल्या अंदाज दिवसाचे अचूक SHAP मूल्य: आधाररेषा आणि प्रत्येक घटकाचा प्रभाव मिळून अंदाज बनतो. हे मॉडेलचे वर्णन आहे, वैद्यकीय कारणे नाहीत.",
  baseline: "सरासरी दैनिक मागणी (आधाररेषा)",
  forecast: "पुढील दिवसाचा अंदाज",
  units: "युनिट",
  yesterday: "कालची मागणी",
  weekday: "मागील आठवड्यातील तोच वार",
  mean: "7-दिवसांची सरासरी",
};
export const shapMessages: Record<Locale, Copy> = { en, hi, mr };
