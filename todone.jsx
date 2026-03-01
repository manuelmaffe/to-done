import { useState, useEffect, useRef, useMemo } from "react";
import { supabase, signIn, signUp, signOutUser, resetPassword, getUserName, resendConfirmation } from './src/supabase.js';

/*
 * TO DONE ✦ v5
 * A11y + Dark Mode + Auth screens (no backend)
 *
 * ACCESSIBILITY FIXES:
 * 1.  aria-label on all buttons (toggle, delete, schedule, split, etc.)
 * 2.  role="checkbox" + aria-checked on task toggles & subtasks
 * 3.  :focus-visible outlines on all interactive elements
 * 4.  Contrast fixed: muted text #8A8279 on light (4.7:1), #9A9490 on dark
 * 5.  Semantic h1/h2 headings, <main>, <header>, <section>, <article>
 * 6.  Skip-to-content link
 * 7.  aria-live="polite" for suggestions, task counts, announcements
 * 8.  Keyboard reorder: Alt+↑/↓ on focused task
 * 9.  @media prefers-reduced-motion: reduce
 * 10. aria-hidden on decorative emojis/confetti, sr-only text alternatives
 * 11. All inputs have labels (aria-label or <label>)
 * 12. Color never sole indicator: priority always has text label
 * 13. Dark mode via CSS custom properties + prefers-color-scheme
 * 14. Form landmark on add-task panel
 * 15. Escape key closes modals/panels
 */

// ============================================================
// CONSTANTS & HELPERS
// ============================================================
const PRIORITIES = { high: "Alta", medium: "Media", low: "Baja" };
const EFFORT_OPTIONS = [15, 30, 60, 120, 180, 240];
const WORKDAY_MINUTES = 480;

function fmt(min) {
  if (!min) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  if (min >= 480) return `${Math.round(min / 480 * 10) / 10}d`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function fmtS(min) {
  if (!min) return "?";
  if (min < 60) return `${min}m`;
  if (min >= 480) return `${Math.round(min / 60)}h`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h${m}` : `${h}h`;
}

// ============================================================
// AI SUGGEST
// ============================================================
function aiSuggest(text) {
  const lo = text.toLowerCase().trim();
  let pr = null, prR = "", sc = null, scR = "", mn = null, mnR = "";
  if (/\b(urgente|importante|crítico|asap|ya|deadline|vence|expira|jefe|cliente|inversores?|board)\b/i.test(lo)) { pr = "high"; prR = "Detecté urgencia"; }
  else if (/\b(presentación|propuesta|contrato|factura|pago|emergencia|error|bug|caído|roto)\b/i.test(lo)) { pr = "high"; prR = "Contexto importante"; }
  else if (/\b(cuando pueda|algún día|eventualmente|no urge|tranqui|opcional|si puedo)\b/i.test(lo)) { pr = "low"; prR = "No parece urgente"; }
  if (/\b(hoy|today|ahora|ya mismo|esta tarde|esta mañana)\b/i.test(lo)) { sc = "hoy"; scR = "Mencionás hoy"; }
  else if (/\b(mañana|tomorrow)\b/i.test(lo)) { sc = "mañana"; scR = "Mencionás mañana"; }
  else if (/\b(esta semana|this week|estos días)\b/i.test(lo)) { sc = "semana"; scR = "Esta semana"; }
  else if (/\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/i.test(lo)) { const m = lo.match(/\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/i); if (m) { sc = "semana"; scR = `Mencionás ${m[1]}`; } }
  else if (/\b(semana que viene|próxima semana)\b/i.test(lo)) { sc = "semana"; scR = "Próxima semana"; }
  else if (pr === "high" && !sc) { sc = "hoy"; scR = "Es urgente → hoy"; }
  if (/\b(llamar|contestar|responder|enviar|mandar|confirmar|comprar|chequear)\b/i.test(lo)) { if (/\b(email|mail|mensaje|whatsapp)\b/i.test(lo)) { mn = 5; mnR = "Mensaje rápido"; } else if (/\b(llamar|call)\b/i.test(lo)) { mn = 15; mnR = "Llamada típica"; } else { mn = 10; mnR = "Tarea rápida"; } }
  else if (/\b(presentación|informe|reporte|propuesta|proyecto|estrategia|auditoría)\b/i.test(lo)) { mn = /\b(presentación|propuesta)\b/i.test(lo) ? 180 : 240; mnR = mn === 180 ? "Presentación compleja" : "Documento largo"; }
  else if (/\b(preparar|armar|escribir|diseñar|desarrollar|crear|investigar|programar|planificar|redactar)\b/i.test(lo)) { mn = /\b(diseñar|desarrollar|programar)\b/i.test(lo) ? 120 : 90; mnR = mn === 120 ? "Trabajo técnico" : "Requiere preparación"; }
  else if (/\b(revisar|leer|analizar|reunión|meeting|call|sync|entrevista)\b/i.test(lo)) { mn = /\b(reunión|meeting|call|sync)\b/i.test(lo) ? 45 : 30; mnR = mn === 45 ? "Reunión estándar" : "Revisión/análisis"; }
  const tm = lo.match(/(\d+)\s*(min(?:utos?)?|h(?:oras?)?|hora)/i);
  if (tm) { const v = parseInt(tm[1]); if (tm[2].toLowerCase().startsWith("h")) { mn = v * 60; mnR = `Mencionás ${v}h`; } else { mn = v; mnR = `Mencionás ${v} min`; } }
  let cl = text.trim();
  [/\b(urgente|importante|crítico|asap|ya|cuando pueda|algún día|eventualmente|no urge|tranqui|opcional|si puedo)\b/gi, /\b(hoy|today|ahora|ya mismo|esta tarde|esta mañana|mañana|tomorrow)\b/gi, /\b(esta semana|this week|estos días|semana que viene|próxima semana)\b/gi, /\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b/gi, /\d+\s*(min(?:utos?)?|h(?:oras?)?|hora)\b/gi].forEach(p => { cl = cl.replace(p, ""); });
  cl = cl.replace(/\s+/g, " ").replace(/^[\s,\-·]+|[\s,\-·]+$/g, "").trim();
  return { cleanText: cl || text.trim(), priority: pr, priorityReason: prR, scheduledFor: sc, scheduleReason: scR, minutes: mn, minutesReason: mnR, hasAny: !!(pr || sc || mn) };
}

// ============================================================
// SOUNDS
// ============================================================
function playComplete() { try { const c = new (window.AudioContext || window.webkitAudioContext)(); [523.25, 659.25, 783.99].forEach((f, i) => { const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = f; o.type = "sine"; g.gain.setValueAtTime(0, c.currentTime + i * .08); g.gain.linearRampToValueAtTime(.12, c.currentTime + i * .08 + .04); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + i * .08 + .5); o.start(c.currentTime + i * .08); o.stop(c.currentTime + i * .08 + .5); }); } catch (e) { } }
function playAdd() { try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; o.type = "sine"; g.gain.setValueAtTime(.08, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .15); o.start(); o.stop(c.currentTime + .15); } catch (e) { } }
function playClick() { try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 600; o.type = "triangle"; g.gain.setValueAtTime(.05, c.currentTime); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .06); o.start(); o.stop(c.currentTime + .06); } catch (e) { } }

// ============================================================
// THEME
// ============================================================
const themes = {
  light: {
    bg: "linear-gradient(160deg, #FFF8F0 0%, #FFF1E6 30%, #FEEBD6 70%, #FDE8D0 100%)",
    card: "#FFFAF5", cardDone: "rgba(129,178,154,0.04)", cardDrag: "#FFF5ED",
    surface: "#FFFFFF", text: "#3D405B", textSec: "#505870",
    textMuted: "#685E5A", textFaint: "#8A8690",
    border: "rgba(224,122,95,0.07)", borderDone: "rgba(129,178,154,0.1)",
    inputBg: "#FAFAFA", inputBorder: "#E5E7EB", barBg: "#F0E6DB",
    overlay: "rgba(0,0,0,0.06)", focusRing: "#E07A5F", placeholder: "#B8B0A6",
    panelBg: "#FFFFFF", panelShadow: "0 -4px 30px rgba(0,0,0,0.1)",
  },
  dark: {
    bg: "linear-gradient(160deg, #1A1B1E 0%, #1E1F23 30%, #22232A 70%, #1A1B1E 100%)",
    card: "#26272D", cardDone: "rgba(129,178,154,0.06)", cardDrag: "#2E2A25",
    surface: "#2A2B31", text: "#E8E4DF", textSec: "#C8C0B5",
    textMuted: "#AEA9A2", textFaint: "#7E7A76",
    border: "rgba(224,122,95,0.15)", borderDone: "rgba(129,178,154,0.15)",
    inputBg: "#2A2B31", inputBorder: "#3A3B41", barBg: "#3A3530",
    overlay: "rgba(255,255,255,0.06)", focusRing: "#E6AA68", placeholder: "#6B6560",
    panelBg: "#26272D", panelShadow: "0 -4px 30px rgba(0,0,0,0.5)",
  }
};

// ============================================================
// DATA
// ============================================================
const initialTasks = [
  { id: 1, text: "Preparar presentación para inversores", priority: "high", minutes: 180, done: false, doneAt: null, createdAt: Date.now() - 86400000, subtasks: [], scheduledFor: "hoy", order: 0 },
  { id: 2, text: "Revisar métricas de NPS del mes", priority: "medium", minutes: 45, done: false, doneAt: null, createdAt: Date.now() - 43200000, subtasks: [], scheduledFor: "hoy", order: 1 },
  { id: 3, text: "Contestar emails pendientes", priority: "low", minutes: 15, done: false, doneAt: null, createdAt: Date.now() - 3600000, subtasks: [], scheduledFor: "hoy", order: 2 },
  { id: 4, text: "Llamar a cliente Andreani", priority: "high", minutes: 15, done: false, doneAt: null, createdAt: Date.now() - 7200000, subtasks: [], scheduledFor: "hoy", order: 3 },
  { id: 5, text: "Actualizar roadmap Q2", priority: "medium", minutes: 120, done: false, doneAt: null, createdAt: Date.now() - 100000000, subtasks: [], scheduledFor: "semana", order: 4 },
  { id: 6, text: "Diseñar nueva landing page", priority: "medium", minutes: 240, done: false, doneAt: null, createdAt: Date.now() - 80000000, subtasks: [], scheduledFor: "semana", order: 5 },
  { id: 7, text: "Investigar competencia en Brasil", priority: "low", minutes: 90, done: false, doneAt: null, createdAt: Date.now() - 120000000, subtasks: [], scheduledFor: "semana", order: 6 },
  { id: 8, text: "Comprar café", priority: "low", minutes: 10, done: true, doneAt: Date.now() - 50000, createdAt: Date.now() - 150000000, subtasks: [], scheduledFor: null, order: 98 },
  { id: 9, text: "Enviar propuesta a MercadoLibre", priority: "high", minutes: 60, done: true, doneAt: Date.now() - 20000, createdAt: Date.now() - 200000000, subtasks: [], scheduledFor: null, order: 99 },
];
const celebrations = ["🎉", "✨", "🚀", "💫", "⭐", "🔥", "💪", "🎯", "👏", "🌟"];

// ============================================================
// SMALL COMPONENTS
// ============================================================
function SrOnly({ children }) {
  return <span style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap", border: 0 }}>{children}</span>;
}

function Confetti({ active }) {
  const [p, setP] = useState([]);
  useEffect(() => { if (active) { setP(Array.from({ length: 24 }, (_, i) => ({ id: i, style: { position: "fixed", width: `${Math.random() * 8 + 4}px`, height: `${Math.random() * 8 + 4}px`, backgroundColor: ["#E07A5F", "#E6AA68", "#81B29A", "#56CCF2", "#BB6BD9", "#F2C94C"][Math.floor(Math.random() * 6)], borderRadius: Math.random() > .5 ? "50%" : "2px", left: `${Math.random() * 100}vw`, top: "-10px", zIndex: 9999, animation: `confettiFall ${1.5 + Math.random() * 1.5}s ease-out forwards`, animationDelay: `${Math.random() * .3}s` } }))); setTimeout(() => setP([]), 3000); } }, [active]);
  return <div aria-hidden="true">{p.map(x => <div key={x.id} style={x.style} />)}</div>;
}

const STREAK_TIPS = [
  "Hacé la tarea más difícil antes de las 11am. El cerebro está más alerta de mañana.",
  "Dividí las tareas grandes en pasos de 30 min — empezar es más fácil que terminar.",
  "Planificá el día siguiente antes de cerrar la app. Le ahorrás decisiones a tu yo del mañana.",
  "Hacé primero lo que más posponés. Todo lo demás fluye solo después.",
  "Bloqueá tiempo en el calendario para tus tareas más importantes. Lo urgente siempre interrumpe.",
  "Una tarea a la vez. El multitasking reduce la productividad hasta un 40%.",
  "Si algo tarda menos de 2 minutos, hacelo ahora. No lo agendés.",
];
function KindStreak({ tasks, T }) {
  const [hov, setHov] = useState(false);
  const { streak, dayMap } = useMemo(() => {
    const n = new Date();
    const map = {};
    for (let i = 0; i < 35; i++) {
      const d = new Date(n); d.setDate(n.getDate() - i);
      const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      map[ds] = tasks.filter(t => t.done && t.doneAt && t.doneAt >= ds && t.doneAt < ds + 86400000).length;
    }
    let s = 0;
    for (let i = 0; i < 35; i++) {
      const d = new Date(n); d.setDate(n.getDate() - i);
      const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      if (map[ds] > 0) s++; else if (i > 0) break;
    }
    return { streak: s, dayMap: map };
  }, [tasks]);
  if (streak < 1) return null;
  const msgs = [{ min: 1, t: "¡Primer día!", e: "🌱" }, { min: 2, t: `${streak} días seguidos`, e: "🌿" }, { min: 5, t: `¡${streak} días!`, e: "🌳" }, { min: 10, t: `${streak} días. Imparable.`, e: "🔥" }, { min: 20, t: `${streak}d. Leyenda.`, e: "👑" }];
  const m = [...msgs].reverse().find(x => streak >= x.min) || msgs[0];
  const days = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (34 - i));
    const ds = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return { ts: ds, count: dayMap[ds] || 0, isToday: i === 34 };
  });
  const tip = STREAK_TIPS[streak % STREAK_TIPS.length];
  return (
    <div style={{ position: "relative", marginBottom: "12px" }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div role="status" aria-label={`Racha: ${m.t}`} style={{ display: "flex", alignItems: "center", gap: "8px", background: "linear-gradient(135deg, rgba(129,178,154,0.1), rgba(230,170,104,0.06))", borderRadius: "12px", padding: "8px 14px", fontSize: "14px", color: "#81B29A", fontWeight: 600, cursor: "default" }}>
        <span aria-hidden="true" style={{ fontSize: "18px" }}>{m.e}</span>
        <span>{m.t}</span>
        <div aria-hidden="true" style={{ display: "flex", gap: "2px", marginLeft: "auto" }}>{Array.from({ length: Math.min(streak, 7) }, (_, i) => <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "linear-gradient(135deg, #81B29A, #6FCF97)", opacity: .4 + (i / 7) * .6 }} />)}</div>
        <span style={{ fontSize: "10px", color: "#81B29A", opacity: 0.6 }}>›</span>
      </div>
      {hov && T && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: T.surface, borderRadius: "14px", padding: "14px 16px", border: `1px solid ${T.border}`, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", zIndex: 100, animation: "slideDown 0.18s ease" }}>
          <p style={{ fontSize: "10px", fontWeight: 700, color: "#81B29A", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "10px" }}>Últimos 35 días</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "14px" }}>
            {days.map((day, i) => (
              <div key={i} title={new Date(day.ts).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" })}
                style={{ aspectRatio: "1", borderRadius: "4px", background: day.count > 0 ? `rgba(129,178,154,${Math.min(0.25 + day.count * 0.25, 1)})` : T.overlay, outline: day.isToday ? "1.5px solid #81B29A" : "none", outlineOffset: "1px" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", borderTop: `1px solid ${T.border}`, paddingTop: "12px" }}>
            <span style={{ fontSize: "14px", flexShrink: 0 }}>✦</span>
            <p style={{ fontSize: "12px", color: T.textSec, lineHeight: 1.55, fontWeight: 500 }}>{tip}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TimeBar({ total, done, T }) {
  const pct = Math.min((total / WORKDAY_MINUTES) * 100, 100);
  const donePct = total > 0 ? Math.min((done / total) * 100, 100) * (pct / 100) : 0;
  const over = total > WORKDAY_MINUTES;
  return (
    <div role="status" aria-label={`Hoy: ${fmt(done) || "0 min"} de ${fmt(total)} planeadas`} style={{ marginBottom: "4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "13px", color: T.textMuted, fontWeight: 500 }}>{fmt(done) || "0 min"} hechas de {fmt(total)} plan.</span>
        {over && <span style={{ fontSize: "13px", color: "#E07A5F", fontWeight: 700 }}>+{fmt(total - WORKDAY_MINUTES)} sobre 8h</span>}
      </div>
      <div role="progressbar" aria-valuenow={Math.round(donePct)} aria-valuemin={0} aria-valuemax={100} style={{ height: "6px", borderRadius: "3px", background: T.barBg, position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: "3px", background: over ? "linear-gradient(90deg, #E6AA68, #E07A5F)" : "linear-gradient(90deg, #E6AA68, #81B29A)", width: `${pct}%`, transition: "width 0.6s ease", opacity: 0.25 }} />
        <div style={{ position: "absolute", left: 0, top: 0, height: "100%", borderRadius: "3px", background: "linear-gradient(90deg, #81B29A, #6FCF97)", width: `${donePct}%`, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function TodayCard({ total, done, taskCount, T }) {
  const r = 22, circ = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(done / total, 1) : 0;
  const allDone = taskCount > 0 && pct >= 1;
  return (
    <div style={{ background: T.surface, borderRadius: "20px", padding: "16px 20px", marginBottom: "16px", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "10px", color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "6px" }}>Plan de hoy</p>
        <p style={{ fontSize: "34px", fontWeight: 800, color: T.text, lineHeight: 1, letterSpacing: "-1.5px" }}>{fmt(total) || "—"}</p>
        <p style={{ fontSize: "12px", color: T.textMuted, marginTop: "6px", fontWeight: 500 }}>
          {done > 0 ? <><span style={{ color: "#81B29A", fontWeight: 700 }}>{fmt(done)}</span> completadas · </> : ""}{taskCount} tarea{taskCount !== 1 ? "s" : ""}
        </p>
      </div>
      <svg width="60" height="60" style={{ flexShrink: 0 }} aria-hidden="true">
        <circle cx="30" cy="30" r={r} fill="none" stroke={T.barBg} strokeWidth="5" />
        <circle cx="30" cy="30" r={r} fill="none" stroke={allDone ? "#81B29A" : "#E07A5F"} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round" transform="rotate(-90 30 30)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }} />
        <text x="30" y="34" textAnchor="middle" fontSize="11" fontWeight="700" fill={T.textSec}>{Math.round(pct * 100)}%</text>
      </svg>
    </div>
  );
}

function AIChip({ label, value, reason, onAccept, onDismiss, color, T }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <div role="group" aria-label={`Sugerencia: ${label} ${value}`} style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: `${color}10`, border: `1px solid ${color}20`, borderRadius: "20px", padding: "3px 5px 3px 10px", fontSize: "11px", animation: "fadeInUp 0.25s ease" }}>
      <span style={{ color: T.textFaint, fontWeight: 500 }}>✨ {label}:</span>
      <span style={{ color, fontWeight: 700 }}>{value}</span>
      <span style={{ color: T.textFaint, fontSize: "9px", fontStyle: "italic" }}>({reason})</span>
      <button onClick={() => { onAccept(); playClick(); }} aria-label={`Aceptar: ${label} ${value}`} style={{ background: color, color: "white", border: "none", borderRadius: "50%", width: "20px", height: "20px", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✓</button>
      <button onClick={() => { setGone(true); onDismiss(); playClick(); }} aria-label={`Descartar: ${label}`} style={{ background: T.overlay, color: T.textMuted, border: "none", borderRadius: "50%", width: "20px", height: "20px", fontSize: "11px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
    </div>
  );
}

// ============================================================
// TASK ITEM
// ============================================================
function TaskItem({ task, onToggle, onDelete, onSplit, onAddSub, onSchedule, onDefer, onMove, onUpdateText, onDelegate, onUnshare, isDragging, dragOver, T, autoSplit }) {
  const [showSplit, setShowSplit] = useState(false);
  useEffect(() => { if (autoSplit) { setShowSplit(true); } }, [autoSplit]);
  const [splitText, setSplitText] = useState("");
  const [justDone, setJustDone] = useState(false);
  const [celeb, setCeleb] = useState("");
  const [editingText, setEditingText] = useState(false);
  const [localEditText, setLocalEditText] = useState(task.text);
  const [editingSubIdx, setEditingSubIdx] = useState(null);
  const [subEditText, setSubEditText] = useState("");
  const [showDelegate, setShowDelegate] = useState(false);
  const [delegateEmail, setDelegateEmail] = useState("");
  const [delegateLoading, setDelegateLoading] = useState(false);
  const [delegateMsg, setDelegateMsg] = useState(null);
  const editRef = useRef(null);
  const ref = useRef(null);
  const pc = task.priority === "high" ? "#E07A5F" : task.priority === "medium" ? "#E6AA68" : "#81B29A";

  const handleToggle = () => {
    if (!task.done) { setJustDone(true); setCeleb(celebrations[Math.floor(Math.random() * celebrations.length)]); playComplete(); setTimeout(() => { setJustDone(false); }, 1200); }
    else playClick();
    onToggle(task.id);
  };

  return (
    <article aria-label={`${task.text}${task.done ? ", completada" : ""}`} tabIndex={task.done ? -1 : 0}
      onKeyDown={e => { if (task.done) return; if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); onMove(task.id, -1); } if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); onMove(task.id, 1); } }}
      style={{
        background: task.done ? T.cardDone : isDragging ? T.cardDrag : T.card,
        borderRadius: "14px", padding: task.done ? "10px 16px" : "14px 18px", marginBottom: "6px",
        border: `1.5px solid ${isDragging ? "#E6AA68" : task.done ? T.borderDone : T.border}`,
        transition: isDragging ? "none" : "all 0.35s cubic-bezier(0.4,0,0.2,1)",
        transform: justDone ? "scale(1.02)" : isDragging ? "scale(1.03)" : "scale(1)",
        boxShadow: isDragging ? "0 8px 30px rgba(224,122,95,0.15)" : "0 1px 2px rgba(0,0,0,0.02)",
        opacity: task.done ? .5 : 1, cursor: task.done ? "default" : "grab", userSelect: "none",
        borderTop: dragOver ? "2.5px solid #E6AA68" : "2.5px solid transparent", outline: "none",
      }}>
      {justDone && <div aria-hidden="true" style={{ position: "absolute", top: "50%", right: "16px", transform: "translateY(-50%)", fontSize: "26px", animation: "popIn 0.5s cubic-bezier(0.68,-0.55,0.27,1.55)" }}>{celeb}</div>}
      <div style={{ display: "flex", alignItems: "flex-start", gap: task.done ? "8px" : "12px" }}>
        {!task.done && <div aria-hidden="true" style={{ paddingTop: "5px", opacity: .2, flexShrink: 0 }}><div style={{ width: "10px", display: "flex", flexWrap: "wrap", gap: "2px" }}>{[0, 1, 2, 3, 4, 5].map(i => <div key={i} style={{ width: "3px", height: "3px", borderRadius: "50%", background: T.textFaint }} />)}</div></div>}
        <button role="checkbox" aria-checked={task.done} aria-label={task.done ? `Desmarcar: ${task.text}` : `Completar: ${task.text}`} onClick={handleToggle}
          style={{ width: task.done ? "18px" : "22px", height: task.done ? "18px" : "22px", borderRadius: "50%", flexShrink: 0, border: `2px solid ${task.done ? "#81B29A" : pc}`, background: task.done ? "#81B29A" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "2px" }}>
          {task.done && <svg aria-hidden="true" width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {editingText ? (
              <input ref={editRef} value={localEditText} onChange={e => setLocalEditText(e.target.value)}
                onBlur={() => { const v = localEditText.trim(); if (v && v !== task.text) onUpdateText(task.id, v); else setLocalEditText(task.text); setEditingText(false); }}
                onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setLocalEditText(task.text); setEditingText(false); } }}
                style={{ fontSize: "16px", fontWeight: 500, color: T.text, background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: "8px", padding: "2px 8px", outline: "none", flex: 1, fontFamily: "'DM Sans', sans-serif" }} />
            ) : (
              <span onClick={() => { if (!task.done) { setEditingText(true); setLocalEditText(task.text); setTimeout(() => editRef.current?.focus(), 0); } }}
                style={{ fontSize: task.done ? "15px" : "16px", fontWeight: 500, color: task.done ? T.textFaint : T.text, textDecoration: task.done ? "line-through" : "none", lineHeight: 1.4, flex: 1, cursor: task.done ? "default" : "text" }}>{task.text}</span>
            )}
            {!task.done && task.minutes && <span aria-label={`${fmt(task.minutes)}`} style={{ fontSize: "12px", fontWeight: 700, color: T.textFaint, background: T.overlay, padding: "3px 10px", borderRadius: "8px", flexShrink: 0, whiteSpace: "nowrap" }}><span aria-hidden="true">🕐</span> {fmtS(task.minutes)}</span>}
          </div>
          {!task.done && (
            <div style={{ display: "flex", gap: "5px", marginTop: "6px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: pc, background: `${pc}15`, padding: "3px 10px", borderRadius: "20px", textTransform: "uppercase" }}>{PRIORITIES[task.priority]}</span>
              {!task.scheduledFor && <button onClick={() => { onSchedule(task.id, "hoy"); }} aria-label={`Agendar para hoy: ${task.text}`} style={{ fontSize: "12px", color: T.textMuted, background: T.overlay, border: `1px solid ${T.inputBorder}`, padding: "3px 10px", borderRadius: "20px", cursor: "pointer", fontWeight: 600 }}>+ Hoy</button>}
              {task.scheduledFor === "hoy" && <button onClick={() => { onDefer(task.id); }} aria-label={`Dejar para después: ${task.text}`} style={{ fontSize: "12px", color: "#9B6DB5", background: "rgba(155,109,181,0.12)", border: "1px solid rgba(155,109,181,0.3)", padding: "3px 10px", borderRadius: "20px", cursor: "pointer", fontWeight: 700 }}>Después</button>}
              {task.scheduledFor === "semana" && <button onClick={() => { onSchedule(task.id, "hoy"); }} aria-label={`Mover a hoy: ${task.text}`} style={{ fontSize: "12px", color: "#3B9EC4", background: "rgba(86,204,242,0.12)", border: "1px solid rgba(86,204,242,0.3)", padding: "3px 10px", borderRadius: "20px", cursor: "pointer", fontWeight: 700 }}>→ Hoy</button>}
              {task.minutes >= 120 && task.subtasks.length === 0 && <button onClick={e => { e.stopPropagation(); setShowSplit(!showSplit); }} aria-label={`Dividir: ${task.text}`} style={{ fontSize: "12px", color: "#BB6BD9", background: "rgba(187,107,217,0.08)", border: "1px solid rgba(187,107,217,0.2)", padding: "3px 10px", borderRadius: "20px", cursor: "pointer", fontWeight: 700 }}><span aria-hidden="true">🧩</span> Dividir</button>}
              {task.subtasks.length === 0 && !showSplit && <button onClick={e => { e.stopPropagation(); setShowSplit(true); }} aria-label={`Agregar subtarea a: ${task.text}`} style={{ fontSize: "12px", color: T.textMuted, background: T.overlay, border: `1px solid ${T.inputBorder}`, padding: "3px 10px", borderRadius: "20px", cursor: "pointer", fontWeight: 600 }}>+ Sub</button>}
            </div>
          )}
          {!task.done && task.subtasks.length > 0 && (
            <ul role="list" aria-label="Subtareas" style={{ marginTop: "8px", paddingLeft: 0, listStyle: "none" }}>
              {task.subtasks.map((st, i) => (
                <li key={i} role="checkbox" aria-checked={st.done} tabIndex={0}
                  onKeyDown={e => { if ((e.key === "Enter" || e.key === " ") && editingSubIdx !== i) { e.preventDefault(); const ns = [...task.subtasks]; ns[i] = { ...ns[i], done: !ns[i].done }; onSplit(task.id, ns); } }}
                  style={{ fontSize: "14px", color: st.done ? T.textFaint : T.textSec, padding: "3px 0", display: "flex", alignItems: "center", gap: "7px", textDecoration: editingSubIdx === i ? "none" : st.done ? "line-through" : "none", cursor: "default" }}>
                  <span aria-hidden="true" onClick={() => { const ns = [...task.subtasks]; ns[i] = { ...ns[i], done: !ns[i].done }; onSplit(task.id, ns); }}
                    style={{ width: "14px", height: "14px", borderRadius: "50%", flexShrink: 0, border: `1.5px solid ${st.done ? "#81B29A" : T.inputBorder}`, background: st.done ? "#81B29A" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    {st.done && <svg width="7" height="7" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </span>
                  {editingSubIdx === i ? (
                    <input autoFocus value={subEditText} onChange={e => setSubEditText(e.target.value)}
                      onBlur={() => { const v = subEditText.trim(); if (v && v !== st.text) { const ns = [...task.subtasks]; ns[i] = { ...ns[i], text: v }; onSplit(task.id, ns); } setEditingSubIdx(null); }}
                      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") setEditingSubIdx(null); }}
                      style={{ fontSize: "14px", color: T.text, background: T.inputBg, border: `1px solid ${T.inputBorder}`, borderRadius: "6px", padding: "1px 6px", outline: "none", flex: 1, fontFamily: "'DM Sans', sans-serif" }} />
                  ) : (
                    <span onClick={() => { if (!st.done) { setEditingSubIdx(i); setSubEditText(st.text); } }}
                      style={{ flex: 1, cursor: st.done ? "default" : "text" }}>{st.text}</span>
                  )}
                </li>
              ))}
              <li style={{ listStyle: "none" }}><input ref={ref} aria-label={`Agregar subtarea a ${task.text}`} value={splitText} onChange={e => setSplitText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && splitText.trim()) { onAddSub(task.id, splitText.trim()); setSplitText(""); playAdd(); } }} placeholder="+ subtarea..." style={{ width: "100%", fontSize: "13px", padding: "5px 8px", borderRadius: "8px", border: `1px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, marginTop: "4px" }} /></li>
            </ul>
          )}
          {showSplit && !task.done && task.subtasks.length === 0 && (
            <div style={{ marginTop: "8px", animation: "slideDown 0.3s ease" }}>
              <input autoFocus aria-label={`Primera subtarea de: ${task.text}`} value={splitText} onChange={e => setSplitText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && splitText.trim()) { onAddSub(task.id, splitText.trim()); setSplitText(""); playAdd(); }
                  if (e.key === "Escape") { setShowSplit(false); setSplitText(""); }
                }}
                onBlur={() => { if (!splitText.trim()) setShowSplit(false); }}
                placeholder="Primera subtarea... (Enter · Esc para cerrar)" style={{ width: "100%", fontSize: "14px", padding: "7px 10px", borderRadius: "10px", border: "1.5px solid rgba(187,107,217,0.2)", background: "rgba(187,107,217,0.03)", outline: "none", color: T.text, boxSizing: "border-box" }} />
            </div>
          )}
        </div>
        {!task.done && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
            {!task.isShared && (
              <button onClick={() => { setShowDelegate(v => !v); setDelegateMsg(null); setDelegateEmail(""); }} aria-label="Delegar tarea"
                style={{ background: showDelegate ? "rgba(224,122,95,0.12)" : "none", border: "none", cursor: "pointer", padding: "4px 6px", color: showDelegate ? "#E07A5F" : T.textFaint, fontSize: "13px", lineHeight: 1, borderRadius: "8px", fontWeight: 600 }}>
                ↗
              </button>
            )}
            <button
              onClick={() => task.isShared ? onUnshare(task.id) : onDelete(task.id)}
              aria-label={task.isShared ? "Quitar tarea compartida" : `Eliminar: ${task.text}`}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: T.textFaint, fontSize: "20px", lineHeight: 1, flexShrink: 0 }}>
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}
      </div>

      {/* Delegation badges */}
      {task.sharedFromEmail && (
        <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "#9B6DB5", background: "rgba(155,109,181,0.1)", border: "1px solid rgba(155,109,181,0.2)", padding: "2px 10px", borderRadius: "20px", fontWeight: 600 }}>
            De: {task.sharedFromName || task.sharedFromEmail}
          </span>
        </div>
      )}
      {task.assigneeEmail && !task.isShared && (
        <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "11px", color: "#3B9EC4", background: "rgba(86,204,242,0.1)", border: "1px solid rgba(86,204,242,0.2)", padding: "2px 10px", borderRadius: "20px", fontWeight: 600 }}>
            → {task.assigneeEmail}
          </span>
        </div>
      )}

      {/* Delegate panel */}
      {showDelegate && !task.isShared && !task.done && (
        <div style={{ marginTop: "10px", padding: "12px 14px", background: T.overlay, borderRadius: "12px", animation: "slideDown 0.2s ease" }}>
          <p style={{ fontSize: "12px", color: T.textMuted, fontWeight: 600, marginBottom: "8px" }}>Delegar a</p>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              autoFocus
              type="email"
              value={delegateEmail}
              onChange={e => { setDelegateEmail(e.target.value); setDelegateMsg(null); }}
              onKeyDown={e => { if (e.key === "Escape") { setShowDelegate(false); setDelegateEmail(""); } }}
              placeholder="email@ejemplo.com"
              style={{ flex: 1, fontSize: "13px", padding: "7px 10px", borderRadius: "10px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, fontFamily: "'DM Sans', sans-serif" }}
            />
            <button
              disabled={!delegateEmail.includes("@") || delegateLoading}
              onClick={async () => {
                setDelegateLoading(true);
                const result = await onDelegate(task.id, delegateEmail.trim().toLowerCase());
                setDelegateLoading(false);
                if (result.ok) {
                  setDelegateMsg({ type: "ok", text: result.status === "shared" ? "Tarea compartida ✓" : "Invitación enviada ✓" });
                  setTimeout(() => { setShowDelegate(false); setDelegateMsg(null); }, 2000);
                } else {
                  setDelegateMsg({ type: "err", text: result.error || "Error al delegar" });
                }
              }}
              style={{ padding: "7px 14px", borderRadius: "10px", border: "none", background: delegateEmail.includes("@") && !delegateLoading ? "linear-gradient(135deg, #E07A5F, #E6AA68)" : T.inputBorder, color: delegateEmail.includes("@") && !delegateLoading ? "white" : T.textFaint, fontSize: "13px", fontWeight: 700, cursor: delegateEmail.includes("@") && !delegateLoading ? "pointer" : "default", whiteSpace: "nowrap" }}>
              {delegateLoading ? "…" : "Enviar"}
            </button>
          </div>
          {delegateMsg && (
            <p role="alert" style={{ margin: "6px 0 0", fontSize: "12px", fontWeight: 600, color: delegateMsg.type === "ok" ? "#81B29A" : "#E07A5F" }}>
              {delegateMsg.text}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

// ============================================================
// AUTH SCREENS
// ============================================================
function AuthScreen({ onLogin, dark, setDark }) {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const T = dark ? themes.dark : themes.light;

  const handleResend = async () => {
    setResendLoading(true);
    try { await resendConfirmation(email); setResendSent(true); }
    catch (e) { /* silently ignore */ }
    finally { setResendLoading(false); }
  };

  const validate = () => {
    const e = {};
    if (mode === "register" && !name.trim()) e.name = "Ingresá tu nombre";
    if (!email.trim()) e.email = "Ingresá tu email";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Email no válido";
    if (mode !== "forgot") {
      if (!pass) e.pass = "Ingresá tu contraseña";
      else if (pass.length < 6) e.pass = "Mínimo 6 caracteres";
    }
    if (mode === "register" && pass !== passConfirm) e.passConfirm = "Las contraseñas no coinciden";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      if (mode === "forgot") {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setSuccess("Te enviamos un email para restablecer tu contraseña");
      } else if (mode === "login") {
        const { data, error } = await signIn(email, pass);
        if (error) throw error;
        onLogin(data.user);
      } else {
        const { data, error } = await signUp(email, pass, name || email.split("@")[0]);
        if (error) throw error;
        if (data.user && !data.session) {
          setMode("verify");
        } else {
          onLogin(data.user);
        }
      }
    } catch (err) {
      setErrors({ general: err.message });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    width: "100%", fontSize: "15px", padding: "14px 16px", borderRadius: "14px",
    border: `1.5px solid ${errors[field] ? "#E07A5F" : T.inputBorder}`,
    background: T.inputBg, outline: "none", color: T.text, fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.2s ease",
  });
  const labelStyle = { fontSize: "12px", fontWeight: 600, color: T.textMuted, display: "block", marginBottom: "6px" };
  const errorStyle = { fontSize: "11px", color: "#E07A5F", marginTop: "4px", fontWeight: 500 };

  // ── Verify pending screen ──────────────────────────────────────────────────
  if (mode === "verify") {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap');
          @keyframes fadeInUp{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
          *{box-sizing:border-box;margin:0;padding:0}
          *:focus-visible{outline:2px solid ${T.focusRing};outline-offset:2px;border-radius:4px;}
        `}</style>
        <div style={{ width: "100%", maxWidth: "400px", animation: "fadeInUp 0.5s ease" }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "42px", fontWeight: 800, color: T.text, letterSpacing: "-1px" }}>
              to <span style={{ background: "linear-gradient(135deg, #E07A5F, #E6AA68)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>done</span>
              <span aria-hidden="true" style={{ fontSize: "10px", verticalAlign: "super", color: "#E07A5F", WebkitTextFillColor: "#E07A5F", marginLeft: "2px" }}>✦</span>
            </h1>
          </div>
          <div style={{ background: T.surface, borderRadius: "20px", padding: "36px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: `1px solid ${T.border}`, textAlign: "center" }}>
            <div aria-hidden="true" style={{ fontSize: "52px", marginBottom: "16px", lineHeight: 1 }}>📬</div>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: T.text, marginBottom: "10px" }}>Revisá tu email</h2>
            <p style={{ fontSize: "13px", color: T.textMuted, lineHeight: 1.6, marginBottom: "6px" }}>Te enviamos un link de confirmación a</p>
            <p style={{ fontSize: "14px", fontWeight: 700, color: T.text, marginBottom: "16px", wordBreak: "break-all" }}>{email}</p>
            <p style={{ fontSize: "13px", color: T.textMuted, lineHeight: 1.6, marginBottom: "28px" }}>
              Hacé click en el enlace del email para activar tu cuenta.<br />La app se va a abrir automáticamente.
            </p>
            {resendSent ? (
              <p role="alert" style={{ fontSize: "13px", color: "#81B29A", fontWeight: 600, marginBottom: "16px" }}>✓ Email reenviado</p>
            ) : (
              <button type="button" onClick={handleResend} disabled={resendLoading}
                style={{ width: "100%", background: T.overlay, border: `1px solid ${T.inputBorder}`, borderRadius: "12px", padding: "11px 20px", fontSize: "13px", fontWeight: 600, color: T.textMuted, cursor: resendLoading ? "wait" : "pointer", marginBottom: "12px", fontFamily: "'DM Sans', sans-serif" }}>
                {resendLoading ? "Reenviando…" : "¿No llegó? Reenviar email"}
              </button>
            )}
            <button type="button" onClick={() => { setMode("login"); setSuccess(""); setResendSent(false); }}
              style={{ background: "none", border: "none", color: "#E07A5F", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
              ← Volver al login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap');
        @keyframes fadeInUp{0%{opacity:0;transform:translateY(16px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @media(prefers-reduced-motion:reduce){*{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}}
        *{box-sizing:border-box;margin:0;padding:0}
        input::placeholder{color:${T.placeholder}}
        *:focus-visible{outline:2px solid ${T.focusRing};outline-offset:2px;border-radius:4px;}
      `}</style>

      <div style={{ width: "100%", maxWidth: "400px", animation: "fadeInUp 0.5s ease" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "42px", fontWeight: 800, color: T.text, letterSpacing: "-1px", marginBottom: "8px" }}>
            to <span style={{ background: "linear-gradient(135deg, #E07A5F, #E6AA68)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>done</span>
            <span aria-hidden="true" style={{ fontSize: "10px", verticalAlign: "super", color: "#E07A5F", WebkitTextFillColor: "#E07A5F", marginLeft: "2px" }}>✦</span>
          </h1>
          <p style={{ fontSize: "14px", color: T.textMuted, fontWeight: 500 }}>
            {mode === "login" ? "Bienvenido de vuelta" : mode === "register" ? "Empezá a organizarte sin culpa" : "Recuperá tu cuenta"}
          </p>
        </div>

        {/* Dark mode toggle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
          <button onClick={() => setDark(!dark)} aria-label={dark ? "Modo claro" : "Modo oscuro"} aria-pressed={dark}
            style={{ background: T.overlay, border: "none", borderRadius: "10px", padding: "8px 16px", cursor: "pointer", fontSize: "13px", color: T.textMuted, fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
            {dark ? "☀️" : "🌙"} {dark ? "Modo claro" : "Modo oscuro"}
          </button>
        </div>

        {/* Success message */}
        {success && (
          <div role="alert" style={{ background: "rgba(129,178,154,0.1)", border: "1px solid rgba(129,178,154,0.3)", borderRadius: "14px", padding: "14px 16px", marginBottom: "16px", fontSize: "13px", color: "#81B29A", fontWeight: 600, textAlign: "center" }}>
            {success}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate aria-label={mode === "login" ? "Iniciar sesión" : mode === "register" ? "Crear cuenta" : "Recuperar contraseña"}
          style={{ background: T.surface, borderRadius: "20px", padding: "28px 24px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", border: `1px solid ${T.border}` }}>


          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {mode === "register" && (
              <div>
                <label htmlFor="auth-name" style={labelStyle}>Nombre</label>
                <input id="auth-name" type="text" value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: undefined })); }} placeholder="Tu nombre" autoComplete="given-name" style={inputStyle("name")} />
                {errors.name && <p role="alert" style={errorStyle}>{errors.name}</p>}
              </div>
            )}
            <div>
              <label htmlFor="auth-email" style={labelStyle}>Email</label>
              <input id="auth-email" type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); setSuccess(""); }} placeholder="tu@email.com" autoComplete="email" style={inputStyle("email")} />
              {errors.email && <p role="alert" style={errorStyle}>{errors.email}</p>}
            </div>
            {mode !== "forgot" && (
              <div>
                <label htmlFor="auth-pass" style={labelStyle}>Contraseña</label>
                <div style={{ position: "relative" }}>
                  <input id="auth-pass" type={showPass ? "text" : "password"} value={pass} onChange={e => { setPass(e.target.value); setErrors(p => ({ ...p, pass: undefined })); }}
                    placeholder={mode === "register" ? "Mínimo 6 caracteres" : "Tu contraseña"} autoComplete={mode === "login" ? "current-password" : "new-password"} style={{ ...inputStyle("pass"), paddingRight: "48px" }} />
                  <button type="button" onClick={() => setShowPass(!showPass)} aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: T.textFaint, padding: "4px" }}>
                    {showPass ? "🙈" : "👁️"}
                  </button>
                </div>
                {errors.pass && <p role="alert" style={errorStyle}>{errors.pass}</p>}
              </div>
            )}
            {mode === "register" && (
              <div>
                <label htmlFor="auth-pass-confirm" style={labelStyle}>Confirmar contraseña</label>
                <input id="auth-pass-confirm" type="password" value={passConfirm} onChange={e => { setPassConfirm(e.target.value); setErrors(p => ({ ...p, passConfirm: undefined })); }} placeholder="Repetí tu contraseña" autoComplete="new-password" style={inputStyle("passConfirm")} />
                {errors.passConfirm && <p role="alert" style={errorStyle}>{errors.passConfirm}</p>}
              </div>
            )}
          </div>

          {/* Forgot password link */}
          {mode === "login" && (
            <button type="button" onClick={() => { setMode("forgot"); setErrors({}); setSuccess(""); }} style={{ background: "none", border: "none", fontSize: "12px", color: "#E07A5F", fontWeight: 600, cursor: "pointer", marginTop: "8px", padding: 0 }}>
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {/* General API error */}
          {errors.general && (
            <div role="alert" style={{ background: "rgba(224,122,95,0.1)", border: "1px solid rgba(224,122,95,0.3)", borderRadius: "12px", padding: "12px 14px", marginTop: "12px", fontSize: "13px", color: "#E07A5F", fontWeight: 500 }}>
              {errors.general}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading} aria-busy={loading}
            style={{ width: "100%", padding: "14px", borderRadius: "14px", background: loading ? T.inputBorder : "linear-gradient(135deg, #E07A5F, #E6AA68)", color: "white", border: "none", fontSize: "15px", fontWeight: 700, cursor: loading ? "wait" : "pointer", fontFamily: "'DM Sans', sans-serif", marginTop: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            {loading && <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />}
            {mode === "login" ? "Iniciar sesión" : mode === "register" ? "Crear cuenta" : "Enviar link"}
          </button>
        </form>

        {/* Toggle mode */}
        <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: T.textMuted }}>
          {mode === "login" ? "¿No tenés cuenta? " : mode === "register" ? "¿Ya tenés cuenta? " : ""}
          {mode === "forgot" ? (
            <button type="button" onClick={() => { setMode("login"); setErrors({}); setSuccess(""); }} style={{ background: "none", border: "none", color: "#E07A5F", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>← Volver al inicio</button>
          ) : (
            <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErrors({}); setSuccess(""); }} style={{ background: "none", border: "none", color: "#E07A5F", fontWeight: 700, cursor: "pointer", fontSize: "13px" }}>
              {mode === "login" ? "Creá una" : "Iniciá sesión"}
            </button>
          )}
        </p>

        {/* Terms */}
        {mode === "register" && (
          <p style={{ textAlign: "center", marginTop: "12px", fontSize: "11px", color: T.textFaint, lineHeight: 1.5 }}>
            Al crear tu cuenta aceptás los <button type="button" style={{ background: "none", border: "none", color: "#E07A5F", cursor: "pointer", fontSize: "11px", textDecoration: "underline", padding: 0 }}>términos</button> y la <button type="button" style={{ background: "none", border: "none", color: "#E07A5F", cursor: "pointer", fontSize: "11px", textDecoration: "underline", padding: 0 }}>política de privacidad</button>
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// NOTE CANVAS
// ============================================================
const NOTE_COLORS = [
  { light: "#FFF8F0",               dark: "#282520" },
  { light: "#FDEBD0",               dark: "#2C2418" },
  { light: "rgba(230,170,104,0.2)", dark: "rgba(230,170,104,0.18)" },
  { light: "rgba(129,178,154,0.22)",dark: "rgba(129,178,154,0.2)" },
  { light: "rgba(86,204,242,0.14)", dark: "rgba(86,204,242,0.16)" },
  { light: "rgba(187,107,217,0.14)",dark: "rgba(187,107,217,0.16)" },
];
const NOTE_TYPES = ["note", "list", "media"];
const NOTE_TYPE_ICONS = { note: "✏️", list: "☑", media: "🔗" };
const NOTE_TYPE_LABELS = { note: "Nota", list: "Lista", media: "Enlace" };

function NoteCard({ note, onChange, onDelete, T, dark, isNew }) {
  const [hov, setHov] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [urlMeta, setUrlMeta] = useState(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const dragging = useRef(false);
  const dragRef = useRef(null);
  const taRef = useRef(null);
  const newItemRef = useRef(null);
  const typeMenuRef = useRef(null);
  const colorPickerRef = useRef(null);
  const urlDebounceRef = useRef(null);
  const type = note.type || "note";

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = taRef.current.scrollHeight + "px";
    }
  }, [note.text, type]);

  useEffect(() => {
    if (!isNew) return;
    if (taRef.current) taRef.current.focus();
    else if (newItemRef.current) newItemRef.current.focus();
  }, [isNew]);

  // Close type menu on outside click
  useEffect(() => {
    if (!showTypeMenu) return;
    const handler = (e) => { if (typeMenuRef.current && !typeMenuRef.current.contains(e.target)) setShowTypeMenu(false); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [showTypeMenu]);

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e) => { if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) setShowColorPicker(false); };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [showColorPicker]);

  // URL metadata prefetch via microlink.io
  useEffect(() => {
    const url = note.mediaUrl;
    if (!url || !url.startsWith("http")) { setUrlMeta(null); setUrlLoading(false); return; }
    if (/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url)) { setUrlMeta(null); return; }
    setUrlLoading(true); setUrlMeta(null);
    if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current);
    urlDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data.status === "success") setUrlMeta(data.data);
      } catch (_) {}
      setUrlLoading(false);
    }, 800);
    return () => { if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current); };
  }, [note.mediaUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const onPD = (e) => {
    if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT" || e.target.closest("button") || e.target.closest("a")) return;
    e.preventDefault();
    dragging.current = true;
    dragRef.current = { mx: e.clientX, my: e.clientY, nx: note.x, ny: note.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPM = (e) => {
    if (!dragging.current || !dragRef.current) return;
    onChange({ ...note, x: Math.max(0, dragRef.current.nx + e.clientX - dragRef.current.mx), y: Math.max(0, dragRef.current.ny + e.clientY - dragRef.current.my) });
  };
  const onPU = () => { dragging.current = false; dragRef.current = null; };

  const toggleItem = (i) => onChange({ ...note, items: (note.items || []).map((it, idx) => idx === i ? { ...it, done: !it.done } : it) });
  const updateItem = (i, text) => onChange({ ...note, items: (note.items || []).map((it, idx) => idx === i ? { ...it, text } : it) });
  const deleteItem = (i) => onChange({ ...note, items: (note.items || []).filter((_, idx) => idx !== i) });
  const addItem = (text) => { onChange({ ...note, items: [...(note.items || []), { text, done: false }] }); playAdd(); };
  const isImg = (url) => /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);

  const cp = NOTE_COLORS[note.colorIdx % NOTE_COLORS.length];
  const bg = dark ? cp.dark : cp.light;

  return (
    <div onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        position: "absolute", left: note.x, top: note.y, width: 230,
        background: bg, borderRadius: "12px", padding: "10px 12px 14px",
        border: `1px solid ${dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}`,
        boxShadow: hov ? `0 8px 24px rgba(0,0,0,${dark ? .4 : .14})` : `0 2px 8px rgba(0,0,0,${dark ? .3 : .07})`,
        cursor: "grab", transition: "box-shadow 0.15s ease",
        userSelect: "none", zIndex: hov ? 10 : 1, touchAction: "none",
      }}>
      {/* Header: type dropdown + delete */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "8px", gap: "4px" }}>
        <div ref={typeMenuRef} style={{ position: "relative" }}>
          <button onClick={e => { e.stopPropagation(); setShowTypeMenu(v => !v); }}
            aria-label={`Tipo de nota: ${NOTE_TYPE_LABELS[type]}`}
            style={{ background: showTypeMenu ? T.overlay : "transparent", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: "4px", padding: "3px 6px",
              borderRadius: "6px", transition: "background 0.15s ease" }}>
            <div aria-hidden="true" style={{ display: "flex", flexWrap: "wrap", gap: "2px", width: "10px", opacity: 0.35 }}>
              {[0,1,2,3,4,5].map(i => <div key={i} style={{ width: "3px", height: "3px", borderRadius: "50%", background: T.textMuted }} />)}
            </div>
            <span style={{ fontSize: "10px", opacity: 0.7 }}>{NOTE_TYPE_ICONS[type]}</span>
          </button>
          {showTypeMenu && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, background: T.surface, borderRadius: "10px",
              border: `1px solid ${T.border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.14)", zIndex: 200, overflow: "hidden", minWidth: "120px" }}>
              {NOTE_TYPES.map(t => (
                <button key={t} onClick={e => { e.stopPropagation(); onChange({ ...note, type: t, items: note.items || [], mediaUrl: note.mediaUrl || "" }); setShowTypeMenu(false); playClick(); }}
                  style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", padding: "8px 12px",
                    border: "none", background: t === type ? T.overlay : "transparent", cursor: "pointer",
                    fontSize: "12px", color: T.text, fontFamily: "'DM Sans', sans-serif", fontWeight: t === type ? 700 : 500 }}>
                  <span>{NOTE_TYPE_ICONS[t]}</span>
                  <span>{NOTE_TYPE_LABELS[t]}</span>
                  {t === type && <span style={{ marginLeft: "auto", color: "#81B29A", fontSize: "11px" }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        {/* Color picker */}
        <div ref={colorPickerRef} style={{ position: "relative" }}>
          <button onClick={e => { e.stopPropagation(); setShowColorPicker(v => !v); setShowTypeMenu(false); }}
            aria-label="Color de la nota"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "3px 5px", borderRadius: "6px", display: "flex", alignItems: "center", opacity: hov || showColorPicker ? 1 : 0, transition: "opacity 0.15s ease" }}>
            <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: bg, border: `1.5px solid ${dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.22)"}` }} />
          </button>
          {showColorPicker && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: T.surface, borderRadius: "10px", border: `1px solid ${T.border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.14)", zIndex: 201, padding: "8px", display: "flex", gap: "5px" }}>
              {NOTE_COLORS.map((c, i) => {
                const swatchBg = dark ? c.dark : c.light;
                const active = i === (note.colorIdx % NOTE_COLORS.length);
                return (
                  <button key={i} onClick={e => { e.stopPropagation(); onChange({ ...note, colorIdx: i }); setShowColorPicker(false); }}
                    aria-label={`Color ${i + 1}`} aria-pressed={active}
                    style={{ width: "22px", height: "22px", borderRadius: "50%", border: active ? "2.5px solid #E07A5F" : `1.5px solid ${dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`, background: swatchBg, cursor: "pointer", flexShrink: 0, transition: "transform 0.1s ease", transform: active ? "scale(1.2)" : "scale(1)" }} />
                );
              })}
            </div>
          )}
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(note.id); }} aria-label="Eliminar nota"
          style={{ background: "none", border: "none", cursor: "pointer", color: T.textFaint, fontSize: "18px",
            padding: "0 2px", lineHeight: 1, opacity: hov ? .7 : 0, transition: "opacity 0.15s ease" }}>×</button>
      </div>

      {/* ── Note ── */}
      {type === "note" && (
        <textarea ref={taRef} value={note.text || ""} onChange={e => onChange({ ...note, text: e.target.value })}
          placeholder="Escribí algo..." onPointerDown={e => e.stopPropagation()}
          style={{ width: "100%", minHeight: "56px", background: "transparent", border: "none", outline: "none",
            resize: "none", fontSize: "13px", color: T.text, fontFamily: "'DM Sans', sans-serif",
            lineHeight: 1.6, cursor: "text", userSelect: "text", overflow: "hidden", padding: 0, display: "block" }} />
      )}

      {/* ── List ── */}
      {type === "list" && (
        <div onPointerDown={e => e.stopPropagation()}>
          {(note.items || []).map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "7px", padding: "3px 0", userSelect: "text" }}>
              <button onClick={() => toggleItem(i)}
                style={{ width: "15px", height: "15px", borderRadius: "4px", flexShrink: 0, marginTop: "2px",
                  border: `1.5px solid ${item.done ? "#81B29A" : dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)"}`,
                  background: item.done ? "#81B29A" : "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {item.done && <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
              <input value={item.text} onChange={e => updateItem(i, e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); newItemRef.current?.focus(); }
                  if (e.key === "Backspace" && !item.text) { e.preventDefault(); deleteItem(i); }
                }}
                style={{ flex: 1, background: "transparent", border: "none", outline: "none",
                  fontSize: "13px", color: T.text, fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5,
                  textDecoration: item.done ? "line-through" : "none", opacity: item.done ? 0.5 : 1, padding: 0 }} />
            </div>
          ))}
          <input ref={newItemRef} placeholder="+ ítem..."
            onKeyDown={e => { if (e.key === "Enter" && e.currentTarget.value.trim()) { addItem(e.currentTarget.value.trim()); e.currentTarget.value = ""; } }}
            style={{ width: "100%", background: "transparent", border: "none", outline: "none",
              borderTop: `1px dashed ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`, marginTop: "4px",
              fontSize: "13px", color: T.textFaint, fontFamily: "'DM Sans', sans-serif", padding: "4px 0", cursor: "text" }} />
        </div>
      )}

      {/* ── Media ── */}
      {type === "media" && (
        <div onPointerDown={e => e.stopPropagation()}>
          <input type="url" value={note.mediaUrl || ""} onChange={e => onChange({ ...note, mediaUrl: e.target.value })}
            placeholder="Pegá una URL…"
            style={{ width: "100%", background: "transparent", border: `1px solid ${dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`,
              borderRadius: "8px", outline: "none", fontSize: "12px", color: T.text,
              fontFamily: "'DM Sans', sans-serif", padding: "6px 8px", marginBottom: "8px", boxSizing: "border-box" }} />
          {/* Image direct preview */}
          {note.mediaUrl && isImg(note.mediaUrl) && (
            <img src={note.mediaUrl} alt="" onError={e => e.target.style.display = "none"}
              style={{ width: "100%", borderRadius: "8px", display: "block", maxHeight: "140px", objectFit: "cover" }} />
          )}
          {/* Loading */}
          {note.mediaUrl && !isImg(note.mediaUrl) && urlLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: "10px 12px", borderRadius: "10px",
              background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)", fontSize: "11px", color: T.textFaint }}>
              <div style={{ width: "11px", height: "11px", border: `2px solid ${T.inputBorder}`, borderTopColor: "#E07A5F", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />
              Cargando vista previa…
            </div>
          )}
          {/* Rich preview */}
          {note.mediaUrl && !isImg(note.mediaUrl) && !urlLoading && urlMeta && (
            <a href={note.mediaUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "block", borderRadius: "10px", overflow: "hidden",
                border: `1px solid ${dark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`, textDecoration: "none" }}>
              {urlMeta.image?.url && (
                <img src={urlMeta.image.url} alt="" onError={e => e.target.style.display = "none"}
                  style={{ width: "100%", height: "90px", objectFit: "cover", display: "block" }} />
              )}
              <div style={{ padding: "8px 10px", background: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "3px" }}>
                  {urlMeta.logo?.url && <img src={urlMeta.logo.url} alt="" width="12" height="12" onError={e => e.target.style.display = "none"} style={{ borderRadius: "2px", objectFit: "contain" }} />}
                  <span style={{ fontSize: "10px", color: T.textFaint, fontWeight: 600 }}>{(() => { try { return new URL(note.mediaUrl).hostname; } catch { return ""; } })()}</span>
                </div>
                {urlMeta.title && <p style={{ fontSize: "12px", fontWeight: 700, color: T.text, lineHeight: 1.3, marginBottom: "2px", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{urlMeta.title}</p>}
                {urlMeta.description && <p style={{ fontSize: "11px", color: T.textMuted, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{urlMeta.description}</p>}
              </div>
            </a>
          )}
          {/* Fallback plain link */}
          {note.mediaUrl && !isImg(note.mediaUrl) && !urlLoading && !urlMeta && (
            <a href={note.mediaUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 10px", borderRadius: "8px",
                background: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                fontSize: "12px", color: "#3B9EC4", textDecoration: "none", wordBreak: "break-all", lineHeight: 1.4 }}>
              <span aria-hidden="true" style={{ fontSize: "14px", flexShrink: 0 }}>🔗</span>
              <span>{note.mediaUrl}</span>
            </a>
          )}
          {!note.mediaUrl && (
            <div style={{ textAlign: "center", padding: "12px 0", color: T.textFaint, fontSize: "11px" }}>
              <div style={{ fontSize: "22px", marginBottom: "4px", opacity: .5 }}>🖼️</div>
              Imagen o enlace
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NoteCanvas({ notes, setNotes, T, dark, onCollapse }) {
  const [newId, setNewId] = useState(null);
  const canvasRef = useRef(null);
  const scrollRef = useRef(null);
  const CSIZE = 3000;

  const makeNote = (x, y) => {
    const n = { id: crypto.randomUUID(), x: Math.max(10, x), y: Math.max(10, y), text: "", type: "note", items: [], mediaUrl: "", colorIdx: notes.length % NOTE_COLORS.length };
    setNotes(prev => [...prev, n]);
    setNewId(n.id);
    setTimeout(() => setNewId(null), 300);
    playAdd();
  };

  const onDblClick = (e) => {
    if (e.target !== canvasRef.current) return;
    const r = scrollRef.current.getBoundingClientRect();
    makeNote(e.clientX - r.left + (scrollRef.current?.scrollLeft || 0) - 110, e.clientY - r.top + (scrollRef.current?.scrollTop || 0) - 40);
  };

  const addBtn = () => {
    const i = notes.length;
    makeNote(30 + (i % 5) * 240, 30 + Math.floor(i / 5) * 180);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: dark ? "#1C1D22" : "#F7F5F2" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", flexShrink: 0, borderBottom: `1px solid ${T.border}`, background: T.surface }}>
        <button onClick={onCollapse} aria-label="Colapsar canvas"
          style={{ background: "none", border: "none", cursor: "pointer", color: T.textMuted, fontSize: "18px", padding: "4px 6px", lineHeight: 1, borderRadius: "8px" }}>›</button>
        <span style={{ fontSize: "13px", fontWeight: 700, color: T.text }}>✦ Canvas</span>
        <span style={{ fontSize: "11px", color: T.textFaint }}>doble click para agregar</span>
        {notes.length > 0 && <span style={{ fontSize: "11px", color: T.textFaint, background: T.overlay, padding: "3px 9px", borderRadius: "7px" }}>{notes.length}</span>}
        <button onClick={addBtn} style={{ marginLeft: "auto", background: "linear-gradient(135deg, #E07A5F, #E6AA68)", color: "white", border: "none", borderRadius: "10px", padding: "7px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>+ Nota</button>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", position: "relative" }}>
        {notes.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 5 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "34px", marginBottom: "10px", opacity: .4 }}>📝</div>
              <p style={{ fontSize: "14px", color: T.textMuted, fontWeight: 600 }}>Canvas vacío</p>
              <p style={{ fontSize: "12px", color: T.textFaint, marginTop: "4px", lineHeight: 1.5 }}>Doble click para agregar<br/>o usá el botón + Nota</p>
            </div>
          </div>
        )}
        <div ref={canvasRef} onDoubleClick={onDblClick}
          style={{ position: "relative", width: CSIZE, height: CSIZE,
            backgroundImage: dark ? "radial-gradient(circle, rgba(255,255,255,0.09) 1px, transparent 1px)" : "radial-gradient(circle, rgba(0,0,0,0.1) 1px, transparent 1px)",
            backgroundSize: "28px 28px" }}>
          {notes.map(note => (
            <NoteCard key={note.id} note={note}
              onChange={u => setNotes(prev => prev.map(n => n.id === u.id ? u : n))}
              onDelete={id => { setNotes(prev => prev.filter(n => n.id !== id)); playClick(); }}
              T={T} dark={dark} isNew={note.id === newId} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
export default function ToDone() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const [dark, setDark] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const T = dark ? themes.dark : themes.light;

  useEffect(() => {
    // Restore existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);


  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: "24px", height: "24px", border: `3px solid ${T.inputBorder}`, borderTopColor: "#E07A5F", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!user) return <AuthScreen onLogin={setUser} dark={dark} setDark={setDark} />;

  return <AppMain user={user} onLogout={() => signOutUser()} dark={dark} setDark={setDark} T={T} isRecovery={isRecovery} onRecoveryHandled={() => setIsRecovery(false)} />;
}

// ── DB ↔ local task mapping ───────────────────────────────────────────────────
function toLocal(t, shareInfo = null) {
  return {
    id: t.id,
    listId: t.list_id ?? null,
    text: t.text,
    priority: t.priority,
    minutes: t.minutes,
    done: t.done,
    doneAt: t.done_at ? new Date(t.done_at).getTime() : null,
    createdAt: t.created_at ? new Date(t.created_at).getTime() : Date.now(),
    subtasks: t.subtasks || [],
    scheduledFor: t.scheduled_for,
    order: t.order ?? 0,
    isShared: !!shareInfo,
    sharedFromEmail: shareInfo?.owner_email ?? null,
    sharedFromName: shareInfo?.owner_name ?? null,
    assigneeEmail: null,
  };
}
function toDb(t, userId) {
  return {
    id: t.id,
    user_id: userId,
    list_id: t.listId ?? null,
    text: t.text,
    priority: t.priority,
    minutes: t.minutes,
    done: t.done,
    done_at: t.doneAt ? new Date(t.doneAt).toISOString() : null,
    subtasks: t.subtasks || [],
    scheduled_for: t.scheduledFor ?? null,
    order: t.order ?? 0,
  };
}

function AppMain({ user, onLogout, dark, setDark, T, isRecovery, onRecoveryHandled }) {
  const [tasks, setTasks] = useState([]);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newMinutes, setNewMinutes] = useState(30);
  const [newSchedule, setNewSchedule] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const [dismissedSuggIds, setDismissedSuggIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`dismissed_${user.id}`) || "[]")); }
    catch { return new Set(); }
  });
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiSuggestionsLoading, setAiSuggestionsLoading] = useState(false);
  const aiDebounceRef = useRef(null);
  const estimateDebounceRef = useRef(null);
  const tasksRef = useRef([]);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [splitTargetId, setSplitTargetId] = useState(null);
  const [quickDump, setQuickDump] = useState(false);
  const [quickText, setQuickText] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiAccepted, setAiAccepted] = useState({ priority: false, schedule: false, minutes: false });
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [announce, setAnnounce] = useState("");
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [addBtnHover, setAddBtnHover] = useState(false);
  const [showChangePass, setShowChangePass] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [newPassConfirm, setNewPassConfirm] = useState("");
  const [changePassLoading, setChangePassLoading] = useState(false);
  const [changePassMsg, setChangePassMsg] = useState(null); // { type: "ok"|"err", text }
  const accountRef = useRef(null);
  const suggScrollRef = useRef(null);
  const [suggAtStart, setSuggAtStart] = useState(true);
  const [suggAtEnd, setSuggAtEnd] = useState(false);
  const [showCanvas, setShowCanvas] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1000);
  const [wideEnough, setWideEnough] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1000);
  const [canvasWidth, setCanvasWidth] = useState(() => {
    if (typeof window === "undefined") return 600;
    const saved = localStorage.getItem("canvas_width");
    if (saved) return Math.max(280, Math.min(window.innerWidth - 320, +saved));
    return Math.round(window.innerWidth * 0.6);
  });
  const [isResizing, setIsResizing] = useState(false);
  const canvasResizeRef = useRef({ active: false, startX: 0, startW: 0, lastW: 0 });
  const [mobileView, setMobileView] = useState("list"); // "list" | "canvas"
  const [kbHeight, setKbHeight] = useState(0);
  const [canvasNotes, setCanvasNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`canvas_${user.id}`) || "[]"); }
    catch { return []; }
  });
  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null); // null = "Todas"
  const [showAddList, setShowAddList] = useState(false);
  const [newListName, setNewListName] = useState("");

  // Derived: tasks filtered by active list
  const visibleTasks = useMemo(() => activeListId ? tasks.filter(t => t.listId === activeListId) : tasks, [tasks, activeListId]);

  const completedToday = visibleTasks.filter(t => t.done && t.doneAt && (Date.now() - t.doneAt) < 86400000).length;
  const todayTasks = useMemo(() => visibleTasks.filter(t => !t.done && t.scheduledFor === "hoy").sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [visibleTasks]);
  const weekTasks = useMemo(() => visibleTasks.filter(t => !t.done && t.scheduledFor === "semana").sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [visibleTasks]);
  const unscheduled = useMemo(() => visibleTasks.filter(t => !t.done && !t.scheduledFor).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [visibleTasks]);
  const doneTasks = useMemo(() => visibleTasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)), [visibleTasks]);
  const todayMin = todayTasks.reduce((s, t) => s + (t.minutes || 0), 0);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayDoneMin = visibleTasks.filter(t => t.done && t.scheduledFor === "hoy" && t.doneAt && t.doneAt >= todayStart.getTime()).reduce((s, t) => s + (t.minutes || 0), 0);
  const todayTotalMin = todayMin + todayDoneMin; // fixed denominator: pending + done today
  const weekMin = weekTasks.reduce((s, t) => s + (t.minutes || 0), 0);
  const pendingCount = visibleTasks.filter(t => !t.done).length;
  const overloaded = todayMin > WORKDAY_MINUTES;

  const suggestions = useMemo(() => {
    const all = [];
    if (overloaded) all.push({ id: "overload", text: `Tenés ${fmt(todayMin)} para hoy (${fmt(todayMin - WORKDAY_MINUTES)} de más). ¿Movemos la menos urgente?`, icon: "⚠️", action: { type: "unload" }, color: "#E07A5F" });
    const large = todayTasks.filter(t => t.minutes >= 120 && t.subtasks.length === 0);
    if (large.length > 0) all.push({ id: `split-${large[0].id}`, text: `"${large[0].text}" son ${fmt(large[0].minutes)}. Dividirla en pasos la hace más manejable.`, icon: "🧩", action: { type: "split", taskId: large[0].id }, color: "#BB6BD9" });
    if (todayTasks.length === 0 && pendingCount > 0) all.push({ id: "suggest", text: "No tenés tareas para hoy. ¿Querés que mueva las más prioritarias?", icon: "📋", action: { type: "suggest" }, color: "#56CCF2" });
    if (completedToday >= 5) all.push({ id: "done5", text: "¡5 tareas completadas hoy! Sos una máquina.", icon: "🏆", color: "#81B29A" });
    else if (completedToday >= 3) all.push({ id: "done3", text: `¡${completedToday} completadas! Muy buen ritmo por hoy.`, icon: "🎖️", color: "#81B29A" });
    if (weekTasks.length > 5 && !overloaded) all.push({ id: "weekload", text: `Tenés ${weekTasks.length} tareas en la semana. Buen momento para revisar prioridades.`, icon: "📅", color: "#E6AA68" });
    if (unscheduled.length >= 3) all.push({ id: "unscheduled", text: `${unscheduled.length} tareas sin fecha. Agendarlas te ayuda a no olvidarlas.`, icon: "📥", action: { type: "suggest" }, color: "#9B6DB5" });
    if (todayMin > 0 && !overloaded && completedToday < 3 && todayTasks.length > 0) all.push({ id: "balanced", text: `Tenés ${fmt(todayMin)} planeadas para hoy. Día bien equilibrado.`, icon: "✅", color: "#81B29A" });
    return all.filter(s => !dismissedSuggIds.has(s.id));
  }, [tasks, todayTasks, weekTasks, unscheduled, todayMin, completedToday, overloaded, pendingCount, dismissedSuggIds]);

  const dismissSugg = (id) => setDismissedSuggIds(prev => {
    const next = new Set([...prev, id]);
    localStorage.setItem(`dismissed_${user.id}`, JSON.stringify([...next]));
    return next;
  });

  // Keep tasksRef in sync so fetchAiSuggestions always has current data
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const fetchAiSuggestions = async () => {
    const currentTasks = tasksRef.current;
    setAiSuggestionsLoading(true);
    try {
      const todayT = currentTasks.filter(t => !t.done && t.scheduledFor === 'hoy');
      const weekT  = currentTasks.filter(t => !t.done && t.scheduledFor === 'semana');
      const doneToday = currentTasks.filter(t => t.done && t.doneAt && Date.now() - t.doneAt < 86400000).length;
      const unscheduledN = currentTasks.filter(t => !t.done && !t.scheduledFor).length;
      const todayMin = todayT.reduce((s, t) => s + (t.minutes || 0), 0);

      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          todayTasks: todayT.slice(0, 8).map(t => ({ text: t.text, priority: t.priority, minutes: t.minutes })),
          weekTasks: weekT.slice(0, 5).map(t => ({ text: t.text, priority: t.priority })),
          doneTodayCount: doneToday,
          todayMinutes: todayMin,
          workdayMinutes: WORKDAY_MINUTES,
          unscheduledCount: unscheduledN,
          hour: new Date().getHours(),
        }),
      });
      const data = await res.json();
      console.log('[ai-suggest] status:', res.status, 'data:', data);
      if (res.ok && data.suggestions?.length > 0) {
        setAiSuggestions(data.suggestions.map(s => ({ ...s, isAI: true })));
      }
    } catch (e) {
      console.error('[ai-suggest] error:', e);
    } finally {
      setAiSuggestionsLoading(false);
    }
  };

  // Load tasks from Supabase on mount (own tasks + shared tasks)
  useEffect(() => {
    // Activate pending shares first (for users who were invited before signup),
    // then load tasks so newly activated shares are included
    supabase.rpc('activate_pending_shares')
      .then(({ error }) => { if (error) console.error('[activate_shares]', error); })
      .finally(() => {
        Promise.all([
          supabase.from('tasks').select('*').eq('user_id', user.id).order('order'),
          supabase.from('task_shares').select('task_id, owner_email, owner_name').eq('shared_with_user_id', user.id),
          supabase.from('task_shares').select('task_id, shared_with_email').eq('owner_id', user.id),
        ]).then(async ([ownRes, incomingRes, outgoingRes]) => {
          if (ownRes.error) console.error('[tasks:own]', ownRes.error);


          // Build outgoing-share map: taskId → assigneeEmail
          const outMap = {};
          (outgoingRes.data || []).forEach(s => { outMap[s.task_id] = s.shared_with_email; });

          // Own tasks
          const ownTasks = (ownRes.data || []).map(t => ({ ...toLocal(t), assigneeEmail: outMap[t.id] ?? null }));

          // Fetch shared-with-me tasks via security-definer RPC (bypasses RLS type issues)
          const incoming = incomingRes.data || [];
          let sharedTasks = [];
          if (incoming.length > 0) {
            const { data: sharedData, error: shErr } = await supabase.rpc('get_shared_tasks');
            if (shErr) console.error('[tasks:shared]', shErr);
            sharedTasks = (sharedData || []).map(t => {
              const share = incoming.find(s => s.task_id === t.id);
              return toLocal(t, share);
            });
          }

          const all = [...ownTasks, ...sharedTasks];
          setTasks(all);
          tasksRef.current = all;
          setDbLoaded(true);
        });
      });
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: sync own tasks + shared tasks
  useEffect(() => {
    const refreshShared = async () => {
      const { data } = await supabase.rpc('get_shared_tasks');
      if (!data) return;
      setTasks(cur => {
        const nonShared = cur.filter(t => !t.isShared);
        const sharedMeta = cur.filter(t => t.isShared);
        const refreshed = data.map(t => {
          const existing = sharedMeta.find(s => s.id === t.id);
          return { ...toLocal(t, { owner_email: existing?.sharedFromEmail, owner_name: existing?.sharedFromName }), isShared: true };
        });
        return [...nonShared, ...refreshed];
      });
    };

    const channel = supabase
      .channel(`tasks-realtime:${user.id}`)
      // Own tasks: update state directly from payload (covers delegated user's changes)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` }, (payload) => {
        setTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...toLocal(payload.new), assigneeEmail: t.assigneeEmail } : t));
      })
      // Shared tasks: re-fetch via RPC on any task change
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload) => {
        setTasks(prev => {
          const isShared = prev.some(t => t.id === payload.new.id && t.isShared);
          if (isShared) refreshShared();
          return prev;
        });
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load lists from Supabase on mount
  useEffect(() => {
    supabase.from('lists').select('*').eq('user_id', user.id).order('order').then(({ data, error }) => {
      if (error) console.error('[lists]', error);
      else setLists((data || []).map(l => ({ id: l.id, name: l.name, order: l.order ?? 0 })));
    });
  }, [user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch AI suggestions on load and when task state changes meaningfully
  useEffect(() => {
    if (!dbLoaded) return;
    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    const delay = aiSuggestions.length === 0 ? 800 : 8000;
    aiDebounceRef.current = setTimeout(fetchAiSuggestions, delay);
  }, [dbLoaded, pendingCount, completedToday]); // eslint-disable-line react-hooks/exhaustive-deps

  // DB sync helpers (defined here to close over user.id)
  const dbInsert = (task) => supabase.from('tasks').insert(toDb(task, user.id)).then(({ error }) => { if (error) console.error('[db:insert]', error); });
  // No user_id filter on update — RLS (updated to allow shared-with users) handles auth
  const dbUpdate = (id, patch) => supabase.from('tasks').update(patch).eq('id', id).then(({ error }) => { if (error) console.error('[db:update]', error); });
  const dbDelete = (id) => supabase.from('tasks').delete().eq('id', id).eq('user_id', user.id).then(({ error }) => { if (error) console.error('[db:delete]', error); });
  const dbUpsertMany = (rows) => supabase.from('tasks').upsert(rows.map(t => toDb(t, user.id)), { onConflict: 'id' }).then(({ error }) => { if (error) console.error('[db:upsert]', error); });

  useEffect(() => {
    const trimmed = newTask.trim();
    if (trimmed.length <= 3) { setAiResult(null); setEstimateLoading(false); return; }
    // Show rule-based result immediately while user types
    const quick = aiSuggest(trimmed);
    setAiResult(quick);
    setAiAccepted({ priority: false, schedule: false, minutes: false });
    // If rule-based had no results, show dots while waiting for API
    setEstimateLoading(!quick.hasAny);
    // Debounce Claude upgrade
    if (estimateDebounceRef.current) clearTimeout(estimateDebounceRef.current);
    estimateDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/estimate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed }),
        });
        const data = await res.json();
        console.log('[estimate] status:', res.status, 'data:', data);
        if (res.ok && (data.priority || data.scheduledFor || data.minutes)) {
          setAiResult({ ...data, cleanText: trimmed, hasAny: true });
        }
      } catch (e) {
        console.error('[estimate] error:', e);
      } finally {
        setEstimateLoading(false);
      }
    }, 600);
  }, [newTask]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open change-password panel when user arrives via password reset email
  useEffect(() => {
    if (!isRecovery) return;
    setShowChangePass(true);
    setChangePassMsg(null);
    setNewPass("");
    setNewPassConfirm("");
    onRecoveryHandled();
  }, [isRecovery]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close account menu on outside click
  useEffect(() => {
    if (!showAccountMenu) return;
    const handler = (e) => { if (accountRef.current && !accountRef.current.contains(e.target)) setShowAccountMenu(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAccountMenu]);

  // Track virtual keyboard height on mobile (visualViewport API)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKbHeight(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, []);

  // Close panel on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape" && showAdd) { setShowAdd(false); setNewTask(""); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showAdd]);

  // Canvas: persist notes to localStorage
  useEffect(() => {
    localStorage.setItem(`canvas_${user.id}`, JSON.stringify(canvasNotes));
  }, [canvasNotes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Canvas: track viewport width for responsive behaviour
  useEffect(() => {
    const fn = () => setWideEnough(window.innerWidth >= 1000);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // Canvas: auto-close if screen becomes too narrow
  useEffect(() => {
    if (!wideEnough && showCanvas) setShowCanvas(false);
  }, [wideEnough, showCanvas]);

  const addTask = () => {
    if (!newTask.trim()) return;
    const ai = aiResult || aiSuggest(newTask);
    const t = { id: crypto.randomUUID(), listId: activeListId, text: ai.cleanText, priority: aiAccepted.priority && ai.priority ? ai.priority : newPriority, minutes: aiAccepted.minutes && ai.minutes ? ai.minutes : newMinutes, done: false, doneAt: null, createdAt: Date.now(), subtasks: [], scheduledFor: aiAccepted.schedule && ai.scheduledFor ? ai.scheduledFor : newSchedule || (todayMin < WORKDAY_MINUTES ? "hoy" : "semana"), order: -1 };
    setTasks(prev => { const p = [t, ...prev.filter(x => !x.done)].map((x, i) => ({ ...x, order: i })); return [...p, ...prev.filter(x => x.done)]; });
    dbInsert(t);
    setAnnounce(`Tarea "${ai.cleanText}" agregada`);
    setNewTask(""); setNewPriority("medium"); setNewMinutes(30); setNewSchedule(null); setAiResult(null); setAiAccepted({ priority: false, schedule: false, minutes: false }); setShowAdd(false); playAdd();
  };
  const quickDumpAdd = () => {
    if (!quickText.trim()) return;
    const lines = quickText.split("\n").filter(l => l.trim());
    const nt = lines.map((line, i) => { const ai = aiSuggest(line); return { id: crypto.randomUUID(), listId: activeListId, text: ai.cleanText, priority: ai.priority || "medium", minutes: ai.minutes || 30, done: false, doneAt: null, createdAt: Date.now(), subtasks: [], scheduledFor: ai.scheduledFor || (todayMin < WORKDAY_MINUTES ? "hoy" : "semana"), order: i }; });
    setTasks(prev => { const p = [...nt, ...prev.filter(t => !t.done)].map((t, i) => ({ ...t, order: i })); return [...p, ...prev.filter(t => t.done)]; });
    dbUpsertMany(nt);
    setAnnounce(`${lines.length} tareas agregadas`);
    setQuickText(""); setQuickDump(false); playAdd();
  };
  const toggleTask = id => {
    const t = tasks.find(x => x.id === id);
    const newDone = !t.done;
    const newDoneAt = newDone ? Date.now() : null;
    if (newDone) { setShowConfetti(true); setConfettiKey(k => k + 1); setTimeout(() => setShowConfetti(false), 100); setAnnounce(`"${t.text}" completada`); } else { setAnnounce(`"${t.text}" desmarcada`); }
    setTasks(prev => prev.map(x => x.id === id ? { ...x, done: newDone, doneAt: newDoneAt } : x));
    dbUpdate(id, { done: newDone, done_at: newDoneAt ? new Date(newDoneAt).toISOString() : null });
  };
  const deleteTask = id => {
    const t = tasks.find(x => x.id === id);
    setAnnounce(`"${t?.text}" eliminada`);
    setTasks(prev => prev.filter(t => t.id !== id));
    dbDelete(id);
  };
  const updateSubs = (id, subs) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, subtasks: subs } : t));
    dbUpdate(id, { subtasks: subs });
  };
  const addSub = (id, text) => {
    const newSubs = [...(tasks.find(t => t.id === id)?.subtasks || []), { text, done: false }];
    setTasks(prev => prev.map(t => t.id === id ? { ...t, subtasks: newSubs } : t));
    dbUpdate(id, { subtasks: newSubs });
  };
  const updateText = (id, text) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, text } : t));
    dbUpdate(id, { text });
  };
  const delegateTask = async (taskId, assigneeEmail) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return { ok: false, error: 'Tarea no encontrada' };
    const res = await fetch('/api/delegate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId,
        taskText: task.text,
        taskPriority: task.priority,
        taskMinutes: task.minutes,
        assigneeEmail,
        assignerId: user.id,
        assignerEmail: user.email,
        assignerName: getUserName(user),
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assigneeEmail } : t));
    }
    return { ok: res.ok, ...data };
  };
  const unshareTask = (taskId) => {
    supabase.from('task_shares').delete()
      .eq('task_id', taskId).eq('shared_with_user_id', user.id)
      .then(({ error }) => { if (error) console.error('[unshare]', error); });
    setTasks(prev => prev.filter(t => t.id !== taskId));
    playClick();
  };
  const addList = async () => {
    const name = newListName.trim();
    if (!name) return;
    const newList = { id: crypto.randomUUID(), name, order: lists.length };
    const { error } = await supabase.from('lists').insert({ id: newList.id, user_id: user.id, name: newList.name, order: newList.order });
    if (error) { console.error('[lists:insert]', error); return; }
    setLists(prev => [...prev, newList]);
    setActiveListId(newList.id);
    setNewListName("");
    setShowAddList(false);
    playClick();
  };
  const deleteList = async (id) => {
    // Move tasks in this list to null (no list)
    setTasks(prev => prev.map(t => t.listId === id ? { ...t, listId: null } : t));
    await supabase.from('tasks').update({ list_id: null }).eq('list_id', id).eq('user_id', user.id);
    await supabase.from('lists').delete().eq('id', id).eq('user_id', user.id);
    setLists(prev => prev.filter(l => l.id !== id));
    if (activeListId === id) setActiveListId(null);
    playClick();
  };
  const scheduleTask = (id, when) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, scheduledFor: when } : t));
    dbUpdate(id, { scheduled_for: when ?? null });
    playClick();
  };
  const deferTask = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, scheduledFor: "semana" } : t));
    dbUpdate(id, { scheduled_for: "semana" });
    playClick();
  };
  const moveTask = (id, dir) => {
    const pending = tasks.filter(t => !t.done).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const idx = pending.findIndex(t => t.id === id);
    if (idx === -1) return;
    const ni = idx + dir;
    if (ni < 0 || ni >= pending.length) return;
    const item = pending[idx];
    pending.splice(idx, 1);
    pending.splice(ni, 0, item);
    const newPending = pending.map((t, i) => ({ ...t, order: i }));
    setTasks([...newPending, ...tasks.filter(t => t.done)]);
    dbUpsertMany(newPending);
  };

  const handleSuggAction = (sugg) => {
    if (!sugg?.action) return;
    if (sugg.action.type === "unload") {
      // Move the LEAST urgent today task (highest priority number = low priority) to semana
      const p = { high: 2, medium: 1, low: 0 };
      const least = todayTasks.slice().sort((a, b) => (p[a.priority] ?? 1) - (p[b.priority] ?? 1))[0];
      if (least) { setTasks(prev => prev.map(t => t.id === least.id ? { ...t, scheduledFor: "semana" } : t)); dbUpdate(least.id, { scheduled_for: "semana" }); }
    }
    if (sugg.action.type === "suggest") {
      // Move top-priority pending tasks (from any section) to today
      const p = { high: 2, medium: 1, low: 0 };
      const allPending = tasks.filter(t => !t.done && t.scheduledFor !== "hoy");
      const ids = allPending.sort((a, b) => (p[b.priority] ?? 1) - (p[a.priority] ?? 1)).slice(0, 3).map(t => t.id);
      if (ids.length > 0) {
        setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, scheduledFor: "hoy" } : t));
        supabase.from('tasks').update({ scheduled_for: "hoy" }).in('id', ids).eq('user_id', user.id).then(({ error }) => { if (error) console.error('[db:suggest]', error); });
      }
    }
    if (sugg.action.type === "split" && sugg.action.taskId) {
      setSplitTargetId(sugg.action.taskId);
      // Auto-clear after user has had time to interact
      setTimeout(() => setSplitTargetId(null), 8000);
    }
    dismissSugg(sugg.id); playClick();
  };

  // Drag
  const dStart = (e, id) => { if (tasks.find(t => t.id === id)?.done) return; setDragId(id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(id)); };
  const dOver = (e, id) => { e.preventDefault(); if (!tasks.find(t => t.id === id)?.done) setDragOverId(id); };
  const dDrop = (e, tid) => {
    e.preventDefault();
    if (!dragId || dragId === tid) { setDragId(null); setDragOverId(null); return; }
    const dt = tasks.find(t => t.id === dragId);
    if (!dt || dt.done) { setDragId(null); setDragOverId(null); return; }
    const tt = tasks.find(t => t.id === tid);
    if (!tt) { setDragId(null); setDragOverId(null); return; }
    const ud = { ...dt, scheduledFor: tt.scheduledFor };
    let ap = tasks.filter(t => !t.done && t.id !== dragId);
    const ti = ap.findIndex(t => t.id === tid);
    ap.splice(ti, 0, ud);
    const newPending = ap.map((t, i) => ({ ...t, order: i }));
    setTasks([...newPending, ...tasks.filter(t => t.done)]);
    dbUpsertMany(newPending);
    setDragId(null); setDragOverId(null); playClick();
  };
  const dEnd = () => { setDragId(null); setDragOverId(null); };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";

  const renderList = (list) => list.map((task, i) => (
    <div key={task.id} draggable={!task.done} onDragStart={e => dStart(e, task.id)} onDragOver={e => dOver(e, task.id)} onDrop={e => dDrop(e, task.id)} onDragEnd={dEnd} style={{ animation: `fadeInUp 0.3s ease ${i * .03}s both` }}>
      <TaskItem task={task} onToggle={toggleTask} onDelete={deleteTask} onSplit={updateSubs} onAddSub={addSub} onSchedule={scheduleTask} onDefer={deferTask} onMove={moveTask} onUpdateText={updateText} onDelegate={delegateTask} onUnshare={unshareTask} isDragging={dragId === task.id} dragOver={dragOverId === task.id && dragId !== task.id} T={T} autoSplit={splitTargetId === task.id} />
    </div>
  ));

  const sectionH = (icon, title, count, minutes) => (
    <h2 style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", marginTop: "16px", padding: "0 2px", fontSize: "16px", fontWeight: 700, color: T.text }}>
      <span aria-hidden="true">{icon}</span> {title} <span style={{ fontSize: "13px", color: T.textMuted, fontWeight: 600 }}>({count})</span>
      {minutes > 0 && <span style={{ fontSize: "12px", color: T.textFaint, marginLeft: "auto", background: T.overlay, padding: "3px 10px", borderRadius: "8px", fontWeight: 600 }}><span aria-hidden="true">🕐</span> {fmt(minutes)}</span>}
    </h2>
  );

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans', sans-serif", position: "relative", paddingRight: wideEnough ? (showCanvas ? `${canvasWidth}px` : "48px") : 0, boxSizing: "border-box" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap');
        @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
        @keyframes confettiFall{0%{transform:translateY(-10px) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}
        @keyframes popIn{0%{transform:translateY(-50%) scale(0);opacity:0}60%{transform:translateY(-50%) scale(1.3)}100%{transform:translateY(-50%) scale(1);opacity:1}}
        @keyframes slideDown{0%{opacity:0;transform:translateY(-8px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes slideInRight{0%{opacity:0;transform:translateX(28px)}100%{opacity:1;transform:translateX(0)}}
        @keyframes audioBar{0%,100%{height:3px;opacity:0.4}50%{height:20px;opacity:1}}
        @keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}
        @keyframes fadeInUp{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{0%{opacity:0;transform:translateY(30px)}100%{opacity:1;transform:translateY(0)}}
        @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:0.01ms!important;transition-duration:0.01ms!important;}}
        *{box-sizing:border-box;margin:0;padding:0}
        input::placeholder,textarea::placeholder{color:${T.placeholder}}
        *:focus-visible{outline:2px solid ${T.focusRing};outline-offset:2px;border-radius:4px;}
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        button:active{transform:scale(0.97)}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(128,128,128,0.2);border-radius:2px}
        .sugg-scroll{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;-ms-overflow-style:none;padding-bottom:2px}
        .sugg-scroll::-webkit-scrollbar{display:none}
        .list-scroll::-webkit-scrollbar{display:none}
        .sugg-arrow{position:absolute;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:50%;border:1px solid rgba(128,128,128,0.15);background:rgba(255,255,255,0.85);backdrop-filter:blur(6px);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;color:rgba(80,80,80,0.7);box-shadow:0 2px 8px rgba(0,0,0,0.08);transition:opacity 0.2s,transform 0.15s;z-index:2;line-height:1}
        .sugg-arrow:hover{transform:translateY(-50%) scale(1.08);box-shadow:0 3px 12px rgba(0,0,0,0.13)}
        .dark .sugg-arrow{background:rgba(40,40,45,0.85);color:rgba(220,220,220,0.7);border-color:rgba(255,255,255,0.1)}
      `}</style>

      {/* Skip link */}
      <a href="#main-content" className="sr-only" style={{ position: "absolute", top: 0, left: 0, background: T.focusRing, color: "white", padding: "8px 16px", zIndex: 10000, fontSize: "14px" }}
        onFocus={e => Object.assign(e.currentTarget.style, { position: "static", clip: "auto", width: "auto", height: "auto" })}
        onBlur={e => Object.assign(e.currentTarget.style, { position: "absolute", clip: "rect(0,0,0,0)", width: "1px", height: "1px" })}>
        Ir al contenido
      </a>

      {/* Live region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">{announce}</div>

      <Confetti key={confettiKey} active={showConfetti} />

      {/* GLOBAL HEADER — full viewport width, above canvas */}
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 55, display: "flex", alignItems: "center", padding: "0 20px", height: "57px", background: T.panelBg, borderBottom: `1px solid ${T.border}`, backdropFilter: "blur(10px)" }}>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", fontWeight: 800, color: T.text, letterSpacing: "-0.5px", lineHeight: 1, display: "flex", alignItems: "center", flexShrink: 0 }}>
          to&nbsp;<span style={{ background: "linear-gradient(135deg, #E07A5F, #E6AA68)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>done</span>
          <span aria-hidden="true" style={{ fontSize: "8px", position: "relative", top: "-8px", color: "#E07A5F", WebkitTextFillColor: "#E07A5F", marginLeft: "2px" }}>✦</span>
        </h1>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          {!wideEnough && (
            <button onClick={() => { setMobileView(v => v === "list" ? "canvas" : "list"); playClick(); }} aria-label={mobileView === "canvas" ? "Ver lista" : "Ver canvas"} style={{ background: mobileView === "canvas" ? "linear-gradient(135deg, #E07A5F, #E6AA68)" : T.overlay, color: mobileView === "canvas" ? "white" : T.textFaint, border: "none", borderRadius: "10px", padding: "8px 10px", fontSize: "14px", cursor: "pointer" }}>
              <span aria-hidden="true">{mobileView === "canvas" ? "☰" : "◫"}</span>
            </button>
          )}
          {/* Avatar / Account menu */}
          <div ref={accountRef} style={{ position: "relative" }}>
            <button onClick={() => { setShowAccountMenu(!showAccountMenu); playClick(); }}
              aria-label="Menú de cuenta" aria-expanded={showAccountMenu} aria-haspopup="true"
              style={{
                width: "36px", height: "36px", borderRadius: "50%", border: `2px solid ${showAccountMenu ? "#E07A5F" : T.inputBorder}`,
                background: "linear-gradient(135deg, #E07A5F, #E6AA68)", color: "white",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "14px", fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                transition: "border-color 0.2s ease", lineHeight: 1,
              }}>
              {getUserName(user).charAt(0).toUpperCase()}
            </button>
            {showAccountMenu && (
              <div role="menu" aria-label="Opciones de cuenta"
                style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0, minWidth: "200px",
                  background: T.surface, borderRadius: "14px", border: `1px solid ${T.border}`,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.12)", padding: "8px", zIndex: 200,
                  animation: "slideDown 0.2s ease",
                }}>
                {/* User info */}
                <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.inputBorder}`, marginBottom: "4px" }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: T.text }}>{getUserName(user)}</p>
                  <p style={{ fontSize: "11px", color: T.textMuted, marginTop: "2px" }}>{user.email}</p>
                </div>
                {/* Menu items */}
                <button role="menuitem" onClick={() => { setShowAccountMenu(false); setShowChangePass(true); setChangePassMsg(null); setNewPass(""); setNewPassConfirm(""); }}
                  style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "10px", border: "none",
                    background: "transparent", cursor: "pointer", fontSize: "13px", color: T.text, fontWeight: 500,
                    fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: "10px" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.overlay}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  Mi cuenta
                </button>
                <button role="menuitem" onClick={() => { setShowAccountMenu(false); setDark(!dark); }}
                  style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "10px", border: "none",
                    background: "transparent", cursor: "pointer", fontSize: "13px", color: T.text, fontWeight: 500,
                    fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: "10px" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.overlay}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  {dark ? "Modo claro" : "Modo oscuro"}
                </button>
                <div style={{ height: "1px", background: T.inputBorder, margin: "4px 0" }} />
                <button role="menuitem" onClick={() => { setShowAccountMenu(false); onLogout(); }}
                  style={{ width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "10px", border: "none",
                    background: "transparent", cursor: "pointer", fontSize: "13px", color: "#E07A5F", fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: "10px" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.overlay}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="main-content" style={{ maxWidth: "520px", margin: "0 auto", padding: "77px 20px 190px" }}>
        <p style={{ fontSize: "15px", color: T.textMuted, fontWeight: 500, marginBottom: "16px" }}>{greeting}, {getUserName(user)} <span aria-hidden="true">✦</span></p>


        {!dbLoaded && (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <div style={{ width: "20px", height: "20px", border: `3px solid ${T.inputBorder}`, borderTopColor: "#E07A5F", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          </div>
        )}

        {dbLoaded && <>
        <KindStreak tasks={tasks} T={T} />

        {/* LIST SWITCHER */}
        {(lists.length > 0 || showAddList) && (
          <div style={{ marginBottom: "14px" }}>
            <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px", scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {/* "Todas" pill */}
              <button onClick={() => { setActiveListId(null); playClick(); }}
                style={{ flexShrink: 0, padding: "6px 14px", borderRadius: "20px", border: `1.5px solid ${activeListId === null ? "#E07A5F" : T.inputBorder}`, background: activeListId === null ? "rgba(224,122,95,0.1)" : T.overlay, color: activeListId === null ? "#E07A5F" : T.textMuted, fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                Todas
              </button>
              {lists.map(l => (
                <div key={l.id} style={{ position: "relative", flexShrink: 0, display: "flex", alignItems: "center" }}>
                  <button onClick={() => { setActiveListId(l.id); playClick(); }}
                    style={{ padding: "6px 14px", paddingRight: "32px", borderRadius: "20px", border: `1.5px solid ${activeListId === l.id ? "#E07A5F" : T.inputBorder}`, background: activeListId === l.id ? "rgba(224,122,95,0.1)" : T.overlay, color: activeListId === l.id ? "#E07A5F" : T.textMuted, fontSize: "13px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    {l.name}
                  </button>
                  <button onClick={() => deleteList(l.id)} aria-label={`Eliminar lista ${l.name}`}
                    style={{ position: "absolute", right: "8px", background: "none", border: "none", cursor: "pointer", color: T.textFaint, fontSize: "13px", lineHeight: 1, padding: "2px" }}>×</button>
                </div>
              ))}
              {/* Add list */}
              {showAddList ? (
                <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                  <input autoFocus value={newListName} onChange={e => setNewListName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addList(); if (e.key === "Escape") { setShowAddList(false); setNewListName(""); } }}
                    onBlur={() => { if (!newListName.trim()) { setShowAddList(false); setNewListName(""); } }}
                    placeholder="Nombre..." maxLength={30}
                    style={{ fontSize: "13px", padding: "5px 10px", borderRadius: "20px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, width: "120px" }} />
                  <button onClick={addList} style={{ padding: "5px 10px", borderRadius: "20px", background: "linear-gradient(135deg, #E07A5F, #E6AA68)", color: "white", border: "none", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>+</button>
                </div>
              ) : (
                <button onClick={() => { setShowAddList(true); playClick(); }}
                  style={{ flexShrink: 0, padding: "6px 12px", borderRadius: "20px", border: `1.5px dashed ${T.inputBorder}`, background: "transparent", color: T.textFaint, fontSize: "13px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                  + Lista
                </button>
              )}
            </div>
          </div>
        )}
        {!lists.length && !showAddList && (
          <div style={{ marginBottom: "10px" }}>
            <button onClick={() => { setShowAddList(true); playClick(); }}
              style={{ padding: "5px 12px", borderRadius: "20px", border: `1.5px dashed ${T.inputBorder}`, background: "transparent", color: T.textFaint, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
              + Nueva lista
            </button>
          </div>
        )}

        {/* AI suggestion cards — Claude-generated if available, rule-based fallback */}

        {(() => {
          const display = (aiSuggestions.length > 0 ? aiSuggestions : suggestions).filter(s => !dismissedSuggIds.has(s.id));
          if (display.length === 0) return null;
          const scrollSugg = (dir) => {
            const el = suggScrollRef.current;
            if (!el) return;
            const card = el.firstElementChild;
            const w = card ? card.offsetWidth + 10 : el.clientWidth * 0.85;
            el.scrollBy({ left: dir * w, behavior: 'smooth' });
          };
          const onSuggScroll = () => {
            const el = suggScrollRef.current;
            if (!el) return;
            setSuggAtStart(el.scrollLeft <= 8);
            setSuggAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
          };
          return (
            <div style={{ position: "relative", marginBottom: "14px" }}>
              {display.length > 1 && !suggAtStart && (
                <button className="sugg-arrow" onClick={() => scrollSugg(-1)} aria-label="Anterior sugerencia" style={{ left: "-13px" }}>‹</button>
              )}
              <div className="sugg-scroll" ref={suggScrollRef} onScroll={onSuggScroll} role="region" aria-label="Sugerencias">
                {display.map((sugg) => (
                  <div key={sugg.id} role="status" style={{ flex: "0 0 82%", scrollSnapAlign: "start", background: T.surface, borderRadius: "16px", padding: "13px 16px", display: "flex", flexDirection: "column", gap: "10px", border: `1px solid ${sugg.color ? sugg.color + "25" : T.border}`, borderLeft: `3px solid ${sugg.color || T.border}` }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                      <span aria-hidden="true" style={{ fontSize: "20px", flexShrink: 0 }}>{sugg.icon}</span>
                      <p style={{ fontSize: "14px", color: T.textSec, lineHeight: 1.5, fontWeight: 500, flex: 1 }}>{sugg.text}</p>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      {sugg.isAI ? <span style={{ fontSize: "10px", color: T.textFaint, fontWeight: 600, letterSpacing: "0.3px" }}>✦ ToDone</span> : <span />}
                      <div style={{ display: "flex", gap: "6px" }}>
                        {sugg.action && <button onClick={() => handleSuggAction(sugg)} aria-label="Aplicar sugerencia" style={{ background: sugg.color || "linear-gradient(135deg, #E07A5F, #E6AA68)", color: "white", border: "none", borderRadius: "10px", padding: "6px 14px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Dale</button>}
                        <button onClick={() => dismissSugg(sugg.id)} aria-label="Descartar sugerencia" style={{ background: T.overlay, color: T.textFaint, border: "none", borderRadius: "10px", padding: "6px 10px", fontSize: "14px", cursor: "pointer", lineHeight: 1 }}>✕</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {display.length > 1 && !suggAtEnd && (
                <button className="sugg-arrow" onClick={() => scrollSugg(1)} aria-label="Siguiente sugerencia" style={{ right: "-13px" }}>›</button>
              )}
            </div>
          );
        })()}

        {todayTotalMin > 0 && <TodayCard total={todayTotalMin} done={todayDoneMin} taskCount={todayTasks.length + tasks.filter(t => t.done && t.scheduledFor === "hoy" && t.doneAt && t.doneAt >= todayStart.getTime()).length} T={T} />}

        {/* HOY */}
        <section aria-label="Tareas de hoy">
          {sectionH("☀️", "Hoy", todayTasks.length, 0)}
          <div style={{ maxHeight: "clamp(180px, 38vh, 480px)", overflowY: "auto", paddingRight: "2px" }}>
            {todayTasks.length === 0
              ? <p style={{ textAlign: "center", padding: "24px 20px", color: T.textMuted, fontSize: "13px" }}>Sin tareas para hoy</p>
              : renderList(todayTasks)}
          </div>
        </section>

        {/* DESPUÉS */}
        {(weekTasks.length > 0 || unscheduled.length > 0) && (() => {
          const despues = [...weekTasks, ...unscheduled];
          const despuesMin = despues.reduce((s, t) => s + (t.minutes || 0), 0);
          return (
            <section aria-label="Tareas para después" style={{ marginTop: "8px" }}>
              {sectionH("📅", "Después", despues.length, despuesMin)}
              <div style={{ maxHeight: "clamp(180px, 38vh, 480px)", overflowY: "auto", paddingRight: "2px" }}>
                {renderList(despues)}
              </div>
            </section>
          );
        })()}

        {/* COMPLETADAS */}
        {doneTasks.length > 0 && (
          <section aria-label="Completadas" style={{ marginTop: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0 8px" }}>
              <div aria-hidden="true" style={{ flex: 1, height: "1px", background: T.borderDone }} />
              <span style={{ fontSize: "11px", color: T.textMuted, fontWeight: 600 }}>✓ Completadas ({doneTasks.length})</span>
              <div aria-hidden="true" style={{ flex: 1, height: "1px", background: T.borderDone }} />
            </div>
            <div style={{ maxHeight: "clamp(160px, 30vh, 400px)", overflowY: "auto", paddingRight: "2px" }}>
              {doneTasks.map((task, i) => <div key={task.id} style={{ animation: `fadeInUp 0.3s ease ${i * .02}s both` }}><TaskItem task={task} onToggle={toggleTask} onDelete={deleteTask} onSplit={updateSubs} onAddSub={addSub} onSchedule={scheduleTask} onDefer={deferTask} onMove={moveTask} onUpdateText={updateText} onDelegate={delegateTask} onUnshare={unshareTask} isDragging={false} dragOver={false} T={T} /></div>)}
            </div>
          </section>
        )}
        </>}
      </main>

      {/* CANVAS SIDE PANEL — desktop sidebar / mobile fullscreen */}
      {(wideEnough || (!wideEnough && mobileView === "canvas")) && (
        <div style={wideEnough
          ? { position: "fixed", top: "57px", right: 0, bottom: 0, width: showCanvas ? `${canvasWidth}px` : "48px", zIndex: 50, borderLeft: `1px solid ${T.border}`, display: "flex", flexDirection: "column", transition: isResizing ? "none" : "width 0.25s cubic-bezier(0.4,0,0.2,1)", overflow: "hidden" }
          : { position: "fixed", top: "57px", left: 0, right: 0, bottom: 0, zIndex: 200, display: "flex", flexDirection: "column", overflow: "hidden" }
        }>
          {/* RESIZE HANDLE — desktop only */}
          {wideEnough && showCanvas && (
            <div
              aria-hidden="true"
              style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "6px", cursor: "col-resize", zIndex: 10, background: "transparent", transition: "background 0.15s" }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                canvasResizeRef.current = { active: true, startX: e.clientX, startW: canvasWidth, lastW: canvasWidth };
                setIsResizing(true);
              }}
              onPointerMove={(e) => {
                if (!canvasResizeRef.current.active) return;
                const delta = canvasResizeRef.current.startX - e.clientX;
                const newW = Math.max(280, Math.min(window.innerWidth - 320, canvasResizeRef.current.startW + delta));
                canvasResizeRef.current.lastW = newW;
                setCanvasWidth(newW);
              }}
              onPointerUp={(e) => {
                if (!canvasResizeRef.current.active) return;
                canvasResizeRef.current.active = false;
                e.currentTarget.releasePointerCapture(e.pointerId);
                setIsResizing(false);
                localStorage.setItem("canvas_width", String(canvasResizeRef.current.lastW));
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(224,122,95,0.35)"; }}
              onMouseLeave={e => { if (!canvasResizeRef.current.active) e.currentTarget.style.background = "transparent"; }}
            />
          )}
          {(wideEnough && !showCanvas) ? (
            <div onClick={() => { setShowCanvas(true); playClick(); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "18px", gap: "10px", background: T.surface, height: "100%", cursor: "pointer" }}>
              <span style={{ fontSize: "18px", color: T.textMuted }}>‹</span>
              <span aria-hidden="true" style={{ fontSize: "15px", color: T.textFaint }}>◫</span>
              <span style={{ fontSize: "9px", color: T.textFaint, writingMode: "vertical-rl", transform: "rotate(180deg)", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>Canvas</span>
            </div>
          ) : (
            <NoteCanvas notes={canvasNotes} setNotes={setCanvasNotes} T={T} dark={dark}
              onCollapse={() => { wideEnough ? setShowCanvas(false) : setMobileView("list"); playClick(); }} />
          )}
        </div>
      )}

      {/* FIXED FOOTER */}
      <footer style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60, background: T.panelBg, borderTop: `1px solid ${T.border}`, padding: "14px 20px 16px", textAlign: "center" }}>
        <p style={{ fontSize: "12px", color: T.textMuted, lineHeight: 1.6, fontWeight: 500 }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: "13px", color: T.text }}>to <span style={{ color: "#E07A5F" }}>done</span></span> no tiene costos.
        </p>
        <p style={{ fontSize: "12px", color: T.textMuted, lineHeight: 1.6, marginTop: "2px" }}>
          Si te ayuda a organizarte, podés bancarnos con un{" "}
          <a href="https://cafecito.app/todone" target="_blank" rel="noopener noreferrer"
            style={{ color: "#E07A5F", fontWeight: 700, textDecoration: "none", borderBottom: "1.5px solid rgba(224,122,95,0.3)", paddingBottom: "1px" }}
            onMouseEnter={e => e.currentTarget.style.borderBottomColor = "#E07A5F"}
            onMouseLeave={e => e.currentTarget.style.borderBottomColor = "rgba(224,122,95,0.3)"}>
            ☕ cafecito
          </a>
        </p>
      </footer>

      {/* CHANGE PASSWORD PANEL */}
      {showChangePass && (
        <div role="dialog" aria-label="Cambiar contraseña" aria-modal="true"
          style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: T.panelBg, borderRadius: "24px 24px 0 0", padding: "24px 20px 36px", boxShadow: T.panelShadow, animation: "slideUp 0.35s cubic-bezier(0.4,0,0.2,1)", zIndex: 110 }}>
          <div style={{ maxWidth: "520px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: 700, color: T.text }}>Mi cuenta</h3>
                <p style={{ fontSize: "12px", color: T.textMuted, marginTop: "2px" }}>{user.email}</p>
              </div>
              <button onClick={() => setShowChangePass(false)} aria-label="Cerrar"
                style={{ background: "none", border: "none", fontSize: "20px", color: T.textFaint, cursor: "pointer" }}>✕</button>
            </div>

            <p style={{ fontSize: "12px", fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>Cambiar contraseña</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="password" value={newPass} onChange={e => { setNewPass(e.target.value); setChangePassMsg(null); }}
                placeholder="Nueva contraseña (mín. 6 caracteres)"
                aria-label="Nueva contraseña"
                style={{ width: "100%", fontSize: "15px", padding: "13px 16px", borderRadius: "12px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text }}
              />
              <input
                type="password" value={newPassConfirm} onChange={e => { setNewPassConfirm(e.target.value); setChangePassMsg(null); }}
                placeholder="Repetir nueva contraseña"
                aria-label="Repetir nueva contraseña"
                style={{ width: "100%", fontSize: "15px", padding: "13px 16px", borderRadius: "12px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text }}
              />
            </div>

            {changePassMsg && (
              <p role="alert" style={{ fontSize: "12px", color: changePassMsg.type === "ok" ? "#81B29A" : "#E07A5F", fontWeight: 600, marginTop: "10px" }}>
                {changePassMsg.text}
              </p>
            )}

            <button
              disabled={changePassLoading || !newPass || !newPassConfirm}
              onClick={async () => {
                if (newPass.length < 6) { setChangePassMsg({ type: "err", text: "Mínimo 6 caracteres" }); return; }
                if (newPass !== newPassConfirm) { setChangePassMsg({ type: "err", text: "Las contraseñas no coinciden" }); return; }
                setChangePassLoading(true);
                const { error } = await supabase.auth.updateUser({ password: newPass });
                setChangePassLoading(false);
                if (error) setChangePassMsg({ type: "err", text: error.message });
                else { setChangePassMsg({ type: "ok", text: "Contraseña actualizada" }); setNewPass(""); setNewPassConfirm(""); }
              }}
              style={{ width: "100%", marginTop: "16px", padding: "14px", borderRadius: "14px", border: "none", fontSize: "15px", fontWeight: 700, cursor: (changePassLoading || !newPass || !newPassConfirm) ? "default" : "pointer", background: (newPass && newPassConfirm && !changePassLoading) ? "linear-gradient(135deg, #E07A5F, #E6AA68)" : T.inputBorder, color: (newPass && newPassConfirm && !changePassLoading) ? "white" : T.textFaint }}>
              {changePassLoading ? "Guardando…" : "Guardar contraseña"}
            </button>
          </div>
        </div>
      )}

      {/* ADD PANEL */}
      {showAdd ? (
        <div role="dialog" aria-label="Nueva tarea" aria-modal="true" style={{ position: "fixed", bottom: kbHeight, left: 0, right: wideEnough ? (showCanvas ? `${canvasWidth}px` : "48px") : 0, background: T.panelBg, borderRadius: kbHeight > 0 ? "0" : "24px 24px 0 0", padding: "16px 20px 24px", boxShadow: T.panelShadow, animation: kbHeight > 0 ? "none" : "slideUp 0.35s cubic-bezier(0.4,0,0.2,1)", zIndex: 100 }}>
          <div style={{ maxWidth: "520px", margin: "0 auto" }}>
            {/* Mode tabs */}
            <div style={{ display: "flex", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", background: T.overlay, borderRadius: "10px", padding: "3px", gap: "2px", flex: 1 }}>
                <button onClick={() => { setQuickDump(false); setNewTask(""); }} style={{ flex: 1, padding: "6px 0", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, background: !quickDump ? T.surface : "transparent", color: !quickDump ? T.text : T.textFaint, boxShadow: !quickDump ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>Tarea</button>
                <button onClick={() => { setQuickDump(true); setQuickText(""); }} style={{ flex: 1, padding: "6px 0", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600, background: quickDump ? T.surface : "transparent", color: quickDump ? T.text : T.textFaint, boxShadow: quickDump ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>⚡ Volcado</button>
              </div>
              <button onClick={() => { setShowAdd(false); setAiResult(null); setNewTask(""); setQuickDump(false); setQuickText(""); }} aria-label="Cerrar" style={{ background: "none", border: "none", fontSize: "20px", color: T.textFaint, cursor: "pointer", marginLeft: "10px" }}>✕</button>
            </div>
            {quickDump ? (
              <>
                <p style={{ fontSize: "12px", color: T.textMuted, marginBottom: "8px", fontWeight: 600 }}>Una tarea por línea. La IA asigna día, prioridad y tiempo.</p>
                <textarea autoFocus value={quickText} onChange={e => setQuickText(e.target.value)} placeholder={"Llamar a Juan mañana\nPreparar presentación urgente 2h"} style={{ width: "100%", minHeight: "100px", fontSize: "14px", padding: "12px", borderRadius: "12px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text, resize: "none", lineHeight: 1.6, boxSizing: "border-box" }} />
                <button onClick={quickDumpAdd} style={{ width: "100%", marginTop: "10px", padding: "13px", borderRadius: "12px", background: quickText.trim() ? "linear-gradient(135deg, #E07A5F, #E6AA68)" : T.inputBorder, color: quickText.trim() ? "white" : T.textFaint, border: "none", fontSize: "14px", fontWeight: 700, cursor: quickText.trim() ? "pointer" : "default" }}>
                  Agregar {quickText.split("\n").filter(l => l.trim()).length || ""} tarea{quickText.split("\n").filter(l => l.trim()).length !== 1 ? "s" : ""}
                </button>
              </>
            ) : (
            <>
            <input autoFocus value={newTask} onChange={e => setNewTask(e.target.value)} onKeyDown={e => e.key === "Enter" && addTask()} aria-label="Texto de la tarea" placeholder="Ej: Preparar propuesta mañana 2h urgente..." style={{ width: "100%", fontSize: "16px", padding: "14px 16px", borderRadius: "14px", border: `1.5px solid ${T.inputBorder}`, background: T.inputBg, outline: "none", color: T.text }} />

            {newTask.trim().length > 3 && aiResult?.hasAny && (
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px", animation: "fadeInUp 0.2s ease" }}>
                <p style={{ fontSize: "10px", color: T.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>✦ ToDone sugiere</p>
                {aiResult?.hasAny && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                    {aiResult.priority && !aiAccepted.priority && <AIChip label="Prioridad" value={PRIORITIES[aiResult.priority]} reason={aiResult.priorityReason} color={aiResult.priority === "high" ? "#E07A5F" : aiResult.priority === "low" ? "#81B29A" : "#E6AA68"} onAccept={() => setAiAccepted(p => ({ ...p, priority: true }))} onDismiss={() => { }} T={T} />}
                    {aiResult.priority && aiAccepted.priority && <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: (aiResult.priority === "high" ? "#E07A5F" : "#81B29A") + "18", color: aiResult.priority === "high" ? "#E07A5F" : "#81B29A", fontWeight: 700 }}>✓ {PRIORITIES[aiResult.priority]}</span>}
                    {aiResult.scheduledFor && !aiAccepted.schedule && <AIChip label="Cuándo" value={aiResult.scheduledFor} reason={aiResult.scheduleReason} color="#3B9EC4" onAccept={() => setAiAccepted(p => ({ ...p, schedule: true }))} onDismiss={() => { }} T={T} />}
                    {aiResult.scheduledFor && aiAccepted.schedule && <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "rgba(86,204,242,0.12)", color: "#3B9EC4", fontWeight: 700 }}>✓ 📅 {aiResult.scheduledFor}</span>}
                    {aiResult.minutes && !aiAccepted.minutes && <AIChip label="Tiempo" value={fmt(aiResult.minutes)} reason={aiResult.minutesReason} color="#6B7280" onAccept={() => setAiAccepted(p => ({ ...p, minutes: true }))} onDismiss={() => { }} T={T} />}
                    {aiResult.minutes && aiAccepted.minutes && <span style={{ fontSize: "11px", padding: "4px 10px", borderRadius: "20px", background: "rgba(61,64,91,0.06)", color: "#6B7280", fontWeight: 700 }}>✓ 🕐 {fmt(aiResult.minutes)}</span>}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", marginTop: "14px", marginBottom: "14px" }}>
              <fieldset style={{ flex: 1, border: "none", padding: 0 }}>
                <legend style={{ fontSize: "10px", fontWeight: 700, color: T.textMuted, marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Prioridad</legend>
                <div style={{ display: "flex", gap: "4px" }}>
                  {Object.entries(PRIORITIES).map(([k, l]) => {
                    const active = (aiAccepted.priority && aiResult?.priority === k) || (!aiAccepted.priority && newPriority === k);
                    return <button key={k} onClick={() => { setNewPriority(k); setAiAccepted(p => ({ ...p, priority: false })); }} aria-pressed={active} style={{ flex: 1, padding: "6px", borderRadius: "10px", fontSize: "11px", fontWeight: 600, border: active ? "none" : `1.5px solid ${T.inputBorder}`, background: active ? (k === "high" ? "#E07A5F" : k === "medium" ? "#E6AA68" : "#81B29A") : T.inputBg, color: active ? "white" : T.textMuted, cursor: "pointer" }}>{l}</button>;
                  })}
                </div>
              </fieldset>
              <fieldset style={{ flex: 1, border: "none", padding: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
                  <legend style={{ fontSize: "10px", fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.5px" }}>Tiempo</legend>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: T.text }}>{fmt((aiAccepted.minutes && aiResult?.minutes) ? aiResult.minutes : newMinutes)}</span>
                </div>
                <input
                  type="range" min={0} max={EFFORT_OPTIONS.length - 1} step={1}
                  value={(() => { const cur = (aiAccepted.minutes && aiResult?.minutes) ? aiResult.minutes : newMinutes; return EFFORT_OPTIONS.reduce((ci, m, i) => Math.abs(m - cur) < Math.abs(EFFORT_OPTIONS[ci] - cur) ? i : ci, 0); })()}
                  onChange={e => { setNewMinutes(EFFORT_OPTIONS[+e.target.value]); setAiAccepted(p => ({ ...p, minutes: false })); }}
                  aria-label={`Tiempo estimado: ${fmt(newMinutes)}`}
                  style={{ width: "100%", cursor: "pointer", accentColor: "#E07A5F" }}
                />
                <div aria-hidden="true" style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                  {EFFORT_OPTIONS.map(m => <span key={m} style={{ fontSize: "9px", color: T.textFaint }}>{fmtS(m)}</span>)}
                </div>
              </fieldset>
            </div>

            <button onClick={addTask} disabled={!newTask.trim()} style={{ width: "100%", padding: "14px", borderRadius: "14px", background: newTask.trim() ? "linear-gradient(135deg, #E07A5F, #E6AA68)" : T.inputBorder, color: newTask.trim() ? "white" : T.textFaint, border: "none", fontSize: "15px", fontWeight: 700, cursor: newTask.trim() ? "pointer" : "default" }}>Agregar tarea</button>
            </>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setShowAdd(true); playClick(); }}
          aria-label="Nueva tarea"
          onMouseEnter={() => setAddBtnHover(true)}
          onMouseLeave={() => setAddBtnHover(false)}
          style={{
            position: "fixed", bottom: "84px", right: wideEnough ? (showCanvas ? `calc(${canvasWidth}px + 20px)` : "68px") : "20px",
            height: "52px", borderRadius: "26px",
            width: addBtnHover ? "176px" : "52px",
            background: "linear-gradient(135deg, #E07A5F, #E6AA68)",
            color: "white", border: "none",
            padding: addBtnHover ? "0 22px 0 16px" : "0",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            gap: addBtnHover ? "8px" : "0",
            boxShadow: "0 4px 24px rgba(224,122,95,0.35)", zIndex: 100,
            fontSize: "16px", fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap",
            transition: "width 0.25s cubic-bezier(0.4,0,0.2,1), padding 0.25s ease, gap 0.25s ease",
          }}>
          <span aria-hidden="true" style={{ fontSize: "28px", fontWeight: 300, lineHeight: 1, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: "28px", height: "28px" }}>+</span>
          <span style={{ overflow: "hidden", maxWidth: addBtnHover ? "120px" : "0", opacity: addBtnHover ? 1 : 0, transition: "max-width 0.25s ease, opacity 0.15s ease" }}>Nueva tarea</span>
        </button>
      )}
    </div>
  );
}
