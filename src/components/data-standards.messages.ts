const en = {
  monitor: "Source quality",
  definitions: "Metric definitions",
  exchange: "Systems & exchange",
  assessed: "Scenario analysis date",
  revision: "Snapshot revision",
  source: "Source: synthetic operational records",
  eligible: "Forecast-eligible series",
  stale: "Stale source records",
  missingAttendance: "Missing duty records",
  anomalies: "Observation exceptions",
  eligibleHelp:
    "At least 21 consecutive daily observations; latest date is the analysis date or preceding day.",
  staleHelp:
    "Facility and diagnostic records more than 48 hours old at the scenario analysis date.",
  attendanceHelp:
    "Missing attendance is a documentation gap. It does not establish absence.",
  anomalyHelp:
    "Invalid values, duplicate dates, future observations and missing internal days. Categories can overlap.",
  issueTitle: "Records requiring review",
  issueHelp:
    "Quality findings preserve original records. No automatic imputation or deletion is performed.",
  facility: "Facility",
  domain: "Domain",
  finding: "Finding",
  count: "Count",
  review: "Review facility",
  actions: "Actions",
  tableRegion: "Scrollable table",
  noIssues: "No quality findings in the selected scope.",
  noSeries: "No history series in the selected scope.",
  coverageTitle: "History coverage",
  coverageHelp:
    "An observation is one daily aggregate, not an individual patient record. Gaps are not counted as zero activity.",
  series: "Series",
  observations: "Recorded",
  usable: "Usable dates",
  contiguous: "Consecutive days",
  gaps: "Missing days",
  latest: "Latest observation",
  status: "Forecast status",
  eligibleStatus: "Eligible",
  insufficient: "Insufficient / stale",
  inventory: "Pharmacy",
  attendance: "Duty roster",
  diagnostics: "Laboratory",
  opd: "OPD",
  facilityDomain: "Facility record",
  issueInvalid: "Invalid date or non-finite / negative demand",
  issueDuplicate: "Repeated calendar date",
  issueFuture: "Observation after analysis date",
  issueGap: "Missing internal calendar day",
  issueCoverage: "Fewer than 21 consecutive days",
  issueHistoryStale: "History does not include a recent observation",
  issueAttendance: "Attendance not recorded",
  issueUnknown: "Diagnostic status unknown",
  issueDiagnosticMissing: "Diagnostic records unavailable",
  issueClinicalStale: "Source update more than 48 hours old",
  issueTimestamp: "Invalid source timestamp",
  issueTimestampFuture: "Source timestamp after scenario analysis date",
  issueInventoryMissing: "Facility-medicine record missing",
  issueCatalogue: "Medicine catalogue reference missing",
  issueFacility: "Referenced facility missing",
  metricTitle: "Operational measures and their boundaries",
  metricHelp:
    "Each measure states its numerator, denominator and reporting period. Clinical quality indicators require additional source data.",
  opdTerm: "OPD · Outpatient department",
  opdDefinition:
    "Today’s modeled outpatient visit count. One person can attend more than once; this is not a count of unique patients or an EHR encounter ledger.",
  bedTerm: "Bed occupancy · current snapshot",
  bedDefinition:
    "Occupied operational beds ÷ operational beds × 100 at the recorded update. Zero operational beds means no ratio. A period bed-occupancy rate requires occupied and available bed-days.",
  stockTerm: "Days of stock and FEFO",
  stockDefinition:
    "Usable stock excludes expired and reserved units. Coverage divides usable units by mean forecast daily consumption. FEFO means first-expiry, first-out; full lot-level FEFO is not implemented by this aggregate stock model.",
  staffingTerm: "Clinical duty coverage",
  staffingDefinition:
    "Recorded doctors present compared with scheduled doctors, shown alongside OPD demand. Missing records remain unknown. This is not a credentialing or staff-performance measure.",
  hmisTerm: "HIS / HMIS · Hospital information systems",
  hmisDefinition:
    "Systems supporting clinical, administrative and operational workflows. DistrictCare currently provides the district operations layer and does not replace a complete hospital system.",
  ehrTerm: "EHR / EMR · Electronic health / medical records",
  ehrDefinition:
    "Patient-level longitudinal or organization-specific clinical records. DistrictCare does not store clinical patient records, diagnoses or ABHA identities; its current operational dataset is not an EHR.",
  adtTerm: "IPD / ADT · Inpatient administration",
  adtDefinition:
    "IPD refers to inpatient services; ADT means patient admission, discharge and transfer. Medicine redistribution is a stock transfer, not an ADT event. Average length of stay is unavailable without admission/discharge records.",
  lisTerm: "LIS / RIS / PACS · Diagnostic systems",
  lisDefinition:
    "Laboratory information, radiology information, and picture archiving/communication systems manage results and imaging workflows. Our laboratory screen audits service readiness; it does not process laboratory results or images.",
  haiTerm: "HAI / IPC · Infection surveillance",
  haiDefinition:
    "Healthcare-associated infections and infection prevention/control. No infection cases, patient-days or device-days are recorded here. An HAI rate cannot be inferred from bed occupancy or laboratory downtime.",
  codingTerm: "Clinical terminology and coding",
  codingDefinition:
    "SNOMED CT represents clinical concepts, LOINC identifies observations/tests, and ICD supports disease classification. The local medicine/test names have not been mapped or validated against these systems.",
  interchangeTerm: "FHIR / ABDM · Health information exchange",
  interchangeDefinition:
    "FHIR represents health information using defined resources. ABDM exchange adds India-specific profiles and consent workflows. A facility directory export alone does not establish ABDM integration or conformance.",
  exportsTitle: "Available exchange output",
  exportsHelp:
    "The export contains synthetic facility Organization and Location resources only. There are no patient records, clinical results or real registry identifiers.",
  exportDistrict: "Download district directory · FHIR R4",
  exportFacility: "Download selected facility · FHIR R4",
  exportQuality: "Download quality findings · CSV",
  exportBoundary:
    "Base FHIR R4 resource mapping with structural tests; no official profile validation, patient exchange, live hospital connection or ABDM certification is claimed.",
  integrationTitle: "Source integration boundaries",
  available: "Implemented locally",
  planned: "Not connected",
  availableDetail:
    "Operational records, versioned stock updates, audited approvals and source-quality profiling.",
  ehrConnection: "EHR / HMIS clinical feed",
  ehrConnectionDetail:
    "Requires authenticated source access, facility identity mapping, validated profiles, consent where applicable and auditable ingestion.",
  diagnosticConnection: "LIS / RIS / PACS feed",
  diagnosticConnectionDetail:
    "Requires verified service/test identifiers and vendor interface contracts. No result or image feed is configured.",
  infectionConnection: "HAI / IPC surveillance feed",
  infectionConnectionDetail:
    "Requires approved case definitions, exposure denominators and infection-control review. No rate is calculated.",
  standardsLink: "ABDM published implementation guide",
  sourceLink: "HL7 FHIR R4 resource specification",
  qualityNote:
    "Quality is assessed against the frozen scenario date, not the live wall clock. Refreshing retrieves operational edits; it does not connect to a hospital.",
  glossarySearch: "Find a term or metric",
  noTerms: "No definitions match your search.",
  none: "Not recorded",
};
type Copy = { [K in keyof typeof en]: string };
const hi: Copy = {
  monitor: "स्रोत गुणवत्ता",
  definitions: "मापों की परिभाषाएँ",
  exchange: "प्रणालियाँ और आदान-प्रदान",
  assessed: "परिदृश्य विश्लेषण तिथि",
  revision: "स्नैपशॉट संस्करण",
  source: "स्रोत: कृत्रिम संचालन रिकॉर्ड",
  eligible: "पूर्वानुमान योग्य शृंखलाएँ",
  stale: "पुराने स्रोत रिकॉर्ड",
  missingAttendance: "अपूर्ण ड्यूटी रिकॉर्ड",
  anomalies: "अवलोकन अपवाद",
  eligibleHelp:
    "कम से कम 21 लगातार दैनिक अवलोकन; अंतिम तिथि विश्लेषण का दिन या पिछला दिन हो।",
  staleHelp:
    "परिदृश्य विश्लेषण तिथि पर 48 घंटे से पुराने केंद्र और जाँच रिकॉर्ड।",
  attendanceHelp:
    "अनुपस्थित उपस्थिति रिकॉर्ड दस्तावेज़ी कमी है, अनुपस्थिति का प्रमाण नहीं।",
  anomalyHelp:
    "अमान्य मान, दोहराई गई तिथियाँ, भविष्य के अवलोकन और बीच के छूटे दिन। श्रेणियाँ एक-दूसरे से मिल सकती हैं।",
  issueTitle: "समीक्षा योग्य रिकॉर्ड",
  issueHelp:
    "मूल रिकॉर्ड सुरक्षित रहते हैं। स्वतः मान भरना या हटाना नहीं किया जाता।",
  facility: "केंद्र",
  domain: "क्षेत्र",
  finding: "निष्कर्ष",
  count: "संख्या",
  review: "केंद्र की समीक्षा",
  actions: "कार्रवाई",
  tableRegion: "स्क्रॉल होने वाली तालिका",
  noIssues: "चुने गए क्षेत्र में गुणवत्ता निष्कर्ष नहीं हैं।",
  noSeries: "चुने गए क्षेत्र में इतिहास शृंखला नहीं है।",
  coverageTitle: "इतिहास कवरेज",
  coverageHelp:
    "एक अवलोकन दैनिक कुल है, किसी मरीज का रिकॉर्ड नहीं। छूटे दिन शून्य गतिविधि नहीं माने जाते।",
  series: "शृंखला",
  observations: "दर्ज",
  usable: "उपयोगी तिथियाँ",
  contiguous: "लगातार दिन",
  gaps: "छूटे दिन",
  latest: "अंतिम अवलोकन",
  status: "पूर्वानुमान स्थिति",
  eligibleStatus: "योग्य",
  insufficient: "अपर्याप्त / पुराना",
  inventory: "दवा भंडार",
  attendance: "ड्यूटी सूची",
  diagnostics: "प्रयोगशाला",
  opd: "ओपीडी",
  facilityDomain: "केंद्र रिकॉर्ड",
  issueInvalid: "अमान्य तिथि या गैर-सीमित / ऋणात्मक माँग",
  issueDuplicate: "दोहराई गई कैलेंडर तिथि",
  issueFuture: "विश्लेषण तिथि के बाद का अवलोकन",
  issueGap: "बीच का कैलेंडर दिन छूटा",
  issueCoverage: "21 से कम लगातार दिन",
  issueHistoryStale: "इतिहास में हाल का अवलोकन नहीं",
  issueAttendance: "उपस्थिति दर्ज नहीं",
  issueUnknown: "जाँच स्थिति अज्ञात",
  issueDiagnosticMissing: "जाँच रिकॉर्ड अनुपलब्ध",
  issueClinicalStale: "स्रोत अपडेट 48 घंटे से पुराना",
  issueTimestamp: "अमान्य स्रोत समय",
  issueTimestampFuture: "स्रोत समय परिदृश्य तिथि के बाद",
  issueInventoryMissing: "केंद्र-दवा रिकॉर्ड नहीं",
  issueCatalogue: "दवा सूची संदर्भ नहीं",
  issueFacility: "संदर्भित केंद्र नहीं",
  metricTitle: "संचालन माप और उनकी सीमाएँ",
  metricHelp:
    "हर माप का अंश, हर और रिपोर्ट अवधि स्पष्ट है। नैदानिक गुणवत्ता सूचकों के लिए अतिरिक्त स्रोत डेटा चाहिए।",
  opdTerm: "OPD · बाह्य रोगी विभाग",
  opdDefinition:
    "आज की कृत्रिम बाह्य रोगी विज़िट संख्या। एक व्यक्ति कई बार आ सकता है; यह अलग-अलग मरीजों की गिनती या EHR विज़िट रिकॉर्ड नहीं है।",
  bedTerm: "बिस्तर अधिभोग · वर्तमान स्नैपशॉट",
  bedDefinition:
    "दर्ज समय पर भरे संचालन योग्य बिस्तर ÷ कुल संचालन योग्य बिस्तर × 100। शून्य बिस्तरों पर अनुपात नहीं बनता। अवधि दर के लिए भरे और उपलब्ध बिस्तर-दिन चाहिए।",
  stockTerm: "भंडार के दिन और FEFO",
  stockDefinition:
    "उपयोग योग्य भंडार में समाप्त और आरक्षित इकाइयाँ नहीं गिनी जातीं। अवधि = उपयोग योग्य इकाइयाँ ÷ अनुमानित औसत दैनिक खपत। FEFO पहले समाप्त होने वाला स्टॉक पहले उपयोग करना है; इस कुल मॉडल में पूरा बैच लेखा नहीं है।",
  staffingTerm: "नैदानिक ड्यूटी कवरेज",
  staffingDefinition:
    "दर्ज उपस्थित डॉक्टरों की नियोजित डॉक्टरों से तुलना, OPD माँग के साथ। छूटे रिकॉर्ड अज्ञात रहते हैं। यह योग्यता या कर्मचारी प्रदर्शन का माप नहीं है।",
  hmisTerm: "HIS / HMIS · अस्पताल सूचना प्रणाली",
  hmisDefinition:
    "नैदानिक, प्रशासनिक और संचालन कार्यों में सहायक प्रणालियाँ। DistrictCare अभी जिला संचालन परत देता है; यह संपूर्ण अस्पताल प्रणाली का स्थान नहीं लेता।",
  ehrTerm: "EHR / EMR · इलेक्ट्रॉनिक स्वास्थ्य / चिकित्सा रिकॉर्ड",
  ehrDefinition:
    "मरीज के दीर्घकालिक या संस्था-विशिष्ट नैदानिक रिकॉर्ड। DistrictCare में नैदानिक मरीज रिकॉर्ड, निदान या ABHA पहचान नहीं रखी जाती; वर्तमान संचालन डेटा EHR नहीं है।",
  adtTerm: "IPD / ADT · भर्ती रोगी प्रशासन",
  adtDefinition:
    "IPD भर्ती सेवाएँ हैं; ADT मरीज का प्रवेश, छुट्टी और स्थानांतरण है। दवा पुनर्वितरण भंडार स्थानांतरण है, ADT नहीं। प्रवेश/छुट्टी रिकॉर्ड बिना औसत भर्ती अवधि उपलब्ध नहीं है।",
  lisTerm: "LIS / RIS / PACS · जाँच प्रणालियाँ",
  lisDefinition:
    "प्रयोगशाला सूचना, रेडियोलॉजी सूचना और इमेज संग्रह/संचार प्रणालियाँ परिणाम तथा चित्र संभालती हैं। हमारी स्क्रीन सेवा तैयारी की जाँच करती है, जाँच परिणाम या चित्र नहीं।",
  haiTerm: "HAI / IPC · संक्रमण निगरानी",
  haiDefinition:
    "स्वास्थ्य सेवा-संबंधित संक्रमण और संक्रमण रोकथाम/नियंत्रण। यहाँ संक्रमण मामले, मरीज-दिन या उपकरण-दिन दर्ज नहीं हैं। बिस्तर अधिभोग या प्रयोगशाला बंद होने से HAI दर नहीं निकल सकती।",
  codingTerm: "नैदानिक शब्दावली और कोडिंग",
  codingDefinition:
    "SNOMED CT नैदानिक अवधारणाएँ, LOINC अवलोकन/जाँच और ICD रोग वर्गीकरण दर्शाते हैं। स्थानीय दवा/जाँच नामों की इन प्रणालियों से मैपिंग या सत्यापन नहीं हुआ है।",
  interchangeTerm: "FHIR / ABDM · स्वास्थ्य सूचना आदान-प्रदान",
  interchangeDefinition:
    "FHIR निश्चित संसाधनों में स्वास्थ्य सूचना दर्शाता है। ABDM भारतीय प्रोफाइल और सहमति प्रक्रिया जोड़ता है। केवल केंद्र निर्देशिका निर्यात से ABDM एकीकरण या अनुरूपता सिद्ध नहीं होती।",
  exportsTitle: "उपलब्ध आदान-प्रदान आउटपुट",
  exportsHelp:
    "निर्यात में केवल कृत्रिम केंद्र Organization और Location संसाधन हैं। मरीज रिकॉर्ड, नैदानिक परिणाम या वास्तविक रजिस्ट्री पहचान नहीं हैं।",
  exportDistrict: "जिला निर्देशिका डाउनलोड · FHIR R4",
  exportFacility: "चुना केंद्र डाउनलोड · FHIR R4",
  exportQuality: "गुणवत्ता निष्कर्ष डाउनलोड · CSV",
  exportBoundary:
    "मूल FHIR R4 मैपिंग के संरचनात्मक परीक्षण हैं; आधिकारिक प्रोफाइल सत्यापन, मरीज डेटा आदान-प्रदान, लाइव अस्पताल कनेक्शन या ABDM प्रमाणन का दावा नहीं।",
  integrationTitle: "स्रोत एकीकरण की सीमाएँ",
  available: "स्थानीय रूप से लागू",
  planned: "जुड़ा नहीं है",
  availableDetail:
    "संचालन रिकॉर्ड, संस्करणयुक्त भंडार अपडेट, लेखापरीक्षित स्वीकृति और स्रोत गुणवत्ता विश्लेषण।",
  ehrConnection: "EHR / HMIS नैदानिक फीड",
  ehrConnectionDetail:
    "प्रमाणित स्रोत पहुँच, केंद्र पहचान मैपिंग, सत्यापित प्रोफाइल, लागू सहमति और लेखापरीक्षित डेटा प्रवेश चाहिए।",
  diagnosticConnection: "LIS / RIS / PACS फीड",
  diagnosticConnectionDetail:
    "सत्यापित सेवा/जाँच पहचान और विक्रेता इंटरफेस अनुबंध चाहिए। परिणाम या चित्र फीड जुड़ी नहीं है।",
  infectionConnection: "HAI / IPC निगरानी फीड",
  infectionConnectionDetail:
    "स्वीकृत केस परिभाषाएँ, जोखिम अवधि के हर और संक्रमण नियंत्रण समीक्षा चाहिए। कोई दर नहीं निकाली जाती।",
  standardsLink: "ABDM प्रकाशित कार्यान्वयन मार्गदर्शिका",
  sourceLink: "HL7 FHIR R4 संसाधन विवरण",
  qualityNote:
    "गुणवत्ता स्थिर परिदृश्य तिथि के अनुसार है, वर्तमान घड़ी के अनुसार नहीं। ताज़ा करने पर संचालन बदलाव मिलते हैं, अस्पताल से कनेक्शन नहीं बनता।",
  glossarySearch: "शब्द या माप खोजें",
  noTerms: "आपकी खोज से कोई परिभाषा नहीं मिली।",
  none: "दर्ज नहीं",
};
const mr: Copy = {
  monitor: "स्रोत गुणवत्ता",
  definitions: "मापांच्या व्याख्या",
  exchange: "प्रणाली व देवाणघेवाण",
  assessed: "परिस्थिती विश्लेषण दिनांक",
  revision: "स्नॅपशॉट आवृत्ती",
  source: "स्रोत: कृत्रिम कार्यकारी नोंदी",
  eligible: "अंदाजासाठी पात्र मालिका",
  stale: "जुन्या स्रोत नोंदी",
  missingAttendance: "अपूर्ण ड्यूटी नोंदी",
  anomalies: "अवलोकन अपवाद",
  eligibleHelp:
    "किमान 21 सलग दैनिक नोंदी; शेवटची तारीख विश्लेषणाचा दिवस किंवा आदला दिवस असावा.",
  staleHelp:
    "परिस्थिती विश्लेषण दिवशी 48 तासांपेक्षा जुन्या केंद्र व तपासणी नोंदी.",
  attendanceHelp:
    "उपस्थिती नोंद नसणे ही दस्तऐवजीकरणातील त्रुटी आहे, गैरहजेरीचा पुरावा नाही.",
  anomalyHelp:
    "अवैध मूल्ये, पुनरावृत्त तारखा, भविष्यातील नोंदी व मधले सुटलेले दिवस. वर्ग एकमेकांवर येऊ शकतात.",
  issueTitle: "पुनरावलोकन आवश्यक नोंदी",
  issueHelp: "मूळ नोंदी जतन होतात. आपोआप मूल्य भरणे किंवा हटवणे केले जात नाही.",
  facility: "केंद्र",
  domain: "विभाग",
  finding: "निष्कर्ष",
  count: "संख्या",
  review: "केंद्र पाहा",
  actions: "कृती",
  tableRegion: "स्क्रोल करता येणारी तालिका",
  noIssues: "निवडलेल्या व्याप्तीत गुणवत्ता निष्कर्ष नाहीत.",
  noSeries: "निवडलेल्या व्याप्तीत इतिहास मालिका नाहीत.",
  coverageTitle: "इतिहास व्याप्ती",
  coverageHelp:
    "एक अवलोकन हे दैनिक एकूण आहे, वैयक्तिक रुग्ण नोंद नाही. सुटलेले दिवस शून्य कामकाज मानले जात नाहीत.",
  series: "मालिका",
  observations: "नोंदवलेले",
  usable: "वापरण्यायोग्य दिनांक",
  contiguous: "सलग दिवस",
  gaps: "सुटलेले दिवस",
  latest: "शेवटची नोंद",
  status: "अंदाज स्थिती",
  eligibleStatus: "पात्र",
  insufficient: "अपुरे / जुने",
  inventory: "औषध साठा",
  attendance: "ड्यूटी सूची",
  diagnostics: "प्रयोगशाळा",
  opd: "बाह्यरुग्ण",
  facilityDomain: "केंद्र नोंद",
  issueInvalid: "अवैध दिनांक किंवा अमर्याद / ऋण मागणी",
  issueDuplicate: "पुनरावृत्त दिनांक",
  issueFuture: "विश्लेषण दिनांकानंतरची नोंद",
  issueGap: "मधला दिवस सुटला",
  issueCoverage: "21 पेक्षा कमी सलग दिवस",
  issueHistoryStale: "इतिहासात अलीकडील नोंद नाही",
  issueAttendance: "उपस्थिती नोंदवलेली नाही",
  issueUnknown: "तपासणी स्थिती अज्ञात",
  issueDiagnosticMissing: "तपासणी नोंदी अनुपलब्ध",
  issueClinicalStale: "स्रोत अद्यतन 48 तासांपेक्षा जुने",
  issueTimestamp: "अवैध स्रोत वेळ",
  issueTimestampFuture: "परिस्थिती दिनांकानंतरची स्रोत वेळ",
  issueInventoryMissing: "केंद्र-औषध नोंद नाही",
  issueCatalogue: "औषध सूची संदर्भ नाही",
  issueFacility: "संदर्भित केंद्र नाही",
  metricTitle: "कार्यकारी मापे आणि मर्यादा",
  metricHelp:
    "प्रत्येक मापाचा अंश, छेद व अहवाल कालावधी स्पष्ट आहे. नैदानिक गुणवत्ता निर्देशकांसाठी अतिरिक्त स्रोत माहिती आवश्यक आहे.",
  opdTerm: "OPD · बाह्यरुग्ण विभाग",
  opdDefinition:
    "आजच्या कृत्रिम बाह्यरुग्ण भेटींची संख्या. एक व्यक्ती अनेकदा येऊ शकते; ही स्वतंत्र रुग्णांची संख्या किंवा EHR भेट नोंद नाही.",
  bedTerm: "खाट व्यापन · वर्तमान स्नॅपशॉट",
  bedDefinition:
    "नोंदवलेल्या वेळी व्यापलेल्या कार्यरत खाटा ÷ एकूण कार्यरत खाटा × 100. शून्य खाटांवर गुणोत्तर नाही. कालावधी दरासाठी व्यापलेले आणि उपलब्ध खाट-दिवस आवश्यक आहेत.",
  stockTerm: "साठ्याचे दिवस आणि FEFO",
  stockDefinition:
    "वापरण्यायोग्य साठ्यात कालबाह्य व राखीव एकके नसतात. कालावधी = वापरण्यायोग्य एकके ÷ अंदाजित सरासरी दैनिक वापर. FEFO म्हणजे प्रथम कालबाह्य होणारा साठा प्रथम वापरणे; येथे पूर्ण बॅच लेखा लागू नाही.",
  staffingTerm: "नैदानिक ड्यूटी व्याप्ती",
  staffingDefinition:
    "OPD मागणीसह नोंदवलेले उपस्थित डॉक्टर आणि नियोजित डॉक्टर यांची तुलना. अनुपलब्ध नोंदी अज्ञात राहतात. हे पात्रता किंवा कर्मचाऱ्यांच्या कामगिरीचे माप नाही.",
  hmisTerm: "HIS / HMIS · रुग्णालय माहिती प्रणाली",
  hmisDefinition:
    "नैदानिक, प्रशासकीय व कार्यकारी कामकाजासाठी प्रणाली. DistrictCare सध्या जिल्हा कार्यकारी स्तर पुरवते; संपूर्ण रुग्णालय प्रणालीची जागा घेत नाही.",
  ehrTerm: "EHR / EMR · इलेक्ट्रॉनिक आरोग्य / वैद्यकीय नोंदी",
  ehrDefinition:
    "रुग्णाच्या दीर्घकालीन किंवा संस्थेतील नैदानिक नोंदी. DistrictCare मध्ये रुग्ण नोंदी, निदान किंवा ABHA ओळख ठेवली जात नाही; सध्याची कार्यकारी माहिती EHR नाही.",
  adtTerm: "IPD / ADT · आंतररुग्ण प्रशासन",
  adtDefinition:
    "IPD म्हणजे आंतररुग्ण सेवा; ADT म्हणजे रुग्ण प्रवेश, रजा व स्थानांतरण. औषध पुनर्वितरण हे साठा हस्तांतरण आहे, ADT घटना नाही. प्रवेश/रजा नोंदींशिवाय सरासरी मुक्काम उपलब्ध नाही.",
  lisTerm: "LIS / RIS / PACS · तपासणी प्रणाली",
  lisDefinition:
    "प्रयोगशाळा माहिती, रेडिओलॉजी माहिती व प्रतिमा संग्रह/संचार प्रणाली परिणाम व प्रतिमा हाताळतात. आमची स्क्रीन सेवा तयारी तपासते; परिणाम किंवा प्रतिमा प्रक्रिया करत नाही.",
  haiTerm: "HAI / IPC · संसर्ग देखरेख",
  haiDefinition:
    "आरोग्यसेवेशी संबंधित संसर्ग आणि संसर्ग प्रतिबंध/नियंत्रण. येथे संसर्ग रुग्ण, रुग्ण-दिवस किंवा उपकरण-दिवस नाहीत. खाट व्यापन किंवा प्रयोगशाळा बंद असण्यावरून HAI दर ठरत नाही.",
  codingTerm: "नैदानिक शब्दावली व कोडिंग",
  codingDefinition:
    "SNOMED CT नैदानिक संकल्पना, LOINC अवलोकने/चाचण्या आणि ICD रोग वर्गीकरण दर्शवते. स्थानिक औषध/चाचणी नावांची या प्रणालींशी मॅपिंग किंवा पडताळणी झालेली नाही.",
  interchangeTerm: "FHIR / ABDM · आरोग्य माहिती देवाणघेवाण",
  interchangeDefinition:
    "FHIR निश्चित संसाधनांत आरोग्य माहिती दर्शवते. ABDM भारतीय प्रोफाइल व संमती प्रक्रिया जोडते. फक्त केंद्र निर्देशिका निर्यात केल्याने ABDM एकीकरण किंवा अनुरूपता सिद्ध होत नाही.",
  exportsTitle: "उपलब्ध देवाणघेवाण आउटपुट",
  exportsHelp:
    "निर्यातीत फक्त कृत्रिम केंद्र Organization व Location संसाधने आहेत. रुग्ण नोंदी, नैदानिक परिणाम किंवा वास्तविक नोंदणी ओळख नाही.",
  exportDistrict: "जिल्हा निर्देशिका डाउनलोड · FHIR R4",
  exportFacility: "निवडलेले केंद्र डाउनलोड · FHIR R4",
  exportQuality: "गुणवत्ता निष्कर्ष डाउनलोड · CSV",
  exportBoundary:
    "मूळ FHIR R4 मॅपिंगच्या संरचनात्मक चाचण्या आहेत; अधिकृत प्रोफाइल पडताळणी, रुग्ण देवाणघेवाण, थेट रुग्णालय जोडणी किंवा ABDM प्रमाणनाचा दावा नाही.",
  integrationTitle: "स्रोत एकीकरणाच्या मर्यादा",
  available: "स्थानिक पातळीवर लागू",
  planned: "जोडलेले नाही",
  availableDetail:
    "कार्यकारी नोंदी, आवृत्तीसह साठा अद्यतने, लेखापरीक्षित मान्यता आणि स्रोत गुणवत्ता विश्लेषण.",
  ehrConnection: "EHR / HMIS नैदानिक फीड",
  ehrConnectionDetail:
    "प्रमाणित स्रोत प्रवेश, केंद्र ओळख मॅपिंग, पडताळलेले प्रोफाइल, लागू संमती आणि लेखापरीक्षित माहिती प्रवेश आवश्यक.",
  diagnosticConnection: "LIS / RIS / PACS फीड",
  diagnosticConnectionDetail:
    "पडताळलेली सेवा/चाचणी ओळख व विक्रेता इंटरफेस करार आवश्यक. परिणाम किंवा प्रतिमा फीड जोडलेली नाही.",
  infectionConnection: "HAI / IPC देखरेख फीड",
  infectionConnectionDetail:
    "मान्य केस व्याख्या, जोखीम कालावधीचे छेद व संसर्ग नियंत्रण पुनरावलोकन आवश्यक. कोणताही दर मोजलेला नाही.",
  standardsLink: "ABDM प्रकाशित अंमलबजावणी मार्गदर्शक",
  sourceLink: "HL7 FHIR R4 संसाधन तपशील",
  qualityNote:
    "गुणवत्ता स्थिर परिस्थिती दिनांकानुसार आहे, वर्तमान घड्याळानुसार नाही. ताजे केल्यावर कार्यकारी बदल येतात; रुग्णालय जोडणी होत नाही.",
  glossarySearch: "संज्ञा किंवा माप शोधा",
  noTerms: "शोधाशी जुळणाऱ्या व्याख्या नाहीत.",
  none: "नोंद नाही",
};
export const dataStandardsMessages = { en, hi, mr };
export type DataStandardsKey = keyof typeof en;
