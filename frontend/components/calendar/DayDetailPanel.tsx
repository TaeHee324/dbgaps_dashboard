"use client";
import type { CalendarEvent } from "@/lib/hooks/calendar";

const SURPRISE_LABEL: Record<number, { text: string; color: string }> = {
  1:  { text: "예상 상회", color: "#16A34A" },
  0:  { text: "예상 부합", color: "#64748B" },
  [-1]: { text: "예상 하회", color: "#DC2626" },
};

interface Props {
  date: string;
  events: CalendarEvent[];
  onClose?: () => void;
}

export function DayDetailPanel({ date, events, onClose }: Props) {
  if (!events.length) return null;

  const [, m, d] = date.split("-");
  const title = `${m}월 ${d}일 (${events.length}건)`;

  return (
    <section
      style={{
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 6,
        padding: "16px 20px",
        marginTop: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#0D253D", margin: 0 }}>{title}</h3>
        {onClose && (
          <button onClick={onClose} style={{ fontSize: 12, color: "#64748B", background: "none", border: "none", cursor: "pointer" }}>
            닫기
          </button>
        )}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
            {["시각(KST)", "중요도", "국가", "이벤트", "이전값", "예상", "실제", "상태"].map(h => (
              <th key={h} style={{ padding: "4px 8px", textAlign: "left", fontWeight: 600, color: "#64748B", whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map(ev => {
            const impStyle = ev.importance === 3
              ? { color: "#DC2626", fontWeight: 700 }
              : ev.importance === 2
              ? { color: "#D97706", fontWeight: 600 }
              : { color: "#64748B" };

            return (
              <tr key={ev.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "6px 8px", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {ev.kst_time ?? "미정"}
                </td>
                <td style={{ padding: "6px 8px", ...impStyle }}>
                  {"★".repeat(ev.importance)}
                </td>
                <td style={{ padding: "6px 8px", color: "#0D253D" }}>{ev.country ?? "—"}</td>
                <td style={{ padding: "6px 8px", color: "#0D253D", maxWidth: 260 }}>
                  <div style={{ fontWeight: 500 }}>{ev.title}</div>
                  {ev.period && <div style={{ color: "#64748B", fontSize: 11 }}>{ev.period}</div>}
                  {ev.portfolio_note && (
                    <div style={{ color: "#533AFD", fontSize: 11, marginTop: 2 }}>
                      포트폴리오: {ev.portfolio_note}
                    </div>
                  )}
                  {ev.affected_assets.length > 0 && (
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 3 }}>
                      {ev.affected_assets.map(a => (
                        <span key={a} style={{ background: "#EDE9FF", color: "#533AFD", borderRadius: 3, padding: "0 4px", fontSize: 10 }}>
                          {a}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ padding: "6px 8px", fontVariantNumeric: "tabular-nums" }}>
                  {ev.previous ?? "—"}{ev.unit ? ` ${ev.unit}` : ""}
                </td>
                <td style={{ padding: "6px 8px", fontVariantNumeric: "tabular-nums" }}>
                  {ev.forecast ?? ev.consensus ?? "—"}
                </td>
                <td style={{ padding: "6px 8px", fontVariantNumeric: "tabular-nums", fontWeight: ev.actual ? 600 : 400 }}>
                  {ev.actual ?? "—"}
                  {ev.surprise_dir !== null && ev.surprise_dir !== undefined && (
                    <span style={{ marginLeft: 4, fontSize: 10, color: SURPRISE_LABEL[ev.surprise_dir]?.color }}>
                      {SURPRISE_LABEL[ev.surprise_dir]?.text}
                    </span>
                  )}
                </td>
                <td style={{ padding: "6px 8px" }}>
                  <span style={{
                    background: ev.status === "released" ? "#DCFCE7" : "#F1F5F9",
                    color: ev.status === "released" ? "#16A34A" : "#64748B",
                    padding: "1px 6px", borderRadius: 9999, fontSize: 10,
                  }}>
                    {ev.status === "released" ? "발표완료" : ev.status === "scheduled" ? "예정" : ev.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
