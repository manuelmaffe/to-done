import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function fmtMin(min) {
  if (!min) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function priorityLabel(p) {
  return p === 'high' ? 'Alta' : p === 'low' ? 'Baja' : 'Media';
}
function priorityColor(p) {
  return p === 'high' ? '#E07A5F' : p === 'low' ? '#81B29A' : '#E6AA68';
}

function buildEmail({ taskText, taskPriority, taskMinutes, assignerName, assignerEmail, appUrl, isNewUser }) {
  const pc = priorityColor(taskPriority);
  const pl = priorityLabel(taskPriority);
  const dur = fmtMin(taskMinutes);
  const newUserNote = isNewUser
    ? `<p style="margin-top:20px;font-size:13px;color:#7E7A76;line-height:1.6;">to done es gratuito. Creá tu cuenta con este email y la tarea aparecerá automáticamente en tu lista.</p>`
    : '';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111214;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:36px 28px;background:#1A1B1E;border-radius:16px;border:1px solid rgba(224,122,95,0.15);">
    <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:800;margin:0 0 4px;letter-spacing:-0.5px;">
      to <span style="color:#E07A5F;">done</span><span style="font-size:10px;color:#E07A5F;position:relative;top:-10px;margin-left:2px;">✦</span>
    </h1>
    <p style="margin:0 0 28px;font-size:13px;color:#7E7A76;">Gestión de tareas inteligente</p>

    <p style="font-size:15px;color:#C8C0B5;line-height:1.6;margin:0 0 20px;">
      <strong style="color:#E8E4DF;">${assignerName}</strong>
      <span style="color:#7E7A76;font-size:13px;">(${assignerEmail})</span>
      te delegó una tarea:
    </p>

    <div style="background:#26272D;border-radius:14px;padding:20px 24px;border-left:3px solid ${pc};margin-bottom:28px;">
      <p style="font-size:17px;font-weight:700;color:#E8E4DF;margin:0 0 12px;line-height:1.4;">${taskText}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <span style="font-size:12px;font-weight:700;color:${pc};background:${pc}22;padding:4px 12px;border-radius:20px;text-transform:uppercase;">${pl}</span>
        ${dur ? `<span style="font-size:12px;font-weight:600;color:#AEA9A2;background:rgba(255,255,255,0.06);padding:4px 12px;border-radius:20px;">🕐 ${dur}</span>` : ''}
      </div>
    </div>

    <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#E07A5F,#E6AA68);color:#fff;text-decoration:none;padding:13px 28px;border-radius:12px;font-size:14px;font-weight:700;">
      ${isNewUser ? 'Crear cuenta y ver tarea →' : 'Ver tarea →'}
    </a>

    ${newUserNote}

    <hr style="margin:28px 0;border:none;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0;font-size:12px;color:#4A4A52;">
      Este mensaje fue enviado porque alguien te delegó una tarea en <a href="${appUrl}" style="color:#E07A5F;text-decoration:none;">to done</a>.
    </p>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Service role key not configured' });
  }

  const {
    taskId,
    taskText,
    taskPriority,
    taskMinutes,
    assigneeEmail,
    assignerId,
    assignerEmail,
    assignerName,
  } = req.body;

  if (!taskId || !taskText || !assigneeEmail || !assignerId || !assignerEmail) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  if (assigneeEmail.toLowerCase() === assignerEmail.toLowerCase()) {
    return res.status(400).json({ error: 'No podés delegarte a vos mismo' });
  }

  // Find assignee in auth.users via security-definer RPC
  const { data: found, error: rpcErr } = await supabaseAdmin
    .rpc('find_user_by_email', { email_input: assigneeEmail });

  if (rpcErr) {
    console.error('[delegate:rpc]', rpcErr);
    return res.status(500).json({ error: rpcErr.message });
  }

  const existingUser = found?.[0] ?? null;
  const isNewUser = !existingUser;

  // Upsert task_share record
  const { error: shareErr } = await supabaseAdmin
    .from('task_shares')
    .upsert({
      task_id: taskId,
      owner_id: assignerId,
      owner_email: assignerEmail,
      owner_name: assignerName,
      shared_with_email: assigneeEmail,
      shared_with_user_id: existingUser?.user_id ?? null,
    }, { onConflict: 'task_id,shared_with_email' });

  if (shareErr) {
    console.error('[delegate:share]', shareErr);
    return res.status(500).json({ error: shareErr.message });
  }

  // Send email notification (existing user) or invitation (new user)
  if (process.env.RESEND_API_KEY) {
    const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://to-done.vercel.app';
    const subject = isNewUser
      ? `${assignerName} te asignó una tarea en to done`
      : `${assignerName} te delegó una tarea en to done`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'to done <onboarding@resend.dev>',
        to: assigneeEmail,
        subject,
        html: buildEmail({ taskText, taskPriority, taskMinutes, assignerName, assignerEmail, appUrl, isNewUser }),
      }),
    });

    if (!emailRes.ok) {
      const errData = await emailRes.json().catch(() => ({}));
      console.error('[delegate:email]', errData);
      // Don't fail the whole request — the share was created, email is best-effort
    }
  }

  return res.json({
    status: isNewUser ? 'invited' : 'shared',
    message: isNewUser ? 'Invitación enviada' : 'Tarea compartida',
  });
}
