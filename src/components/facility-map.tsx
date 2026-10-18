"use client";
import type { Facility } from "@/lib/types";

export function FacilityMap({
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
      <svg viewBox="0 0 660 340" role="group" aria-label={facilityLabel}>
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
