import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text } = req.body;
  if (!text || text.trim().length < 3) return res.status(400).json({});

  if (!process.env.ANTHROPIC_API_KEY) return res.status(200).json({});

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: `Analizás tareas de trabajo y estimás prioridad, cuándo hacerlas y tiempo realista.

Respondé ÚNICAMENTE con JSON válido (sin markdown ni texto extra):
{"priority":"high"|"medium"|"low"|null,"priorityReason":"...","scheduledFor":"hoy"|"semana"|null,"scheduleReason":"...","minutes":number|null,"minutesReason":"..."}

Reglas de tiempo (sé realista, no subestimes):
- Mensaje/email rápido: 5-15min
- Llamada: 15-30min
- Reunión/revisión: 30-60min
- Redactar documento: 60-120min
- Presentación, propuesta, informe: 90-180min
- Proyecto técnico, desarrollo: 120-300min
Si no hay info suficiente para un campo, devolvé null.`,
      messages: [{ role: 'user', content: `Tarea: "${text.trim()}"` }],
    });

    const parsed = JSON.parse(message.content[0].text.trim());
    return res.status(200).json(parsed);
  } catch (e) {
    console.error('[estimate]', e?.message);
    return res.status(200).json({});
  }
}
