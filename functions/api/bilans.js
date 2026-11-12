// Cloudflare Pages Function : bilans de santé reçus à l'accueil des soins (ADS).
// Liaison D1 requise : DB. Secret requis : ADS_PIN.
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function table(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS bilans (date TEXT NOT NULL, nom TEXT NOT NULL, plage INTEGER NOT NULL, recu_at TEXT NOT NULL, PRIMARY KEY (date, nom, plage))').run();
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ erreur: 'base de données non liée' }, 503);
  const date = new URL(request.url).searchParams.get('date') || '';
  if (!DATE.test(date)) return json({ erreur: 'date invalide' }, 400);
  await table(env.DB);
  const { results } = await env.DB.prepare('SELECT nom, plage, recu_at FROM bilans WHERE date = ?').bind(date).all();
  return json({ date, items: results || [] });
}

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.ADS_PIN) return json({ erreur: 'service non configuré' }, 503);
  let b; try { b = await request.json(); } catch (e) { return json({ erreur: 'requête invalide' }, 400); }
  if (!b || String(b.pin || '') !== String(env.ADS_PIN)) return json({ erreur: 'code incorrect' }, 401);
  if (b.action === 'login') return json({ ok: true });
  const date = String(b.date || ''), nom = String(b.nom || '').trim(), plage = Number(b.plage);
  if (!DATE.test(date) || !nom || nom.length > 80 || !Number.isInteger(plage) || plage < 1 || plage > 10)
    return json({ erreur: 'données invalides' }, 400);
  await table(env.DB);
  if (b.recu) {
    await env.DB.prepare('INSERT OR REPLACE INTO bilans (date, nom, plage, recu_at) VALUES (?, ?, ?, ?)')
      .bind(date, nom, plage, new Date().toISOString()).run();
  } else {
    await env.DB.prepare('DELETE FROM bilans WHERE date = ? AND nom = ? AND plage = ?').bind(date, nom, plage).run();
  }
  // ménage : on ne garde que hier et après
  const hier = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
  await env.DB.prepare('DELETE FROM bilans WHERE date < ?').bind(hier).run();
  return json({ ok: true });
}
