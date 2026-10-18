import type { Locale } from "@/lib/types";

// Feature-scoped catalogue. Typing every locale against the English keys makes
// a missing or extra translation a compile error.
const en = {
  title: "Facility interventions",
  help: "Administrator acknowledgement and follow-up for facilities flagged critical or on watch. Risk reflects resource scarcity and reporting gaps, not staff performance.",
  none: "No facility currently needs intervention.",
  open: "Open",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  resolved: "Resolved",
  note: "Action note (min 5 characters)",
  save: "Save",
  adminOnly: "Only the district administrator can record interventions.",
  critical: "Critical",
  watch: "Watch",
};
type Copy = Record<keyof typeof en, string>;
const hi: Copy = {
  title: "सुविधा हस्तक्षेप",
  help: "गंभीर या निगरानी वाली सुविधाओं के लिए प्रशासक की स्वीकृति और अनुवर्ती कार्रवाई। जोखिम संसाधन की कमी और रिपोर्टिंग अंतराल दर्शाता है, कर्मचारियों का प्रदर्शन नहीं।",
  none: "अभी किसी सुविधा को हस्तक्षेप की आवश्यकता नहीं है।",
  open: "खुला",
  acknowledged: "स्वीकृत",
  in_progress: "प्रगति में",
  resolved: "समाधान हुआ",
  note: "कार्रवाई नोट (कम से कम 5 अक्षर)",
  save: "सहेजें",
  adminOnly: "केवल जिला प्रशासक हस्तक्षेप दर्ज कर सकते हैं।",
  critical: "गंभीर",
  watch: "निगरानी",
};
const mr: Copy = {
  title: "सुविधा हस्तक्षेप",
  help: "गंभीर किंवा निरीक्षणातील सुविधांसाठी प्रशासकाची पोचपावती आणि पाठपुरावा. जोखीम संसाधनांची कमतरता आणि अहवालातील तफावत दर्शवते, कर्मचाऱ्यांची कामगिरी नाही.",
  none: "सध्या कोणत्याही सुविधेला हस्तक्षेपाची गरज नाही.",
  open: "खुले",
  acknowledged: "पोचपावती दिली",
  in_progress: "प्रगतीत",
  resolved: "निराकरण झाले",
  note: "कृती टीप (किमान ५ अक्षरे)",
  save: "जतन करा",
  adminOnly: "फक्त जिल्हा प्रशासक हस्तक्षेप नोंदवू शकतात.",
  critical: "गंभीर",
  watch: "निरीक्षण",
};
export const interventionMessages: Record<Locale, Copy> = { en, hi, mr };
