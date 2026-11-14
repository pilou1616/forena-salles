// Worker Förena : sert le plan des salles (dossier public/) et l'API des bilans de l'accueil (ADS).
// Liaison D1 : DB (voir wrangler.jsonc). Secret : ADS_PIN (tableau de bord Cloudflare).
const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function table(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS bilans (date TEXT NOT NULL, nom TEXT NOT NULL, plage INTEGER NOT NULL, recu_at TEXT NOT NULL, PRIMARY KEY (date, nom, plage))').run();
}

async function bilans(request, env) {
  if (!env.DB) return json({ erreur: 'base de données non liée' }, 503);
  if (request.method === 'GET') {
    const date = new URL(request.url).searchParams.get('date') || '';
    if (!DATE.test(date)) return json({ erreur: 'date invalide' }, 400);
    await table(env.DB);
    const { results } = await env.DB.prepare('SELECT nom, plage, recu_at FROM bilans WHERE date = ?').bind(date).all();
    return json({ date, items: results || [] });
  }
  if (request.method !== 'POST') return json({ erreur: 'méthode non permise' }, 405);
  if (!env.ADS_PIN) return json({ erreur: 'code non configuré' }, 503);
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
  const avant = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);   // on ne garde que la veille et le jour même
  await env.DB.prepare('DELETE FROM bilans WHERE date < ?').bind(avant).run();
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/bilans') {
      try { return await bilans(request, env); } catch (e) { return json({ erreur: 'erreur serveur' }, 500); }
    }
    return env.ASSETS.fetch(request);
  }
};
