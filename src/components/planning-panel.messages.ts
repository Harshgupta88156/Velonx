import type { Locale } from "@/lib/types";

// Feature-scoped catalogue. Typing every locale against the English keys makes
// a missing or extra translation a compile error.
const en = {
  resTitle: "District resilience score",
  resNote:
    "Equal-weight average of four shares of current records. Unknown records are excluded. A prototype policy, not a staff-performance or clinical measure.",
  stock: "Medicine stock healthy",
  beds: "Facilities under 85% bed occupancy",
  staffing: "Facilities with at least 80% recorded duty cover",
  laboratory: "Lab tests operational with reagents",
  of: "of",
  na: "No data",
  tableRegion: "Scrollable table",
  whatTitle: "What-if transfer preview",
  whatNote:
    "Adjust the quantity to see stock cover before approving. This is a preview only; nothing is reserved or moved.",
  quantity: "Quantity",
  recipient: "Recipient cover",
  donor: "Donor cover",
  days: "days",
  safety: "Donor stays above safety stock",
  breach: "Donor would fall below safety stock",
  none: "No transfer recommendations right now.",
  timeTitle: "Shortage timeline (next 14 days)",
  timeNote:
    "Projected from forecast demand. Act-by date assumes one day for dispatch and transit (policy assumption).",
  date: "Projected shortage",
  act: "Act by",
  noTime: "No shortage projected within 14 days.",
};
type Copy = Record<keyof typeof en, string>;
const hi: Copy = {
  resTitle: "जिला सहनशीलता स्कोर",
  resNote:
    "वर्तमान रिकॉर्ड के चार अनुपातों का समान-भार औसत। अज्ञात रिकॉर्ड शामिल नहीं हैं। यह प्रोटोटाइप नीति है, कर्मचारी प्रदर्शन या चिकित्सीय माप नहीं।",
  stock: "दवा स्टॉक ठीक",
  beds: "85% से कम बिस्तर भराव वाली सुविधाएँ",
  staffing: "कम से कम 80% दर्ज चिकित्सक उपस्थिति वाली सुविधाएँ",
  laboratory: "अभिकर्मक सहित चालू जाँचें",
  of: "में से",
  na: "डेटा नहीं",
  tableRegion: "स्क्रॉल होने वाली तालिका",
  whatTitle: "स्थानांतरण पूर्वावलोकन (क्या होगा यदि)",
  whatNote:
    "स्वीकृति से पहले मात्रा बदलकर स्टॉक कवर देखें। यह केवल पूर्वावलोकन है; कुछ आरक्षित या स्थानांतरित नहीं होता।",
  quantity: "मात्रा",
  recipient: "प्राप्तकर्ता कवर",
  donor: "दाता कवर",
  days: "दिन",
  safety: "दाता सुरक्षा स्टॉक से ऊपर रहेगा",
  breach: "दाता सुरक्षा स्टॉक से नीचे जाएगा",
  none: "अभी कोई स्थानांतरण अनुशंसा नहीं।",
  timeTitle: "कमी की समयरेखा (अगले 14 दिन)",
  timeNote:
    "पूर्वानुमानित मांग पर आधारित। कार्रवाई की तिथि में प्रेषण और परिवहन के लिए एक दिन माना गया है (नीतिगत धारणा)।",
  date: "अनुमानित कमी",
  act: "कार्रवाई की तिथि",
  noTime: "14 दिनों में कोई कमी अनुमानित नहीं।",
};
const mr: Copy = {
  resTitle: "जिल्हा सक्षमता गुण",
  resNote:
    "सध्याच्या नोंदींच्या चार प्रमाणांची समान-भार सरासरी. अज्ञात नोंदी वगळल्या आहेत. हे प्रोटोटाइप धोरण आहे, कर्मचारी कामगिरी किंवा वैद्यकीय मापन नाही.",
  stock: "औषध साठा समाधानकारक",
  beds: "85% पेक्षा कमी खाट वापर असलेल्या सुविधा",
  staffing: "किमान 80% नोंदवलेली डॉक्टर उपस्थिती असलेल्या सुविधा",
  laboratory: "अभिकर्मकासह चालू चाचण्या",
  of: "पैकी",
  na: "डेटा नाही",
  tableRegion: "स्क्रोल करता येणारी तालिका",
  whatTitle: "हस्तांतरण पूर्वावलोकन (जर असे झाले तर)",
  whatNote:
    "मंजुरीपूर्वी प्रमाण बदलून साठा कव्हर पहा. हे फक्त पूर्वावलोकन आहे; काहीही राखीव किंवा हलवले जात नाही.",
  quantity: "प्रमाण",
  recipient: "प्राप्तकर्ता कव्हर",
  donor: "दाता कव्हर",
  days: "दिवस",
  safety: "दाता सुरक्षा साठ्याच्या वर राहील",
  breach: "दाता सुरक्षा साठ्याच्या खाली जाईल",
  none: "सध्या हस्तांतरण शिफारस नाही.",
  timeTitle: "कमतरता वेळापत्रक (पुढील 14 दिवस)",
  timeNote:
    "अंदाजित मागणीवर आधारित. कृतीची तारीख पाठवणी आणि वाहतुकीसाठी एक दिवस गृहीत धरते (धोरणात्मक गृहीतक).",
  date: "अंदाजित कमतरता",
  act: "कृती करण्याची तारीख",
  noTime: "14 दिवसांत कमतरता अपेक्षित नाही.",
};
export const planningMessages: Record<Locale, Copy> = { en, hi, mr };
