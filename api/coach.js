import OpenAI from 'openai';

const SYSTEM = {
  ar: `Sos el coach personal de productividad de "To Done". Generás UN mensaje breve y personalizado.

Reglas:
- Máximo 2 oraciones (30 palabras total)
- Español rioplatense, tono directo y cálido (no cursi ni motivacional genérico)
- Sé específico: mencioná tareas por nombre, números concretos, fechas
- Variá el tipo de insight — no repitas siempre el mismo patrón. Elegí UNO de estos enfoques según lo más relevante:
  · Racha y consistencia: si lleva ≥3 días, reconocelo con dato concreto
  · Tareas demoradas o vencidas: avisá con nombre, sugerí acción
  · Sobrecarga (>480min): sugerí redistribuir
  · Progreso del día: si completó varias, reconocelo
  · Día vacío: si no tiene tareas para hoy pero sí pendientes
  · Delegación: si no delega nunca y tiene muchas tareas, sugerilo
  · Tarea más antigua: si hay algo pendiente hace muchos días, mencionalo
  · Patrón de productividad: usá el promedio/día para dar contexto
  · Subtareas: si una tarea grande no tiene subtareas, sugerí dividir
  · Fecha de vencimiento pasada: alertá con urgencia
- No uses emojis
- No saludes
- Respondé SOLO el mensaje, sin comillas ni formato`,

  es: `Eres el coach personal de productividad de "To Done". Generas UN mensaje breve y personalizado.

Reglas:
- Máximo 2 oraciones (30 palabras total)
- Español neutro, tono directo y cálido (no cursi ni motivacional genérico)
- Sé específico: menciona tareas por nombre, números concretos, fechas
- Varía el tipo de insight — no repitas siempre el mismo patrón. Elige UNO de estos enfoques según lo más relevante:
  · Racha y consistencia: si lleva ≥3 días, reconócelo con dato concreto
  · Tareas demoradas o vencidas: avisa con nombre, sugiere acción
  · Sobrecarga (>480min): sugiere redistribuir
  · Progreso del día: si completó varias, reconócelo
  · Día vacío: si no tiene tareas para hoy pero sí pendientes
  · Delegación: si no delega nunca y tiene muchas tareas, sugiérelo
  · Tarea más antigua: si hay algo pendiente hace muchos días, menciónalo
  · Patrón de productividad: usa el promedio/día para dar contexto
  · Subtareas: si una tarea grande no tiene subtareas, sugiere dividir
  · Fecha de vencimiento pasada: alerta con urgencia
- No uses emojis
- No saludes
- Responde SOLO el mensaje, sin comillas ni formato`,

  en: `You are the personal productivity coach of "To Done". Generate ONE short, personalized message.

Rules:
- Max 2 sentences (30 words total)
- English, direct and warm tone (not cheesy or generic motivational)
- Be specific: mention tasks by name, concrete numbers, dates
- Vary the type of insight — don't repeat the same pattern. Choose ONE of these approaches based on what's most relevant:
  · Streak and consistency: if ≥3 days, acknowledge with concrete data
  · Overdue or past-due tasks: flag by name, suggest action
  · Overload (>480min): suggest redistributing
  · Day progress: if completed several, acknowledge
  · Empty day: if no tasks for today but pending items exist
  · Delegation: if never delegates and has many tasks, suggest it
  · Oldest task: if something has been pending for many days, mention it
  · Productivity pattern: use daily average for context
  · Subtasks: if a large task has no subtasks, suggest splitting
  · Past due date: alert with urgency
- No emojis
- No greeting
- Respond ONLY the message, no quotes or formatting`,
};

const LABELS = {
  ar: { none: 'Ninguna', delayed: 'demorada', due: 'vence', hasSubs: 'tiene subtareas', deferred: 'pospuesta', dueWas: 'vencía', time: 'hs', user: 'usuario', streak: 'día', streakP: 'días', streakW: 'seguidos', todayTasks: 'Tareas de hoy', thisWeek: 'Esta semana', deferred_: 'Pospuestas', overdue: 'Demoradas', overdueDue: 'Vencidas por fecha límite', completedToday: 'Completadas hoy', plannedTime: 'Tiempo planeado', of: 'de', available: 'disponibles', unscheduled: 'Sin agendar', stats: 'Estadísticas', avgPerDay: 'Promedio completadas/día (últimos 7d)', completedLast7: 'Completadas últimos 7 días', totalPending: 'Total pendientes', delegated: 'Tareas delegadas', withSubs: 'Tareas con subtareas', oldest: 'Tarea más antigua sin resolver' },
  es: { none: 'Ninguna', delayed: 'demorada', due: 'vence', hasSubs: 'tiene subtareas', deferred: 'pospuesta', dueWas: 'vencía', time: 'hs', user: 'usuario', streak: 'día', streakP: 'días', streakW: 'seguidos', todayTasks: 'Tareas de hoy', thisWeek: 'Esta semana', deferred_: 'Pospuestas', overdue: 'Demoradas', overdueDue: 'Vencidas por fecha límite', completedToday: 'Completadas hoy', plannedTime: 'Tiempo planeado', of: 'de', available: 'disponibles', unscheduled: 'Sin agendar', stats: 'Estadísticas', avgPerDay: 'Promedio completadas/día (últimos 7d)', completedLast7: 'Completadas últimos 7 días', totalPending: 'Total pendientes', delegated: 'Tareas delegadas', withSubs: 'Tareas con subtareas', oldest: 'Tarea más antigua sin resolver' },
  en: { none: 'None', delayed: 'overdue', due: 'due', hasSubs: 'has subtasks', deferred: 'deferred', dueWas: 'was due', time: 'h', user: 'user', streak: 'day', streakP: 'days', streakW: 'in a row', todayTasks: "Today's tasks", thisWeek: 'This week', deferred_: 'Deferred', overdue: 'Overdue', overdueDue: 'Past due date', completedToday: 'Completed today', plannedTime: 'Planned time', of: 'of', available: 'available', unscheduled: 'Unscheduled', stats: 'Stats', avgPerDay: 'Avg completed/day (last 7d)', completedLast7: 'Completed last 7 days', totalPending: 'Total pending', delegated: 'Delegated tasks', withSubs: 'Tasks with subtasks', oldest: 'Oldest unresolved task' },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(200).json({ message: '' });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const {
    todayTasks = [], weekTasks = [], deferredTasks = [],
    doneTodayCount = 0, todayMinutes = 0, workdayMinutes = 480,
    unscheduledCount = 0, streak = 0, hour = 12, userName = '',
    overdueTasks = [], locale = 'ar',
    // Enriched stats
    avgCompletedPerDay = 0, completedLast7Days = 0, totalPending = 0,
    delegatedCount = 0, overdueByDueDate = [], tasksWithSubtasks = 0,
    oldestPendingTask = null,
  } = req.body;

  const l = LABELS[locale] || LABELS.ar;

  const todayStr = todayTasks.length > 0
    ? todayTasks.map(t => {
        let s = `- "${t.text}" (${t.priority || '?'}, ${t.minutes ?? '?'}min`;
        if (t.overdueDays > 0) s += `, ${t.overdueDays}d ${l.delayed}`;
        if (t.dueDate) s += `, ${l.due} ${t.dueDate}`;
        if (t.hasSubs) s += `, ${l.hasSubs}`;
        return s + ')';
      }).join('\n')
    : l.none;

  const weekStr = weekTasks.length > 0
    ? weekTasks.slice(0, 5).map(t => `"${t.text}"`).join(', ')
    : l.none.toLowerCase();

  const deferredStr = deferredTasks.length > 0
    ? deferredTasks.slice(0, 5).map(t => `"${t.text}" (${t.overdueDays || 0}d ${l.deferred})`).join(', ')
    : l.none.toLowerCase();

  const overdueStr = overdueTasks.length > 0
    ? overdueTasks.map(t => `"${t.text}" (${t.overdueDays}d ${l.delayed})`).join(', ')
    : l.none.toLowerCase();

  const dueDateStr = overdueByDueDate.length > 0
    ? overdueByDueDate.map(t => `"${t.text}" (${l.dueWas} ${t.dueDate})`).join(', ')
    : l.none.toLowerCase();

  const prompt = `${locale === 'en' ? `It's ${hour}:00.` : `Son las ${hour}${l.time}.`} ${locale === 'en' ? 'User' : 'Usuario'}: ${userName || l.user}.

${locale === 'en' ? 'Current streak' : 'Racha actual'}: ${streak} ${streak !== 1 ? l.streakP : l.streak} ${l.streakW}.

${l.todayTasks}:
${todayStr}

${l.thisWeek}: ${weekStr}
${l.deferred_}: ${deferredStr}
${l.overdue}: ${overdueStr}
${l.overdueDue}: ${dueDateStr}
${l.completedToday}: ${doneTodayCount}
${l.plannedTime}: ${todayMinutes}min ${l.of} ${workdayMinutes}min ${l.available}
${l.unscheduled}: ${unscheduledCount}

${l.stats}:
- ${l.avgPerDay}: ${avgCompletedPerDay}
- ${l.completedLast7}: ${completedLast7Days}
- ${l.totalPending}: ${totalPending}
- ${l.delegated}: ${delegatedCount}
- ${l.withSubs}: ${tasksWithSubtasks}${oldestPendingTask ? `\n- ${l.oldest}: "${oldestPendingTask.text}" (${oldestPendingTask.daysOld}d)` : ''}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content: SYSTEM[locale] || SYSTEM.ar,
        },
        { role: 'user', content: prompt },
      ],
    });

    const message = response.choices[0]?.message?.content?.trim() || '';
    return res.status(200).json({ message });
  } catch (err) {
    console.error('[coach] error:', err?.message);
    return res.status(200).json({ message: '' });
  }
}
