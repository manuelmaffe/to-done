import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.OPENAI_API_KEY) return res.status(200).json({ message: '' });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const {
    todayTasks = [], weekTasks = [], deferredTasks = [],
    doneTodayCount = 0, todayMinutes = 0, workdayMinutes = 480,
    unscheduledCount = 0, streak = 0, hour = 12, userName = '',
    overdueTasks = [],
    // Enriched stats
    avgCompletedPerDay = 0, completedLast7Days = 0, totalPending = 0,
    delegatedCount = 0, overdueByDueDate = [], tasksWithSubtasks = 0,
    oldestPendingTask = null,
  } = req.body;

  const todayStr = todayTasks.length > 0
    ? todayTasks.map(t => {
        let s = `- "${t.text}" (${t.priority || '?'}, ${t.minutes ?? '?'}min`;
        if (t.overdueDays > 0) s += `, ${t.overdueDays}d demorada`;
        if (t.dueDate) s += `, vence ${t.dueDate}`;
        if (t.hasSubs) s += `, tiene subtareas`;
        return s + ')';
      }).join('\n')
    : 'Ninguna';

  const weekStr = weekTasks.length > 0
    ? weekTasks.slice(0, 5).map(t => `"${t.text}"`).join(', ')
    : 'ninguna';

  const deferredStr = deferredTasks.length > 0
    ? deferredTasks.slice(0, 5).map(t => `"${t.text}" (${t.overdueDays || 0}d pospuesta)`).join(', ')
    : 'ninguna';

  const overdueStr = overdueTasks.length > 0
    ? overdueTasks.map(t => `"${t.text}" (${t.overdueDays}d demorada)`).join(', ')
    : 'ninguna';

  const dueDateStr = overdueByDueDate.length > 0
    ? overdueByDueDate.map(t => `"${t.text}" (vencía ${t.dueDate})`).join(', ')
    : 'ninguna';

  const prompt = `Son las ${hour}hs. Usuario: ${userName || 'usuario'}.

Racha actual: ${streak} día${streak !== 1 ? 's' : ''} seguidos.

Tareas de hoy:
${todayStr}

Esta semana: ${weekStr}
Pospuestas: ${deferredStr}
Demoradas: ${overdueStr}
Vencidas por fecha límite: ${dueDateStr}
Completadas hoy: ${doneTodayCount}
Tiempo planeado: ${todayMinutes}min de ${workdayMinutes}min disponibles
Sin agendar: ${unscheduledCount}

Estadísticas:
- Promedio completadas/día (últimos 7d): ${avgCompletedPerDay}
- Completadas últimos 7 días: ${completedLast7Days}
- Total pendientes: ${totalPending}
- Tareas delegadas: ${delegatedCount}
- Tareas con subtareas: ${tasksWithSubtasks}${oldestPendingTask ? `\n- Tarea más antigua sin resolver: "${oldestPendingTask.text}" (${oldestPendingTask.daysOld}d)` : ''}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 150,
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content: `Sos el coach personal de productividad de "To Done". Generás UN mensaje breve y personalizado.

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
