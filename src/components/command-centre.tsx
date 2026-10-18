"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BedDouble,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock3,
  Download,
  FlaskConical,
  HeartPulse,
  LayoutDashboard,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  Pill,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Stethoscope,
  Truck,
  Users,
  X,
  AlertTriangle,
  MapPin,
  Plus,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  AuditEvent,
  Diagnostic,
  Facility,
  Forecast,
  Intelligence,
  Inventory,
  InventoryInsight,
  Locale,
  Recommendation,
  Role,
  Snapshot,
} from "@/lib/types";
import type { MessageKey } from "@/messages";
import { PRODUCT_NAME } from '@/lib/branding';
import type { QualityReport } from '@/lib/data-quality';
import DataStandards from './data-standards';
import Interventions from './interventions';
import type { Intervention } from '@/lib/db';
type View =
  | "command"
  | "facilities"
  | "inventory"
  | "flow"
  | "beds"
  | "doctors"
  | "diagnostics"
  | "transfers"
  | "activity"
  | "quality";
type Data = {
  snapshot: Snapshot;
  intelligence: Intelligence;
  quality: QualityReport;
  interventions: Intervention[];
  demoMode: boolean;
};
type Editor =
  | { kind: "inventory"; record: Inventory }
  | { kind: "beds" | "doctors" | "flow"; facility: Facility }
  | { kind: "diagnostics"; record: Diagnostic };
const navigation: { id: View; icon: typeof Activity }[] = [
  { id: "command", icon: LayoutDashboard },
  { id: "facilities", icon: Building2 },
  { id: "inventory", icon: Pill },
  { id: "flow", icon: Users },
  { id: "beds", icon: BedDouble },
  { id: "doctors", icon: Stethoscope },
  { id: "diagnostics", icon: FlaskConical },
  { id: "transfers", icon: Truck },
  { id: "activity", icon: ClipboardList },
  { id: "quality", icon: ShieldCheck },
];
const round = (n: number) => Math.round(n * 10) / 10;
const percent = (part: number, total: number) =>
  total ? Math.round((part / total) * 100) : 0;
function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return (
    <span className={`badge ${kind}`}>
      <i />
      {children}
    </span>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <CheckCircle2 size={23} />
      <p>{children}</p>
    </div>
  );
}
function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
  languageControl,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  languageControl?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const t = useTranslations();
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    const root = ref.current;
    root?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab" && root) {
        const items = Array.from(
          root.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,select,textarea,[tabindex="0"]',
          ),
        );
        const first = items[0],
          last = items.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === root)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      before?.focus();
    };
  }, []);
  return (
    <div
      className="modal-shade"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`drawer ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="drawer-head">
          <div>
            <span className="eyebrow">VELONX / {t("hourly")}</span>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {languageControl}
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={t("close")}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export default function CommandCentre({
  locale,
  setLocale,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}) {
  const t = useTranslations();
  const tr = (key: MessageKey) => t(key);
  const languageControl = (
    <select
      className="drawer-locale"
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      aria-label="Language / भाषा"
    >
      <option value="en">English</option>
      <option value="hi">हिन्दी</option>
      <option value="mr">मराठी</option>
    </select>
  );
  const [data, setData] = useState<Data | null>(null);
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<View>("command");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [block, setBlock] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [scope, setScope] = useState("all");
  const [role, setRole] = useState<Role>("administrator");
  const [chartId, setChartId] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(
    null,
  );
  const [editor, setEditor] = useState<Editor | null>(null);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [mobile, setMobile] = useState(false);
  const [formError, setFormError] = useState("");
  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const response = await fetch("/api/snapshot", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const result: Data = await response.json();
      setData(result);
      setLoadError("");
    } catch {
      setLoadError("connectionError");
    } finally {
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(true), 30000);
    return () => clearInterval(timer);
  }, [refresh]);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 6500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const snap = data?.snapshot;
  const intel = data?.intelligence;
  const riskMap = useMemo(
    () => new Map(intel?.risks.map((r) => [r.facilityId, r]) ?? []),
    [intel],
  );
  const filtered = useMemo(
    () =>
      snap?.facilities.filter(
        (f) =>
          (scope === "all" || f.id === scope) &&
          (type === "all" || f.type === type) &&
          (block === "all" || f.block === block) &&
          (riskFilter === "all" || riskMap.get(f.id)?.level === riskFilter) &&
          `${f.name} ${f.block}`.toLowerCase().includes(query.toLowerCase()),
      ) ?? [],
    [snap, scope, type, block, riskFilter, query, riskMap],
  );
  const ids = new Set(filtered.map((f) => f.id));
  const chartFacility = filtered.find((f) => f.id === chartId) ?? filtered[0];
  const currentForecast = chartFacility
    ? intel?.footfall[chartFacility.id]
    : undefined;
  const inventoryRows =
    snap?.inventory.filter((i) => ids.has(i.facilityId)) ?? [];
  const insights = intel?.inventory.filter((i) => ids.has(i.facilityId)) ?? [];
  const recommendations =
    intel?.recommendations.filter(
      (r) => ids.has(r.recipientId) || ids.has(r.donorId),
    ) ?? [];
  const transferRows =
    snap?.transfers.filter(
      (r) => ids.has(r.recipientId) || ids.has(r.donorId),
    ) ?? [];
  const diagnosticRows =
    snap?.diagnostics.filter((d) => ids.has(d.facilityId)) ?? [];
  const facilityName = (id: string) =>
    snap?.facilities.find((f) => f.id === id)?.name ?? id;
  const medicineName = (id: string) =>
    snap?.medicines.find((m) => m.id === id)?.name ?? id;
  const fmt = (n: number) =>
    new Intl.NumberFormat(
      locale === "en" ? "en-IN" : locale === "hi" ? "hi-IN" : "mr-IN",
      { maximumFractionDigits: 1 },
    ).format(n);
  const date = (s: string, withTime = false) => {
    const parsed = new Date(s);
    return Number.isNaN(parsed.getTime())
      ? "—"
      : new Intl.DateTimeFormat(
          locale === "en" ? "en-IN" : locale === "hi" ? "hi-IN" : "mr-IN",
          {
            day: "numeric",
            month: "short",
            ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
          },
        ).format(parsed);
  };
  const days = (n: number | null | undefined) =>
    n === null || n === undefined
      ? tr("noEstimate")
      : `${fmt(n)} ${tr("days")}`;
  const canWrite = (facilityId: string) =>
    data?.demoMode === true &&
    (role === "administrator" || scope === facilityId);
  const showError = (error: unknown) =>
    setToast({
      text: error instanceof Error ? error.message : tr("error"),
      error: true,
    });
  async function mutate(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setFormError("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          role,
          ...(role === "administrator" ? {} : { facilityId: scope }),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        const raw = String(result.error ?? "");
        const key: MessageKey = raw.includes("API key")
          ? "errorProtected"
          : res.status === 403
            ? "errorPermission"
            : res.status === 404
              ? "errorMissing"
              : raw.includes("safety") ||
                  raw.includes("expired") ||
                  raw.includes("reserv")
                ? "errorSafety"
                : res.status === 409
                  ? "errorConflict"
                  : res.status === 400
                    ? "errorInvalid"
                    : "error";
        throw new Error(tr(key));
      }
      await refresh(true);
      setToast({ text: tr("success"), error: false });
      return true;
    } catch (error) {
      showError(error);
      setFormError(error instanceof Error ? error.message : tr("error"));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const changeRole = (next: Role) => {
    setRole(next);
    if (next !== "administrator" && scope === "all")
      setScope(snap?.facilities[0]?.id ?? "all");
  };
  const openEditor = (next: Editor) => {
    setFormError("");
    setEditor(next);
  };
  const go = (next: View) => {
    setView(next);
    setMobile(false);
  };
  const reasonText = (code: string, value?: number) => {
    const key: MessageKey =
      code === "medicine-critical" || code === "medicine-warning"
        ? "stockRisk"
        : code === "medicine-data-missing"
          ? "dataGap"
          : code === "bed-pressure"
            ? "bedPressure"
            : code === "patient-load"
              ? "patientPressure"
              : code === "verified-staffing-gap"
                ? "doctorGap"
                : code === "attendance-not-recorded"
                  ? "missing"
                  : code === "diagnostic-unavailable"
                    ? "diagnosticGap"
                    : code === "diagnostic-data-missing"
                      ? "diagnosticMissing"
                      : code === "diagnostic-data-stale"
                        ? "diagnosticStale"
                        : "dataGap";
    return `${tr(key)}${value !== undefined ? ` · ${code === "bed-pressure" || code === "patient-load" ? `${Math.round(value * 100)}%` : fmt(value)}` : ""}`;
  };
  const eventLabel = (action: string) => {
    const key: MessageKey =
      action === "transfer.approved"
        ? "approved"
        : action === "transfer.dispatched"
          ? "dispatched"
          : action === "transfer.received"
            ? "received"
            : action === "transfer.cancelled"
              ? "cancelled"
              : action === "inventory.adjusted"
                ? "updateStock"
                : action === "inventory.quarantined"
                  ? "quarantine"
                  : "update";
    return tr(key);
  };
  const eventDetail = (event: AuditEvent) => {
    try {
      const detail = JSON.parse(event.detail) as Record<string, unknown>;
      if (detail.donor && detail.recipient)
        return `${facilityName(String(detail.donor))} → ${facilityName(String(detail.recipient))} · ${medicineName(String(detail.medicine))} · ${fmt(Number(detail.quantity))} ${tr("units")}`;
      if (detail.before !== undefined && detail.after !== undefined)
        return `${tr("quantity")}: ${String(detail.before)} → ${String(detail.after)} · ${String(detail.reason ?? "")}`;
      if (detail.facilityId) return facilityName(String(detail.facilityId));
      if (detail.quantity !== undefined)
        return `${tr("quantity")}: ${String(detail.quantity)}`;
      return tr("success");
    } catch {
      return event.detail;
    }
  };
  const selectedFacility = snap?.facilities.find((f) => f.id === selected);
  const evidenceRecord = snap?.inventory.find((i) => i.id === evidenceId);
  const recipientRecord = recommendation
    ? snap?.inventory.find(
        (i) =>
          i.facilityId === recommendation.recipientId &&
          i.medicineId === recommendation.medicineId,
      )
    : undefined;
  const recommendationStale =
    !!recommendation &&
    !intel?.recommendations.some(
      (r) =>
        r.id === recommendation.id &&
        r.quantity === recommendation.quantity &&
        r.donorInventoryVersion === recommendation.donorInventoryVersion &&
        r.recipientInventoryVersion ===
          recommendation.recipientInventoryVersion,
    );
  const tableFacility = (f: Facility) => (
    <button className="facility-link" onClick={() => setSelected(f.id)}>
      <span className={`facility-glyph ${f.type === "CHC" ? "chc" : ""}`}>
        <Building2 size={17} />
      </span>
      <span>
        {f.name}
        <small>
          {f.type} · {f.block}
        </small>
      </span>
    </button>
  );
  const totalBeds = filtered.reduce((a, f) => a + f.beds, 0),
    occupiedBeds = filtered.reduce((a, f) => a + f.occupied, 0),
    patients = filtered.reduce((a, f) => a + f.patientsToday, 0),
    dailyCapacity = filtered.reduce((a, f) => a + f.dailyCapacity, 0);
  const titleKey: MessageKey = view;
  const subtitle: MessageKey =
    view === "command" ? "overviewSub" : (`${view}Sub` as MessageKey);
  const renderFacilities = () => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{tr("facility")}</th>
            <th>{tr("risk")}</th>
            <th>{tr("patients")}</th>
            <th>{tr("occupancy")}</th>
            <th>{tr("doctorsPresent")}</th>
            <th>{tr("readiness")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filtered.map((f) => {
            const r = riskMap.get(f.id);
            return (
              <tr key={f.id}>
                <td>{tableFacility(f)}</td>
                <td>
                  <Badge kind={r?.level ?? "unknown"}>
                    {tr(r?.level ?? "unknown")}
                  </Badge>
                </td>
                <td>
                  {fmt(f.patientsToday)}
                  <span className="muted"> / {fmt(f.dailyCapacity)}</span>
                </td>
                <td>
                  <div className="table-progress">
                    <span>
                      {f.beds
                        ? `${percent(f.occupied, f.beds)}%`
                        : tr("noEstimate")}
                    </span>
                    <div>
                      <i
                        style={{
                          width: `${Math.min(percent(f.occupied, f.beds), 100)}%`,
                        }}
                        className={
                          percent(f.occupied, f.beds) >= 85 ? "warm" : ""
                        }
                      />
                    </div>
                  </div>
                </td>
                <td>
                  {f.attendanceRecorded ? (
                    <>
                      <strong>{f.presentDoctors}</strong>
                      <span className="muted"> / {f.scheduledDoctors}</span>
                    </>
                  ) : (
                    <span className="muted">{tr("missing")}</span>
                  )}
                </td>
                <td>
                  {r
                    ? `${Math.round(r.completeness <= 1 ? r.completeness * 100 : r.completeness)}%`
                    : "—"}
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`${tr("details")} ${f.name}`}
                    onClick={() => setSelected(f.id)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!filtered.length && (
        <Empty>
          {tr("noResults")}{" "}
          <button
            className="text-button"
            onClick={() => {
              setQuery("");
              setBlock("all");
              setType("all");
              setRiskFilter("all");
            }}
          >
            {tr("clearFilters")}
          </button>
        </Empty>
      )}
    </div>
  );
  const forecastPanel = (expanded = false) => (
    <section className={`panel forecast-panel ${expanded ? "expanded" : ""}`}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{tr("hourly")}</span>
          <h2>{tr("chartTitle")}</h2>
          <p>{tr("chartSub")}</p>
        </div>
        <select
          aria-label={tr("selectChart")}
          value={chartFacility?.id ?? ""}
          onChange={(e) => setChartId(e.target.value)}
        >
          {filtered.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>
      <div className="chart-legend">
        <span>
          <i className="legend-dot teal" />
          {tr("actual")}
        </span>
        <span>
          <i className="legend-dot blue" />
          {tr("forecast")}
        </span>
        <span className="muted">{tr("patients")}</span>
      </div>
      {chartFacility ? (
        <DemandChart
          history={snap?.footfall[chartFacility.id] ?? []}
          forecast={currentForecast}
          locale={locale}
          actualLabel={tr("actual")}
          forecastLabel={tr("forecast")}
          rangeLabel={tr("range")}
        />
      ) : (
        <Empty>{tr("noChart")}</Empty>
      )}
      <p className="chart-footnote">
        {tr("chartNote")}{" "}
        {!expanded && (
          <button className="text-button" onClick={() => go("flow")}>
            {tr("evidence")} <ArrowRight size={12} />
          </button>
        )}
      </p>
      {expanded && (
        <div className="forecast-evidence">
          <h3>
            <ShieldCheck size={17} />
            {tr("evidence")}
          </h3>
          <div className="evidence-grid">
            <div>
              <span>{tr("method")}</span>
              <strong>{forecastMethod(currentForecast, tr)}</strong>
            </div>
            <div>
              <span>{tr("mae")}</span>
              <strong>
                {currentForecast?.mae === null ||
                currentForecast?.mae === undefined
                  ? "—"
                  : fmt(currentForecast.mae)}
              </strong>
            </div>
            <div>
              <span>{tr("observations")}</span>
              <strong>{currentForecast?.trainingPoints ?? 0}</strong>
            </div>
            <div>
              <span>{tr("validation")}</span>
              <strong>{currentForecast?.validationPoints ?? 0}</strong>
            </div>
          </div>
          <p>
            {currentForecast?.method === "insufficient-data"
              ? tr("noHistory")
              : tr("predictionHelp")}
          </p>
          <p>{tr("maeHelp")}</p>
          <p>{tr("empiricalNote")}</p>
        </div>
      )}
    </section>
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("command");
          }}
        >
          <span className="brand-mark">
            <HeartPulse size={25} strokeWidth={2.5} />
          </span>
          <span>
              {PRODUCT_NAME}
            <small>{tr("brand")}</small>
          </span>
        </a>
        <div className="district-card">
          <span className="district-emblem">
            <Building2 size={18} />
          </span>
          <div>
            <strong>{tr("district")}</strong>
            <span>{tr("workspace")}</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-label">{tr("intelligence")}</div>
        <nav aria-label={tr("menu")}>
          {navigation.map((item, index) => (
            <div key={item.id}>
              {index === 2 && (
                <div className="nav-label operations-label">
                  {tr("operations")}
                </div>
              )}
              <button
                className={`nav-item ${view === item.id ? "active" : ""}`}
                onClick={() => go(item.id)}
                aria-current={view === item.id ? "page" : undefined}
              >
                <item.icon size={18} />
                <span>{tr(item.id)}</span>
                {item.id === "command" && <span className="nav-dot" />}
                {item.id === "transfers" &&
                  transferRows.filter(
                    (r) => r.status === "approved" || r.status === "dispatched",
                  ).length > 0 && (
                    <span className="nav-count">
                      {
                        transferRows.filter(
                          (r) =>
                            r.status === "approved" ||
                            r.status === "dispatched",
                        ).length
                      }
                    </span>
                  )}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="small-cross">+</span>
            <p>{tr("support")}</p>
            <span>{PRODUCT_NAME} · HEALTH SYSTEMS</span>
          </div>
          <div className="profile">
            <div className="avatar">DA</div>
            <div>
              <strong>
                {tr(role === "inventory" ? "inventoryRole" : role)}
              </strong>
              <small>{tr("demoBanner")}</small>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-scrim"
          onClick={() => setMobile(false)}
          aria-label={tr("close")}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label={tr("menu")}
            >
              <Menu size={21} />
            </button>
            <span>{tr("district")}</span>
            <ChevronRight size={14} />
            <strong>{tr(titleKey)}</strong>
          </div>
          <div className="topbar-actions">
            <span className="demo-label">
              <i />
              {tr("demo")}
            </span>
            <select
              className="locale-select"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
              aria-label="Language / भाषा"
            >
              <option value="en">EN · English</option>
              <option value="hi">HI · हिन्दी</option>
              <option value="mr">MR · मराठी</option>
            </select>
            <button
              className="icon-button notification-button"
              aria-label={`${insights.filter((i) => i.risk === "critical").length} ${tr("criticalAlerts")}`}
              onClick={() => {
                setView("inventory");
                setRiskFilter("all");
              }}
            >
              <Bell size={19} />
              {insights.some((i) => i.risk === "critical") && <i />}
            </button>
            <span className="avatar top-avatar">DA</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="page-kicker">
                <span className="status-dot" />
                {tr("demo")}
                <span className="kicker-divider">/</span>
                <span>{snap ? date(snap.asOf) : tr("today")}</span>
              </div>
              <h1>{view === "command" ? tr("overview") : tr(titleKey)}</h1>
              <p>{tr(subtitle)}</p>
            </div>
            <button
              className="button secondary"
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <RefreshCw size={15} className={refreshing ? "spin" : ""} />
              {tr("refresh")}
            </button>
          </div>
          <div className="access-bar">
            <div className="access-item">
              <ShieldCheck size={15} />
              <label htmlFor="role">{tr("role")}</label>
              <select
                id="role"
                value={role}
                onChange={(e) => changeRole(e.target.value as Role)}
              >
                <option value="administrator">{tr("administrator")}</option>
                <option value="officer">{tr("officer")}</option>
                <option value="inventory">{tr("inventoryRole")}</option>
              </select>
            </div>
            <div className="access-item">
              <Building2 size={15} />
              <label htmlFor="scope">{tr("facilityScope")}</label>
              <select
                id="scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                {role === "administrator" && (
                  <option value="all">{tr("allDistrict")}</option>
                )}
                {snap?.facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <span className="access-hint" title={tr("demoRoleNote")}>
              {tr("demoRoleNote")}
            </span>
          </div>
          {data && !data.demoMode && (
            <div className="inline-alert">
              <ShieldCheck size={17} />
              {tr("protectedMode")}
            </div>
          )}
          {loadError && data && (
            <div className="inline-alert">
              <AlertTriangle size={17} />
              {tr("dataStale")}
              <button onClick={() => void refresh()}>{tr("retry")}</button>
            </div>
          )}
          {!data ? (
            <div className="loading-state">
              {loadError ? (
                <>
                  <AlertTriangle size={30} />
                  <h2>{tr("connectionError")}</h2>
                  <button
                    className="button primary"
                    onClick={() => void refresh()}
                  >
                    {tr("retry")}
                  </button>
                </>
              ) : (
                <>
                  <LoaderCircle size={32} className="spin" />
                  <h2>{tr("loading")}</h2>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="filters">
                <div className="search-input">
                  <Search size={17} />
                  <input
                    placeholder={tr("search")}
                    aria-label={tr("search")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="filter-selects">
                  <SlidersHorizontal size={16} />
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    aria-label={tr("allTypes")}
                  >
                    <option value="all">{tr("allTypes")}</option>
                    <option>PHC</option>
                    <option>CHC</option>
                  </select>
                  <select
                    value={block}
                    onChange={(e) => setBlock(e.target.value)}
                    aria-label={tr("allBlocks")}
                  >
                    <option value="all">{tr("allBlocks")}</option>
                    {Array.from(new Set(snap?.facilities.map((f) => f.block)))
                      .sort()
                      .map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                  </select>
                  <select
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value)}
                    aria-label={tr("allRisks")}
                  >
                    <option value="all">{tr("allRisks")}</option>
                    <option value="critical">{tr("critical")}</option>
                    <option value="watch">{tr("watch")}</option>
                    <option value="stable">{tr("stable")}</option>
                  </select>
                </div>
              </div>
              {(view === "command" || view === "facilities") && (
                <div className="stat-grid">
                  <Stat
                    icon={<Building2 size={21} />}
                    label={tr("totalFacilities")}
                    value={fmt(filtered.length)}
                    detail={tr("reporting")}
                    color="teal"
                  />
                  <Stat
                    icon={<Users size={21} />}
                    label={tr("patients")}
                    value={fmt(patients)}
                    detail={`${percent(patients, dailyCapacity)}% ${tr("capacity")}`}
                    color="blue"
                  />
                  <Stat
                    icon={<BedDouble size={21} />}
                    label={tr("availableBeds")}
                    value={fmt(totalBeds - occupiedBeds)}
                    detail={`${fmt(totalBeds)} ${tr("bedsTotal").toLowerCase()}`}
                    color="purple"
                  />
                  <Stat
                    icon={<Pill size={21} />}
                    label={tr("criticalAlerts")}
                    value={fmt(
                      insights.filter((i) => i.risk === "critical").length,
                    )}
                    detail={tr("needsAttention")}
                    color="amber"
                  />
                </div>
              )}
              {view === "command" && (
                <>
                  <Interventions
                    facilities={snap?.facilities ?? []}
                    risks={data.intelligence.risks}
                    interventions={data.interventions ?? []}
                    isAdmin={role === "administrator"}
                    busy={busy}
                    locale={locale}
                    onSave={(facilityId, status, note) =>
                      void mutate("/api/interventions", { facilityId, status, note })
                    }
                  />
                  <div className="command-grid">
                    <section className="panel network-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="eyebrow">{tr("districtPulse")}</span>
                          <h2>{tr("network")}</h2>
                          <p>{tr("networkSub")}</p>
                        </div>
                        <span className="small-tag">
                          {filtered.length} {tr("rows")}
                        </span>
                      </div>
                      <FacilityMap
                        facilities={filtered}
                        risks={riskMap}
                        onSelect={setSelected}
                        facilityLabel={tr("facility")}
                      />
                      <div className="map-footer">
                        <div className="map-legend">
                          <span>
                            <i className="legend-dot red" />
                            {tr("critical")}
                          </span>
                          <span>
                            <i className="legend-dot amber" />
                            {tr("watch")}
                          </span>
                          <span>
                            <i className="legend-dot teal" />
                            {tr("stable")}
                          </span>
                        </div>
                        <span>{tr("mapLegend")}</span>
                      </div>
                    </section>
                    <section className="panel priority-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="eyebrow amber-text">
                            {tr("needsAttention")}
                          </span>
                          <h2>{tr("priority")}</h2>
                          <p>{tr("prioritySub")}</p>
                        </div>
                        <span className="priority-number">
                          {recommendations.length}
                        </span>
                      </div>
                      <div className="recommendation-list">
                        {recommendations.slice(0, 3).map((r) => (
                          <article className="recommendation-card" key={r.id}>
                            <div className="recommendation-top">
                              <span className="medicine-icon">
                                <Pill size={17} />
                              </span>
                              <strong>{medicineName(r.medicineId)}</strong>
                              <Badge kind={r.urgency}>{tr(r.urgency)}</Badge>
                            </div>
                            <div className="transfer-route">
                              <span>{facilityName(r.donorId)}</span>
                              <ArrowRight size={14} />
                              <strong>{facilityName(r.recipientId)}</strong>
                            </div>
                            <div className="recommendation-bottom">
                              <span>
                                {fmt(r.quantity)} {tr("units")}
                                <i /> {fmt(r.distanceKm)} km
                              </span>
                              <button
                                onClick={() => {
                                  setFormError("");
                                  setRecommendation(r);
                                }}
                              >
                                {tr("review")}
                                <ArrowUpRight size={14} />
                              </button>
                            </div>
                          </article>
                        ))}
                        {!recommendations.length && (
                          <Empty>{tr("noRecommendations")}</Empty>
                        )}
                      </div>
                      <button
                        className="panel-footer-link"
                        onClick={() => go("transfers")}
                      >
                        {tr("transfers")}
                        <ArrowRight size={16} />
                      </button>
                    </section>
                  </div>
                  <div className="lower-grid">
                    {forecastPanel()}
                    <section className="panel readiness-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="eyebrow">{tr("quickSummary")}</span>
                          <h2>{tr("districtPulse")}</h2>
                          <p>{tr("pulseSub")}</p>
                        </div>
                        <HeartPulse size={21} className="muted" />
                      </div>
                      <div className="pulse-summary">
                        <div
                          className="pulse-ring"
                          style={
                            {
                              "--value": `${percent(filtered.filter((f) => riskMap.get(f.id)?.level === "stable").length, filtered.length)}%`,
                            } as React.CSSProperties
                          }
                        >
                          <div>
                            <strong>
                              {percent(
                                filtered.filter(
                                  (f) => riskMap.get(f.id)?.level === "stable",
                                ).length,
                                filtered.length,
                              )}
                              <small>%</small>
                            </strong>
                            <span>{tr("stable")}</span>
                          </div>
                        </div>
                        <div className="pulse-counts">
                          {(["critical", "watch", "stable"] as const).map(
                            (level) => (
                              <div key={level}>
                                <span>
                                  <i
                                    className={`legend-dot ${level === "critical" ? "red" : level === "watch" ? "amber" : "teal"}`}
                                  />
                                  {tr(level)}
                                </span>
                                <strong>
                                  {
                                    filtered.filter(
                                      (f) => riskMap.get(f.id)?.level === level,
                                    ).length
                                  }
                                </strong>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                      <p className="panel-caption">{tr("verify")}</p>
                      <button
                        className="panel-footer-link"
                        onClick={() => go("facilities")}
                      >
                        {tr("viewFacilities")}
                        <ArrowRight size={16} />
                      </button>
                    </section>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>{tr("facilities")}</h2>
                        <p>{tr("facilitiesSub")}</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => go("facilities")}
                      >
                        {tr("all")}
                        <ArrowRight size={15} />
                      </button>
                    </div>
                    {renderFacilities()}
                  </section>
                </>
              )}
              {view === "facilities" && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>
                      {tr("facilities")}
                      <span className="inline-count">{filtered.length}</span>
                    </h2>
                    <span className="muted">{tr("refreshEvery")}</span>
                  </div>
                  {renderFacilities()}
                </section>
              )}
              {view === "inventory" && (
                <>
                  <div className="compact-metrics">
                    <span>
                      <strong>{inventoryRows.length}</strong>
                      {tr("medicines")}
                    </span>
                    <span>
                      <strong className="red-text">
                        {insights.filter((i) => i.risk === "critical").length}
                      </strong>
                      {tr("critical")}
                    </span>
                    <span>
                      <strong className="amber-text">
                        {insights.filter((i) => i.risk === "warning").length}
                      </strong>
                      {tr("watch")}
                    </span>
                    <span>
                      <strong>
                        {insights.filter((i) => i.risk === "unknown").length}
                      </strong>
                      {tr("unknown")}
                    </span>
                  </div>
                  <section className="panel">
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>{tr("medicine")}</th>
                            <th>{tr("facility")}</th>
                            <th>{tr("stock")}</th>
                            <th>{tr("demand")}</th>
                            <th>{tr("cover")}</th>
                            <th>{tr("expiry")}</th>
                            <th>{tr("risk")}</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {inventoryRows.map((i) => {
                            const insight = intel?.inventory.find(
                              (x) => x.inventoryId === i.id,
                            );
                            return (
                              <tr key={i.id}>
                                <td>
                                  <strong>{medicineName(i.medicineId)}</strong>
                                  <small>
                                    {tr("reserved")}: {i.reserved} ·{" "}
                                    {tr("minimum")}: {i.minimum}
                                  </small>
                                </td>
                                <td>
                                  <button
                                    className="text-button quiet"
                                    onClick={() => setSelected(i.facilityId)}
                                  >
                                    {facilityName(i.facilityId)}
                                  </button>
                                </td>
                                <td>
                                  <strong>
                                    {insight?.available ??
                                      Math.max(0, i.quantity - i.reserved)}
                                  </strong>
                                </td>
                                <td>
                                  {insight?.forecast.method ===
                                  "insufficient-data"
                                    ? tr("noEstimate")
                                    : insight
                                      ? fmt(insight.dailyDemand)
                                      : "—"}
                                </td>
                                <td>{days(insight?.daysRemaining)}</td>
                                <td>
                                  <span
                                    className={
                                      insight?.expired ? "red-text" : ""
                                    }
                                  >
                                    {date(i.expiry)}
                                  </span>
                                  {insight?.expired && (
                                    <small className="red-text">
                                      {tr("expired")}
                                    </small>
                                  )}
                                </td>
                                <td>
                                  <Badge kind={insight?.risk ?? "unknown"}>
                                    {tr(insight?.risk ?? "unknown")}
                                  </Badge>
                                </td>
                                <td>
                                  <div className="row-actions">
                                    <button
                                      className="button small secondary"
                                      onClick={() => setEvidenceId(i.id)}
                                    >
                                      {tr("evidence")}
                                    </button>
                                    <button
                                      className="button small secondary"
                                      disabled={!canWrite(i.facilityId)}
                                      onClick={() =>
                                        openEditor({
                                          kind: "inventory",
                                          record: i,
                                        })
                                      }
                                    >
                                      {tr("updateStock")}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {!inventoryRows.length && (
                        <Empty>{tr("noInventory")}</Empty>
                      )}
                    </div>
                  </section>
                </>
              )}
              {view === "flow" && (
                <>
                  {forecastPanel(true)}
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>{tr("patientCount")}</h2>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>{tr("facility")}</th>
                            <th>{tr("patients")}</th>
                            <th>{tr("dailyCapacity")}</th>
                            <th>{tr("serviceCapacity")}</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((f) => (
                            <tr key={f.id}>
                              <td>{tableFacility(f)}</td>
                              <td>{fmt(f.patientsToday)}</td>
                              <td>{fmt(f.dailyCapacity)}</td>
                              <td>
                                <Badge
                                  kind={
                                    f.patientsToday > f.dailyCapacity
                                      ? "critical"
                                      : "healthy"
                                  }
                                >
                                  {percent(f.patientsToday, f.dailyCapacity)}%
                                </Badge>
                              </td>
                              <td>
                                <button
                                  className="button secondary small"
                                  disabled={
                                    !canWrite(f.id) || role === "inventory"
                                  }
                                  onClick={() =>
                                    openEditor({ kind: "flow", facility: f })
                                  }
                                >
                                  {tr("update")}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!filtered.length && <Empty>{tr("noResults")}</Empty>}
                    </div>
                  </section>
                </>
              )}
              {(view === "beds" || view === "doctors") && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>{tr(view)}</h2>
                    <span className="small-tag">
                      {filtered.length} {tr("rows")}
                    </span>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{tr("facility")}</th>
                          {view === "beds" ? (
                            <>
                              <th>{tr("bedsTotal")}</th>
                              <th>{tr("occupied")}</th>
                              <th>{tr("free")}</th>
                              <th>{tr("occupancy")}</th>
                            </>
                          ) : (
                            <>
                              <th>{tr("scheduled")}</th>
                              <th>{tr("present")}</th>
                              <th>{tr("attendance")}</th>
                            </>
                          )}
                          <th>{tr("latest")}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((f) => (
                          <tr key={f.id}>
                            <td>{tableFacility(f)}</td>
                            {view === "beds" ? (
                              <>
                                <td>{f.beds}</td>
                                <td>{f.occupied}</td>
                                <td>
                                  <strong>{f.beds - f.occupied}</strong>
                                </td>
                                <td>
                                  <Badge
                                    kind={
                                      !f.beds
                                        ? "unknown"
                                        : percent(f.occupied, f.beds) >= 85
                                          ? "warning"
                                          : "healthy"
                                    }
                                  >
                                    {f.beds
                                      ? `${percent(f.occupied, f.beds)}%`
                                      : tr("noEstimate")}
                                  </Badge>
                                </td>
                              </>
                            ) : (
                              <>
                                <td>{f.scheduledDoctors}</td>
                                <td>
                                  {f.attendanceRecorded
                                    ? f.presentDoctors
                                    : "—"}
                                </td>
                                <td>
                                  <Badge
                                    kind={
                                      f.attendanceRecorded
                                        ? "healthy"
                                        : "unknown"
                                    }
                                  >
                                    {tr(
                                      f.attendanceRecorded
                                        ? "recorded"
                                        : "missing",
                                    )}
                                  </Badge>
                                </td>
                              </>
                            )}
                            <td>{date(f.updatedAt, true)}</td>
                            <td>
                              <button
                                className="button secondary small"
                                disabled={
                                  !canWrite(f.id) || role === "inventory"
                                }
                                onClick={() =>
                                  openEditor({ kind: view, facility: f })
                                }
                              >
                                {tr("update")}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!filtered.length && <Empty>{tr("noResults")}</Empty>}
                  </div>
                </section>
              )}
              {view === "diagnostics" && (
                <section className="panel">
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>{tr("service")}</th>
                          <th>{tr("facility")}</th>
                          <th>{tr("equipment")}</th>
                          <th>{tr("reagents")}</th>
                          <th>{tr("downtime")}</th>
                          <th>{tr("latest")}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {diagnosticRows.map((d) => (
                          <tr key={d.id}>
                            <td>
                              <strong>{d.name}</strong>
                            </td>
                            <td>
                              <button
                                className="text-button quiet"
                                onClick={() => setSelected(d.facilityId)}
                              >
                                {facilityName(d.facilityId)}
                              </button>
                            </td>
                            <td>
                              <Badge
                                kind={
                                  d.equipment === "operational"
                                    ? "healthy"
                                    : d.equipment === "down"
                                      ? "critical"
                                      : "unknown"
                                }
                              >
                                {tr(d.equipment)}
                              </Badge>
                            </td>
                            <td>
                              <Badge kind={d.reagents ? "healthy" : "warning"}>
                                {tr(d.reagents ? "yes" : "no")}
                              </Badge>
                            </td>
                            <td>
                              {d.downtimeHours} {tr("hours")}
                            </td>
                            <td>{date(d.updatedAt, true)}</td>
                            <td>
                              <button
                                className="button secondary small"
                                disabled={
                                  !canWrite(d.facilityId) ||
                                  role === "inventory"
                                }
                                onClick={() =>
                                  openEditor({ kind: "diagnostics", record: d })
                                }
                              >
                                {tr("update")}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!diagnosticRows.length && (
                      <Empty>{tr("noDiagnostics")}</Empty>
                    )}
                  </div>
                </section>
              )}
              {view === "transfers" && (
                <>
                  <section className="panel">
                    <div className="panel-heading">
                      <div>
                        <h2>{tr("priority")}</h2>
                        <p>{tr("prioritySub")}</p>
                      </div>
                      <span className="small-tag">
                        {recommendations.length}
                      </span>
                    </div>
                    <div className="transfer-suggestions">
                      {recommendations.map((r) => (
                        <article className="recommendation-card" key={r.id}>
                          <div className="recommendation-top">
                            <Pill size={17} />
                            <strong>{medicineName(r.medicineId)}</strong>
                            <Badge kind={r.urgency}>{tr(r.urgency)}</Badge>
                          </div>
                          <div className="transfer-route">
                            <span>{facilityName(r.donorId)}</span>
                            <ArrowRight size={14} />
                            <strong>{facilityName(r.recipientId)}</strong>
                          </div>
                          <div className="recommendation-bottom">
                            <span>
                              {fmt(r.quantity)} {tr("units")} ·{" "}
                              {fmt(r.distanceKm)} km
                            </span>
                            <button
                              onClick={() => {
                                setFormError("");
                                setRecommendation(r);
                              }}
                            >
                              {tr("review")}
                              <ArrowUpRight size={14} />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    {!recommendations.length && (
                      <Empty>{tr("noRecommendations")}</Empty>
                    )}
                  </section>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>{tr("transfers")}</h2>
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>{tr("medicine")}</th>
                            <th>{tr("from")}</th>
                            <th>{tr("to")}</th>
                            <th>{tr("quantity")}</th>
                            <th>{tr("status")}</th>
                            <th>{tr("created")}</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {transferRows.map((r) => (
                            <tr key={r.id}>
                              <td>
                                <strong>{medicineName(r.medicineId)}</strong>
                                <small>{r.id}</small>
                              </td>
                              <td>{facilityName(r.donorId)}</td>
                              <td>{facilityName(r.recipientId)}</td>
                              <td>{r.quantity}</td>
                              <td>
                                <Badge
                                  kind={
                                    r.status === "received"
                                      ? "healthy"
                                      : r.status === "cancelled"
                                        ? "unknown"
                                        : r.status === "dispatched"
                                          ? "blue"
                                          : "warning"
                                  }
                                >
                                  {tr(r.status)}
                                </Badge>
                              </td>
                              <td>{date(r.createdAt, true)}</td>
                              <td>
                                <div className="row-actions">
                                  {r.status === "approved" && (
                                    <>
                                      <button
                                        className="button small primary"
                                        disabled={busy || !canWrite(r.donorId)}
                                        onClick={() =>
                                          void mutate(
                                            `/api/transfers/${r.id}`,
                                            { action: "dispatch" },
                                          )
                                        }
                                      >
                                        {tr("dispatch")}
                                      </button>
                                      <button
                                        className="button small secondary"
                                        disabled={
                                          busy ||
                                          role !== "administrator" ||
                                          !data?.demoMode
                                        }
                                        onClick={() =>
                                          void mutate(
                                            `/api/transfers/${r.id}`,
                                            { action: "cancel" },
                                          )
                                        }
                                      >
                                        {tr("cancelTransfer")}
                                      </button>
                                    </>
                                  )}
                                  {r.status === "dispatched" && (
                                    <button
                                      className="button small primary"
                                      disabled={
                                        busy || !canWrite(r.recipientId)
                                      }
                                      onClick={() =>
                                        void mutate(`/api/transfers/${r.id}`, {
                                          action: "receive",
                                        })
                                      }
                                    >
                                      {tr("receive")}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!transferRows.length && (
                        <Empty>{tr("noTransfers")}</Empty>
                      )}
                    </div>
                  </section>
                </>
              )}
              {view === "activity" && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>{tr("activity")}</h2>
                    <span className="small-tag">{snap?.audit.length}</span>
                  </div>
                  <div className="activity-list">
                    {snap?.audit.map((event) => (
                      <article key={event.id}>
                        <span className="audit-icon">
                          <ClipboardList size={18} />
                        </span>
                        <div>
                          <strong>{eventLabel(event.action)}</strong>
                          <p>{eventDetail(event)}</p>
                          <small>
                            {tr(
                              event.actor === "inventory"
                                ? "inventoryRole"
                                : event.actor === "officer"
                                  ? "officer"
                                  : "administrator",
                            )}{" "}
                            · {event.entityId}
                          </small>
                        </div>
                        <time>{date(event.at, true)}</time>
                      </article>
                    ))}
                    {!snap?.audit.length && <Empty>{tr("noActivity")}</Empty>}
                  </div>
                </section>
              )}
              {view === 'quality' && snap && data.quality && <DataStandards snapshot={snap} report={data.quality} facilityIds={filtered.map(f=>f.id)} locale={locale} onFacilitySelect={setSelected} />}
              <footer className="main-footer">
                <span>
                  <ShieldCheck size={14} />
                  {tr("syntheticNote")}
                </span>
                <span>{PRODUCT_NAME} / 2026</span>
              </footer>
            </>
          )}
        </main>
      </div>
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {toast.error ? (
            <AlertTriangle size={19} />
          ) : (
            <CheckCircle2 size={19} />
          )}
          <span>{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label={tr("close")}>
            <X size={16} />
          </button>
        </div>
      )}
      {selectedFacility && (
        <Modal
          languageControl={languageControl}
          title={selectedFacility.name}
          subtitle={`${selectedFacility.type} · ${selectedFacility.block}`}
          onClose={() => setSelected(null)}
        >
          <div className="drawer-body">
            <div className="detail-top">
              <Badge
                kind={riskMap.get(selectedFacility.id)?.level ?? "unknown"}
              >
                {tr(riskMap.get(selectedFacility.id)?.level ?? "unknown")}
              </Badge>
              <span className="muted">
                {tr("latest")}: {date(selectedFacility.updatedAt, true)}
              </span>
            </div>
            <h3>{tr("operationalSummary")}</h3>
            <div className="detail-stat-grid">
              <div>
                <BedDouble size={20} />
                <strong>
                  {selectedFacility.beds - selectedFacility.occupied}
                  <small> / {selectedFacility.beds}</small>
                </strong>
                <span>{tr("availableBeds")}</span>
              </div>
              <div>
                <Users size={20} />
                <strong>
                  {selectedFacility.patientsToday}
                  <small> / {selectedFacility.dailyCapacity}</small>
                </strong>
                <span>{tr("patients")}</span>
              </div>
              <div>
                <Stethoscope size={20} />
                <strong>
                  {selectedFacility.attendanceRecorded
                    ? selectedFacility.presentDoctors
                    : "—"}
                  <small> / {selectedFacility.scheduledDoctors}</small>
                </strong>
                <span>{tr("doctorsPresent")}</span>
              </div>
              <div>
                <Pill size={20} />
                <strong>
                  {
                    intel?.inventory.filter(
                      (i) =>
                        i.facilityId === selectedFacility.id &&
                        i.risk === "critical",
                    ).length
                  }
                </strong>
                <span>{tr("criticalAlerts")}</span>
              </div>
            </div>
            <div className="risk-evidence">
              <h3>
                <AlertTriangle size={17} />
                {tr("riskEvidence")}
              </h3>
              {riskMap.get(selectedFacility.id)?.reasons.length ? (
                <ul>
                  {riskMap.get(selectedFacility.id)?.reasons.map((r, index) => (
                    <li key={index}>{reasonText(r.code, r.value)}</li>
                  ))}
                </ul>
              ) : (
                <p>{tr("noRisk")}</p>
              )}
            </div>
            <h3>{tr("inventory")}</h3>
            {snap?.inventory
              .filter((i) => i.facilityId === selectedFacility.id)
              .map((i) => {
                const insight = intel?.inventory.find(
                  (x) => x.inventoryId === i.id,
                );
                return (
                  <div className="detail-medicine" key={i.id}>
                    <div>
                      <strong>{medicineName(i.medicineId)}</strong>
                      <small>
                        {tr("stock")}: {insight?.available ?? 0} · {tr("cover")}
                        : {days(insight?.daysRemaining)}
                      </small>
                    </div>
                    <Badge kind={insight?.risk ?? "unknown"}>
                      {tr(insight?.risk ?? "unknown")}
                    </Badge>
                  </div>
                );
              })}
            <div className="drawer-note">
              <ShieldCheck size={18} />
              <p>{tr("verify")}</p>
            </div>
            <button
              className="button primary full-width"
              onClick={() => {
                setScope(selectedFacility.id);
                setSelected(null);
                setView("inventory");
              }}
            >
              {tr("inventory")}
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {recommendation && (
        <Modal
          languageControl={languageControl}
          title={tr("recommendation")}
          subtitle={tr("reviewSub")}
          onClose={() => setRecommendation(null)}
        >
          <div className="drawer-body">
            <div className="review-medicine">
              <span className="large-medicine-icon">
                <Pill size={27} />
              </span>
              <div>
                <span className="eyebrow">{tr("transferMedicine")}</span>
                <h3>{medicineName(recommendation.medicineId)}</h3>
                <p>
                  {fmt(recommendation.quantity)} {tr("units")}
                </p>
              </div>
              <Badge kind={recommendation.urgency}>
                {tr(recommendation.urgency)}
              </Badge>
            </div>
            <div className="review-route">
              <div>
                <span>{tr("donor")}</span>
                <strong>{facilityName(recommendation.donorId)}</strong>
              </div>
              <ArrowDownLeft size={20} />
              <div>
                <span>{tr("recipient")}</span>
                <strong>{facilityName(recommendation.recipientId)}</strong>
              </div>
            </div>
            <div className="review-metrics">
              <div>
                <span>{tr("distance")}</span>
                <strong>{fmt(recommendation.distanceKm)} km</strong>
              </div>
              <div>
                <span>{tr("donorSafety")}</span>
                <strong>
                  {recommendation.donorSafetyStock} {tr("units")}
                </strong>
              </div>
            </div>
            <h3>{tr("stock")}</h3>
            <div className="impact-table">
              <div>
                <span />
                <span>{tr("before")}</span>
                <span>{tr("after")}</span>
              </div>
              {(["donor", "recipient"] as const).map((side) => {
                const id =
                  side === "donor"
                    ? recommendation.donorId
                    : recommendation.recipientId;
                const before =
                  intel?.inventory.find(
                    (i) =>
                      i.facilityId === id &&
                      i.medicineId === recommendation.medicineId,
                  )?.available ?? 0;
                const after =
                  side === "donor"
                    ? before - recommendation.quantity
                    : before + recommendation.quantity;
                return (
                  <div key={side}>
                    <strong>{tr(side)}</strong>
                    <span>
                      {fmt(before)} {tr("units")}
                    </span>
                    <strong>
                      {fmt(after)} {tr("units")}
                    </strong>
                  </div>
                );
              })}
            </div>
            <h3>{tr("planningCover")}</h3>
            <div className="impact-table">
              <div>
                <span />
                <span>{tr("before")}</span>
                <span>{tr("after")}</span>
              </div>
              <div>
                <strong>{tr("donor")}</strong>
                <span>
                  {days(
                    (() => {
                      const i = intel?.inventory.find(
                        (i) =>
                          i.facilityId === recommendation.donorId &&
                          i.medicineId === recommendation.medicineId,
                      );
                      return i?.daysRemaining;
                    })(),
                  )}
                </span>
                <strong>{days(recommendation.donorDaysAfter)}</strong>
              </div>
              <div>
                <strong>{tr("recipient")}</strong>
                <span className="red-text">
                  {days(recommendation.recipientDaysBefore)}
                </span>
                <strong className="teal-text">
                  {days(recommendation.recipientDaysAfter)}
                </strong>
              </div>
            </div>
            <p className="impact-caveat">{tr("receiptAssumption")}</p>
            <p className="impact-caveat">{tr("allocationNote")}</p>
            {recipientRecord && (
              <MedicineEvidence
                record={recipientRecord}
                insight={intel?.inventory.find(
                  (i) => i.inventoryId === recipientRecord.id,
                )}
                locale={locale}
                tr={tr}
                date={date}
                fmt={fmt}
              />
            )}
            {recommendationStale && (
              <p className="form-error" role="alert">
                {tr("errorConflict")}
              </p>
            )}
            <div className="risk-evidence">
              <h3>
                <ShieldCheck size={17} />
                {tr("reason")}
              </h3>
              <p>{tr("reasonText")}</p>
              <p>{tr("verify")}</p>
            </div>
            <div className="drawer-note">
              <Clock3 size={18} />
              <p>{tr("approvalNote")}</p>
            </div>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button
              className="button primary full-width"
              disabled={
                busy ||
                role !== "administrator" ||
                !data?.demoMode ||
                recommendationStale
              }
              onClick={async () => {
                const r = recommendation;
                if (
                  await mutate("/api/transfers", {
                    recommendationId: r.id,
                    donorInventoryVersion: r.donorInventoryVersion,
                    recipientInventoryVersion: r.recipientInventoryVersion,
                  })
                ) {
                  setRecommendation(null);
                  setView("transfers");
                }
              }}
            >
              {busy ? (
                <LoaderCircle size={17} className="spin" />
              ) : (
                <Check size={17} />
              )}{" "}
              {busy ? tr("approving") : tr("approve")}
            </button>
            {role !== "administrator" && (
              <p className="form-hint">{tr("roleRestriction")}</p>
            )}
          </div>
        </Modal>
      )}
      {evidenceRecord && (
        <Modal
          languageControl={languageControl}
          title={tr("medicineEvidence")}
          subtitle={`${medicineName(evidenceRecord.medicineId)} · ${facilityName(evidenceRecord.facilityId)}`}
          onClose={() => setEvidenceId(null)}
        >
          <div className="drawer-body">
            <MedicineEvidence
              record={evidenceRecord}
              insight={intel?.inventory.find(
                (i) => i.inventoryId === evidenceRecord.id,
              )}
              locale={locale}
              tr={tr}
              date={date}
              fmt={fmt}
            />
          </div>
        </Modal>
      )}
      {editor && (
        <Modal
          languageControl={languageControl}
          title={tr(
            editor.kind === "inventory"
              ? "updateStock"
              : editor.kind === "diagnostics"
                ? "diagnosticUpdate"
                : "update",
          )}
          subtitle={
            editor.kind === "inventory"
              ? medicineName(editor.record.medicineId)
              : editor.kind === "diagnostics"
                ? editor.record.name
                : editor.facility.name
          }
          onClose={() => setEditor(null)}
        >
          <RecordForm
            editor={editor}
            busy={busy}
            error={formError}
            tr={tr}
            onCancel={() => setEditor(null)}
            onSubmit={async (body) => {
              const path =
                editor.kind === "inventory"
                  ? `/api/inventory/${editor.record.id}`
                  : "/api/operations";
              if (await mutate(path, body)) setEditor(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
function Stat({
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
function forecastMethod(
  f: Forecast | undefined,
  tr: (key: MessageKey) => string,
) {
  return tr(
    f?.method === "seasonal-naive"
      ? "seasonalNaive"
      : f?.method === "moving-average"
        ? "movingAverage"
        : f?.method === "exponential-smoothing"
          ? "exponentialSmoothing"
          : "insufficientData",
  );
}
function DemandChart({
  history,
  forecast,
  locale,
  actualLabel,
  forecastLabel,
  rangeLabel,
}: {
  history: { date: string; value: number }[];
  forecast: Forecast | undefined;
  locale: Locale;
  actualLabel: string;
  forecastLabel: string;
  rangeLabel: string;
}) {
  const points = history.slice(-14).map((p) => ({
    date: p.date,
    actual: p.value,
    forecast: undefined as number | undefined,
    band: undefined as [number, number] | undefined,
  }));
  if (points.length && forecast?.points.length)
    points[points.length - 1].forecast = points[points.length - 1].actual;
  const rows = [
    ...points,
    ...(forecast?.points ?? []).map((p) => ({
      date: p.date,
      actual: undefined as number | undefined,
      forecast: p.value,
      band:
        p.lower === null || p.upper === null
          ? undefined
          : ([p.lower, p.upper] as [number, number]),
    })),
  ];
  return (
    <div className="demand-chart">
      <ResponsiveContainer width="100%" height={230}>
        <ComposedChart
          data={rows}
          margin={{ left: -24, right: 12, top: 10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="forecastBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6c91c4" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#6c91c4" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#168f79" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#168f79" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="#edf0f0"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={28}
            tick={{ fill: "#8a939c", fontSize: 10 }}
            tickFormatter={(v) =>
              new Intl.DateTimeFormat(locale, {
                month: "short",
                day: "numeric",
              }).format(new Date(v))
            }
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#8a939c", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #e7ebea",
              borderRadius: 9,
              fontSize: 12,
            }}
            labelFormatter={(v) => String(v)}
            formatter={(value, name) =>
              name === "band"
                ? [
                    Array.isArray(value) ? `${value[0]}–${value[1]}` : value,
                    rangeLabel,
                  ]
                : [value, name === "actual" ? actualLabel : forecastLabel]
            }
          />
          <Area
            type="monotone"
            dataKey="band"
            fill="url(#forecastBand)"
            stroke="none"
          />
          <Area
            type="monotone"
            dataKey="actual"
            fill="url(#actualFill)"
            stroke="#168f79"
            strokeWidth={2.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            stroke="#7699c4"
            strokeWidth={2.5}
            strokeDasharray="5 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
function FacilityMap({
  facilities,
  risks,
  onSelect,
  facilityLabel,
}: {
  facilities: Facility[];
  risks: Map<string, { level: string }>;
  onSelect: (id: string) => void;
  facilityLabel: string;
}) {
  const allLat = facilities.map((f) => f.lat),
    allLng = facilities.map((f) => f.lng);
  const minLat = Math.min(...allLat),
    maxLat = Math.max(...allLat),
    minLng = Math.min(...allLng),
    maxLng = Math.max(...allLng);
  return (
    <div className="facility-map">
      <svg viewBox="0 0 660 340" role="img" aria-label={facilityLabel}>
        <defs>
          <pattern
            id="mapGrid"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r=".7" fill="#cfdad2" />
          </pattern>
          <linearGradient id="mapFill">
            <stop stopColor="#eaf0e5" />
            <stop offset="1" stopColor="#f0f2e9" />
          </linearGradient>
        </defs>
        <rect width="660" height="340" fill="#f7f8f1" />
        <rect width="660" height="340" fill="url(#mapGrid)" />
        <path
          d="M153 28L233 38 269 20 331 48 390 37 426 67 503 54 530 100 580 131 553 185 579 237 525 256 492 303 426 287 370 317 310 296 258 317 213 285 151 291 122 247 80 221 113 175 84 131 125 102Z"
          fill="url(#mapFill)"
          stroke="#cdd8ca"
          strokeWidth="1.5"
        />
        <path
          d="M115 181C198 131 227 224 322 181S450 106 553 185M233 38Q240 142 322 181T370 317M125 102Q246 108 322 181T492 303M122 247Q249 198 322 181T503 54"
          fill="none"
          stroke="#d3dccb"
          strokeDasharray="4 5"
        />
        <path
          d="M20 271Q96 258 150 225T294 217 402 197 489 217 655 145"
          stroke="#c9dfe3"
          strokeWidth="7"
          fill="none"
          opacity=".7"
        />
        <path
          d="M119 274Q213 263 267 185T370 113 578 84"
          stroke="white"
          strokeWidth="5"
          fill="none"
        />
        <path
          d="M119 274Q213 263 267 185T370 113 578 84"
          stroke="#dedfd2"
          strokeWidth="1"
          fill="none"
        />
        <text
          x="332"
          y="172"
          textAnchor="middle"
          fill="#a0ad9b"
          fontSize="11"
          letterSpacing="4"
        >
          SEHORE
        </text>
        {facilities.map((f, index) => {
          const x = 150 + ((f.lng - minLng) / (maxLng - minLng || 1)) * 355;
          const y = 65 + ((maxLat - f.lat) / (maxLat - minLat || 1)) * 210;
          const level = risks.get(f.id)?.level ?? "stable";
          const color =
            level === "critical"
              ? "#d26553"
              : level === "watch"
                ? "#d7a34f"
                : "#188d78";
          return (
            <g
              key={f.id}
              role="button"
              tabIndex={0}
              aria-label={`${f.name}, ${level}`}
              className="map-pin"
              onClick={() => onSelect(f.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(f.id);
                }
              }}
            >
              <title>{f.name}</title>
              <circle cx={x} cy={y} r="14" fill={color} opacity=".10" />
              <circle
                cx={x}
                cy={y}
                r={f.type === "CHC" ? 7 : 5.5}
                fill={color}
                stroke="white"
                strokeWidth="2.5"
              />
              {(facilities.length < 9 || index % 2 === 0) && (
                <text x={x + 11} y={y + 4} fontSize="9" fill="#58655c">
                  {f.name.replace(/^(PHC|CHC)\s*/, "")}
                </text>
              )}
            </g>
          );
        })}
        <g transform="translate(615,25)">
          <text x="0" y="0" fill="#98a596" fontSize="9" textAnchor="middle">
            N
          </text>
          <path d="M0 6L-4 18 0 15 4 18Z" fill="#899a87" />
        </g>
        <g transform="translate(28,308)">
          <path d="M0 0V5H70V0M35 5V0" fill="none" stroke="#9eac9b" />
          <text x="0" y="18" fill="#98a596" fontSize="8">
            SCHEMATIC / NOT TO SCALE
          </text>
        </g>
      </svg>
    </div>
  );
}
function RecordForm({
  editor,
  busy,
  error,
  tr,
  onCancel,
  onSubmit,
}: {
  editor: Editor;
  busy: boolean;
  error: string;
  tr: (key: MessageKey) => string;
  onCancel: () => void;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [localError, setLocalError] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError("");
    const form = new FormData(e.currentTarget);
    const number = (key: string) => Number(form.get(key));
    const integer = (n: number) => Number.isInteger(n) && n >= 0;
    let body: Record<string, unknown> = {};
    if (editor.kind === "inventory") {
      const quantity = number("quantity");
      const reason = String(form.get("reason") ?? "").trim();
      if (
        !integer(quantity) ||
        quantity < editor.record.reserved ||
        reason.length < 5
      ) {
        setLocalError(tr("validationError"));
        return;
      }
      body = { quantity, version: editor.record.version, reason };
    } else if (editor.kind === "beds") {
      const beds = number("beds"),
        occupied = number("occupied");
      if (!integer(beds) || !integer(occupied) || occupied > beds) {
        setLocalError(tr("bedHelp"));
        return;
      }
      body = { facilityId: editor.facility.id, beds, occupied };
    } else if (editor.kind === "doctors") {
      const presentDoctors = number("presentDoctors");
      if (
        !integer(presentDoctors) ||
        presentDoctors > editor.facility.scheduledDoctors
      ) {
        setLocalError(tr("doctorHelp"));
        return;
      }
      body = {
        facilityId: editor.facility.id,
        presentDoctors,
        attendanceRecorded: form.get("attendanceRecorded") === "on",
      };
    } else if (editor.kind === "flow") {
      const patientsToday = number("patientsToday");
      if (!integer(patientsToday)) {
        setLocalError(tr("validationError"));
        return;
      }
      body = { facilityId: editor.facility.id, patientsToday };
    } else if (editor.kind === "diagnostics") {
      body = {
        facilityId: editor.record.facilityId,
        diagnosticId: editor.record.id,
        equipment: form.get("equipment"),
        reagents: form.get("reagents") === "on",
      };
    }
    await onSubmit(body);
  }
  return (
    <form className="drawer-body record-form" onSubmit={submit}>
      <p className="form-intro">
        {tr(editor.kind === "inventory" ? "stockHelp" : "operationsHelp")}
      </p>
      {editor.kind === "inventory" && (
        <>
          <label>
            {tr("quantityLabel")}
            <input
              name="quantity"
              type="number"
              min={editor.record.reserved}
              max={10000000}
              step="1"
              defaultValue={editor.record.quantity}
              required
            />
          </label>
          <span className="form-hint">
            {tr("reserved")}: {editor.record.reserved} · {tr("version")}:{" "}
            {editor.record.version}
          </span>
          <label>
            {tr("reasonLabel")}
            <textarea
              name="reason"
              minLength={5}
              maxLength={400}
              rows={3}
              required
            />
          </label>
        </>
      )}
      {editor.kind === "beds" && (
        <>
          <label>
            {tr("bedsTotal")}
            <input
              name="beds"
              type="number"
              min="0"
              max="10000"
              step="1"
              defaultValue={editor.facility.beds}
              required
            />
          </label>
          <label>
            {tr("occupied")}
            <input
              name="occupied"
              type="number"
              min="0"
              max="10000"
              step="1"
              defaultValue={editor.facility.occupied}
              required
            />
          </label>
          <span className="form-hint">{tr("bedHelp")}</span>
        </>
      )}
      {editor.kind === "doctors" && (
        <>
          <div className="drawer-note">
            {tr("scheduled")}: {editor.facility.scheduledDoctors}
          </div>
          <label>
            {tr("present")}
            <input
              name="presentDoctors"
              type="number"
              min="0"
              max={editor.facility.scheduledDoctors}
              step="1"
              defaultValue={editor.facility.presentDoctors}
              required
            />
          </label>
          <label className="checkbox-label">
            <input
              name="attendanceRecorded"
              type="checkbox"
              defaultChecked={editor.facility.attendanceRecorded}
            />
            {tr("attendance")}
          </label>
        </>
      )}
      {editor.kind === "flow" && (
        <label>
          {tr("patientCount")}
          <input
            name="patientsToday"
            type="number"
            min="0"
            max="100000"
            step="1"
            defaultValue={editor.facility.patientsToday}
            required
          />
        </label>
      )}
      {editor.kind === "diagnostics" && (
        <>
          <label>
            {tr("equipment")}
            <select name="equipment" defaultValue={editor.record.equipment}>
              <option value="operational">{tr("operational")}</option>
              <option value="down">{tr("down")}</option>
              <option value="unknown">{tr("unknown")}</option>
            </select>
          </label>
          <label className="checkbox-label">
            <input
              name="reagents"
              type="checkbox"
              defaultChecked={editor.record.reagents}
            />
            {tr("reagents")} — {tr("yes")}
          </label>
        </>
      )}
      {(localError || error) && (
        <p className="form-error" role="alert">
          {localError || error}
        </p>
      )}
      <div className="form-actions">
        <button className="button secondary" type="button" onClick={onCancel}>
          {tr("cancel")}
        </button>
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Check size={16} />
          )}{" "}
          {tr(busy ? "saving" : "save")}
        </button>
      </div>
    </form>
  );
}

function MedicineEvidence({
  record,
  insight,
  locale,
  tr,
  date,
  fmt,
}: {
  record: Inventory;
  insight: InventoryInsight | undefined;
  locale: Locale;
  tr: (key: MessageKey) => string;
  date: (value: string) => string;
  fmt: (n: number) => string;
}) {
  const forecast = insight?.forecast;
  return (
    <section className="medicine-evidence">
      <h3>
        <Activity size={17} />
        {tr("medicineEvidence")}
      </h3>
      <p className="evidence-subtitle">
        {tr("actual")} / {tr("forecast")} · {tr("units")}
      </p>
      <DemandChart
        history={record.history}
        forecast={forecast}
        locale={locale}
        actualLabel={tr("actual")}
        forecastLabel={tr("forecast")}
        rangeLabel={tr("range")}
      />
      <div className="evidence-grid">
        <div>
          <span>{tr("method")}</span>
          <strong>{forecastMethod(forecast, tr)}</strong>
        </div>
        <div>
          <span>{tr("mae")}</span>
          <strong>
            {forecast?.mae === null || forecast?.mae === undefined
              ? "—"
              : fmt(forecast.mae)}
          </strong>
        </div>
        <div>
          <span>{tr("observations")}</span>
          <strong>{forecast?.trainingPoints ?? 0}</strong>
        </div>
        <div>
          <span>{tr("validation")}</span>
          <strong>{forecast?.validationPoints ?? 0}</strong>
        </div>
        <div>
          <span>{tr("shortageDate")}</span>
          <strong>
            {insight?.shortageDate
              ? date(insight.shortageDate)
              : tr("noEstimate")}
          </strong>
        </div>
        <div>
          <span>{tr("replenishment")}</span>
          <strong>
            {insight ? fmt(insight.replenishment) : "—"} {tr("units")}
          </strong>
        </div>
      </div>
      <p>
        {forecast?.method === "insufficient-data"
          ? tr("noHistory")
          : tr("predictionHelp")}
      </p>
      <p>{tr("maeHelp")}</p>
      <p>{tr("empiricalNote")}</p>
    </section>
  );
}
