import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function buildEmail({ listName, inviterName, inviterEmail, appUrl, isNewUser }) {
  const newUserNote = isNewUser
    ? `<p style="margin-top:20px;font-size:13px;color:#7E7A76;line-height:1.6;">to done es gratuito. Creá tu cuenta con este email y la lista aparecerá automáticamente.</p>`
    : '';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#111214;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:36px 28px;background:#1A1B1E;border-radius:16px;border:1px solid rgba(155,109,181,0.2);">
    <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:800;margin:0 0 4px;letter-spacing:-0.5px;">
      to <span style="color:#E07A5F;">done</span><span style="font-size:10px;color:#E07A5F;position:relative;top:-10px;margin-left:2px;">✦</span>
    </h1>
    <p style="margin:0 0 28px;font-size:13px;color:#7E7A76;">Gestión de tareas inteligente</p>

    <p style="font-size:15px;color:#C8C0B5;line-height:1.6;margin:0 0 20px;">
      <strong style="color:#E8E4DF;">${inviterName}</strong>
      <span style="color:#7E7A76;font-size:13px;">(${inviterEmail})</span>
      te invitó a una lista compartida:
    </p>

    <div style="background:#26272D;border-radius:14px;padding:20px 24px;border-left:3px solid #9B6DB5;margin-bottom:28px;">
      <p style="font-size:17px;font-weight:700;color:#E8E4DF;margin:0;line-height:1.4;">👥 ${listName}</p>
    </div>

    <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#9B6DB5,#7B4F9B);color:#fff;text-decoration:none;padding:13px 28px;border-radius:12px;font-size:14px;font-weight:700;">
      ${isNewUser ? 'Crear cuenta y ver lista →' : 'Ver lista →'}
    </a>

    ${newUserNote}

    <hr style="margin:28px 0;border:none;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="margin:0;font-size:12px;color:#4A4A52;">
      Este mensaje fue enviado porque alguien te invitó a una lista compartida en <a href="${appUrl}" style="color:#9B6DB5;text-decoration:none;">to done</a>.
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

  const { listId, listName, inviteeEmail, inviterId, inviterEmail, inviterName } = req.body;

  if (!listId || !listName || !inviteeEmail || !inviterId || !inviterEmail) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  if (inviteeEmail.toLowerCase() === inviterEmail.toLowerCase()) {
    return res.status(400).json({ error: 'No podés invitarte a vos mismo' });
  }

  // Verify the inviter owns this list
  const { data: list, error: listErr } = await supabaseAdmin
    .from('lists')
    .select('user_id')
    .eq('id', listId)
    .single();

  if (listErr || !list || list.user_id !== inviterId) {
    return res.status(403).json({ error: 'Solo el dueño puede compartir la lista' });
  }

  // Find invitee in auth.users
  const { data: found, error: rpcErr } = await supabaseAdmin
    .rpc('find_user_by_email', { email_input: inviteeEmail });

  if (rpcErr) {
    console.error('[share-list:rpc]', rpcErr);
    return res.status(500).json({ error: rpcErr.message });
  }

  const existingUser = found?.[0] ?? null;
  const isNewUser = !existingUser;

  // Ensure owner is in list_members as 'owner' (idempotent)
  await supabaseAdmin
    .from('list_members')
    .upsert({
      list_id: listId,
      user_id: inviterId,
      email: inviterEmail,
      display_name: inviterName,
      role: 'owner',
      invited_by: inviterId,
    }, { onConflict: 'list_id,email' });

  // Upsert invitee as member
  const { error: memberErr } = await supabaseAdmin
    .from('list_members')
    .upsert({
      list_id: listId,
      user_id: existingUser?.user_id ?? null,
      email: inviteeEmail,
      display_name: existingUser?.display_name ?? inviteeEmail.split('@')[0],
      role: 'member',
      invited_by: inviterId,
    }, { onConflict: 'list_id,email' });

  if (memberErr) {
    console.error('[share-list:member]', memberErr);
    return res.status(500).json({ error: memberErr.message });
  }

  // Send email
  if (process.env.RESEND_API_KEY) {
    const appUrl = process.env.VITE_APP_URL || process.env.APP_URL || 'https://to-done.vercel.app';
    const subject = isNewUser
      ? `${inviterName} te invitó a una lista en to done`
      : `${inviterName} compartió una lista contigo en to done`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'to done <noti@todone.com.ar>',
        to: inviteeEmail,
        subject,
        html: buildEmail({ listName, inviterName, inviterEmail, appUrl, isNewUser }),
      }),
    });

    if (!emailRes.ok) {
      const errData = await emailRes.json().catch(() => ({}));
      console.error('[share-list:email]', errData);
    }
  }

  // Create notification for existing user
  if (existingUser) {
    await supabaseAdmin.rpc('create_notification', {
      p_user_id: existingUser.user_id,
      p_type: 'task_delegated',
      p_task_id: listId,
      p_task_text: `Te invitaron a la lista "${listName}"`,
      p_from_user_id: inviterId,
      p_from_name: inviterName,
      p_from_email: inviterEmail,
    });
  }

  return res.json({
    status: isNewUser ? 'invited' : 'shared',
    message: isNewUser ? 'Invitación enviada' : 'Miembro agregado',
    member: existingUser ? {
      userId: existingUser.user_id,
      email: inviteeEmail,
      displayName: existingUser.display_name,
      role: 'member',
    } : null,
  });
}
