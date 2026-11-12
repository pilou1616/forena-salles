/* Accueil des soins (ADS) : « bilan reçu » par soin, visible par la masso. Données : /api/bilans (Cloudflare D1). */
(function () {
  const $ = id => document.getElementById(id);
  const css = document.createElement('style');
  css.textContent = `
  #ads h2{display:flex;justify-content:space-between;align-items:center;gap:8px}
  #ads .sortir{font-size:.8rem;padding:6px 10px}
  .ads-plage{margin:12px 0 4px;font-weight:700;color:var(--sub);font-size:.85rem;letter-spacing:.04em}
  .ads-plage.maint{color:#b3261e}
  .ads-liste{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}
  .ads-item{display:flex;justify-content:space-between;align-items:center;gap:8px;border:1px solid var(--gris);border-radius:10px;padding:10px 12px;background:var(--carte);cursor:pointer;text-align:left;font:inherit;color:var(--txt)}
  .ads-item .s{font-weight:700;font-size:1.05rem;min-width:2.2em}
  .ads-item .n{flex:1}
  .ads-item .e{font-size:.8rem;color:var(--sub)}
  .ads-item.ok{background:#d8efe0;border-color:#5aa46f;color:#1d4d2b}
  .ads-item.ok .e{color:#1d4d2b;font-weight:600}
  @media (prefers-color-scheme:dark){.ads-item.ok{background:#1f3d2a;color:#cfeedd}.ads-item.ok .e{color:#cfeedd}}
  .bilan-banniere{margin-top:10px;display:flex;flex-direction:column;gap:6px}
  .bilan-ligne{border-radius:10px;padding:10px 12px;background:var(--vide);font-size:.95rem}
  .bilan-ligne.ok{background:#2e7d4f;color:#fff;font-weight:700;font-size:1.05rem}
  td.bilan-ok{box-shadow:inset 0 0 0 3px #2e7d4f}
  td.bilan-ok::after{content:" ✓";color:#2e7d4f;font-weight:800}
  .dlg{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:10}
  .dlg div{background:var(--carte);color:var(--txt);border-radius:14px;padding:18px;width:min(320px,90vw)}
  .dlg input{font:inherit;font-size:1.3rem;width:100%;padding:10px;border-radius:8px;border:1px solid var(--gris);margin:10px 0;text-align:center;letter-spacing:.3em;background:var(--carte);color:var(--txt)}
  .dlg .act{display:flex;gap:8px;justify-content:flex-end}
  .dlg .err{color:#b3261e;font-size:.85rem;min-height:1.2em}`;
  document.head.appendChild(css);

  let pin = null; try { pin = sessionStorage.getItem('forena-ads-pin'); } catch (e) {}
  let etat = { date: null, items: {} }, dernier = null, api = true;
  const cle = (nom, p) => nom + '|' + p;
  const heure = iso => { try { const d = new Date(iso); return d.getHours() + 'h' + String(d.getMinutes()).padStart(2, '0'); } catch (e) { return ''; } };
  const aujourdHui = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const separer = n => n.split(/\s*(?:\/|&|\+|,|\bet\b)\s*/).map(x => x.trim()).filter(Boolean);

  async function charger(date) {
    try {
      const r = await fetch('/api/bilans?date=' + date, { cache: 'no-store' });
      if (!r.ok) throw 0;
      const j = await r.json();
      const items = {}; (j.items || []).forEach(x => { items[cle(x.nom, x.plage)] = x.recu_at; });
      etat = { date, items }; api = true;
    } catch (e) { api = false; etat = { date, items: {} }; }
  }

  function soinsDuJour(r) {
    const out = [];
    const ALL = Moteur.ALL;
    for (let p = 0; p < 10; p++) for (let j = 0; j < ALL.length; j++) {
      const c = r.grille[p][j]; if (!c || /^Test-/.test(c.nom) || c.type === 'test') continue;
      separer(c.nom).forEach(n => out.push({ p: p + 1, salle: ALL[j], nom: n }));
    }
    return out;
  }

  function peindre() {
    if (!dernier) return;
    const { r, nom, date, plages } = dernier;
    // marques ✓ dans la grille
    document.querySelectorAll('#grille td[data-p]').forEach(td => {
      const ok = separer(td.dataset.nom).some(n => etat.items[cle(n, td.dataset.p)]);
      td.classList.toggle('bilan-ok', !!ok);
    });
    // bannière de la masso
    const moi = $('moi');
    moi.querySelectorAll('.bilan-banniere').forEach(x => x.remove());
    if (nom && date === aujourdHui() && api && !r.ferme) {
      const mnt = new Date(), m0 = mnt.getHours() * 60 + mnt.getMinutes();
      const deb = lab => { const [h, m] = lab.split('h').map(Number); return h * 60 + (m || 0); };
      const mes = soinsDuJour(r).filter(s => s.nom === nom && (etat.items[cle(s.nom, s.p)] || deb(plages[s.p - 1]) + 75 > m0));
      if (mes.length) {
        const b = document.createElement('div'); b.className = 'bilan-banniere';
        b.innerHTML = mes.map(s => {
          const t = etat.items[cle(s.nom, s.p)];
          return t ? `<div class="bilan-ligne ok">✓ ${plages[s.p - 1]} · salle ${s.salle} — bilan reçu à ${heure(t)} : ton client t'attend à l'accueil</div>`
                   : `<div class="bilan-ligne">${plages[s.p - 1]} · salle ${s.salle} — bilan pas encore reçu</div>`;
        }).join('');
        moi.appendChild(b);
      }
    }
    // mode accueil
    const sec = $('ads');
    if (!pin) { sec.hidden = true; $('btn-ads').textContent = 'Mode accueil'; return; }
    sec.hidden = false; $('btn-ads').textContent = 'Accueil ✓';
    if (r.ferme) { sec.innerHTML = '<h2>Accueil des soins</h2><div>Le spa est fermé cette journée.</div>'; return; }
    const soins = soinsDuJour(r);
    const maintenant = new Date(); const minutes = maintenant.getHours() * 60 + maintenant.getMinutes();
    const debut = lab => { const [h, m] = lab.split('h').map(Number); return h * 60 + (m || 0); };
    let html = `<h2>Accueil des soins — bilans reçus <button class="sortir" id="ads-sortir">Quitter le mode accueil</button></h2>`;
    if (!api) html += `<div class="alerte">Connexion au service des bilans impossible pour le moment.</div>`;
    html += `<div class="e" style="color:var(--sub);font-size:.85rem">Touchez un soin quand son bilan de santé est reçu. Touchez de nouveau pour annuler.</div>`;
    for (let p = 1; p <= 10; p++) {
      const l = soins.filter(s => s.p === p).sort((a, b) => a.salle - b.salle);
      if (!l.length) continue;
      const enCours = date === aujourdHui() && minutes >= debut(plages[p - 1]) - 75 && minutes < debut(plages[p - 1]) + 15;
      html += `<div class="ads-plage${enCours ? ' maint' : ''}" id="ads-p${p}">${plages[p - 1]}${enCours ? ' · à venir' : ''}</div><div class="ads-liste">`;
      html += l.map(s => {
        const t = etat.items[cle(s.nom, s.p)];
        return `<button type="button" class="ads-item${t ? ' ok' : ''}" data-nom="${s.nom.replace(/"/g, '')}" data-p="${s.p}">
          <span class="s">${s.salle}</span><span class="n">${s.nom}</span><span class="e">${t ? '✓ ' + heure(t) : 'Bilan ?'}</span></button>`;
      }).join('') + '</div>';
    }
    sec.innerHTML = html;
    $('ads-sortir').onclick = () => { pin = null; try { sessionStorage.removeItem('forena-ads-pin'); } catch (e) {} peindre(); };
    sec.querySelectorAll('.ads-item').forEach(b => b.onclick = () => basculer(b.dataset.nom, Number(b.dataset.p)));
  }

  async function basculer(nom, p) {
    const date = dernier.date, k = cle(nom, p), recu = !etat.items[k];
    etat.items[k] = recu ? new Date().toISOString() : undefined; peindre();
    try {
      const r = await fetch('/api/bilans', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin, date, nom, plage: p, recu }) });
      if (r.status === 401) { pin = null; try { sessionStorage.removeItem('forena-ads-pin'); } catch (e) {} alerteCode(); }
      await charger(date);
    } catch (e) { api = false; }
    peindre();
  }

  function alerteCode() { ouvrirDialogue('Code expiré ou invalide. Entrez le code de l’accueil.'); }

  function ouvrirDialogue(msg) {
    const d = document.createElement('div'); d.className = 'dlg';
    d.innerHTML = `<div><strong>Mode accueil (ADS)</strong><div style="font-size:.85rem;color:var(--sub)">${msg || 'Entrez le code de l’accueil.'}</div>
      <input id="ads-pin" type="password" inputmode="numeric" autocomplete="off"><div class="err" id="ads-err"></div>
      <div class="act"><button type="button" id="ads-annuler">Annuler</button><button type="button" id="ads-ok">Entrer</button></div></div>`;
    document.body.appendChild(d);
    const champ = d.querySelector('#ads-pin'); champ.focus();
    const fermer = () => d.remove();
    d.querySelector('#ads-annuler').onclick = fermer;
    const valider = async () => {
      const essai = champ.value.trim(); if (!essai) return;
      try {
        const r = await fetch('/api/bilans', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pin: essai, action: 'login' }) });
        if (r.ok) {
          pin = essai; try { sessionStorage.setItem('forena-ads-pin', essai); } catch (e) {} fermer();
          const auj = aujourdHui(), D = window.FORENA && window.FORENA.data;
          if (D && dernier.date !== auj && D.jours.some(j => j.date === auj)) { location.hash = auj; return; }
          await charger(dernier.date); peindre();
          const cible = document.querySelector('.ads-plage.maint') || $('ads'); cible.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        else d.querySelector('#ads-err').textContent = r.status === 401 ? 'Code incorrect.' : 'Service des bilans indisponible.';
      } catch (e) { d.querySelector('#ads-err').textContent = 'Service des bilans indisponible.'; }
    };
    d.querySelector('#ads-ok').onclick = valider;
    champ.onkeydown = e => { if (e.key === 'Enter') valider(); };
  }

  $('btn-ads').onclick = () => { if (pin) { $('ads').scrollIntoView({ behavior: 'smooth' }); } else ouvrirDialogue(); };

  window.addEventListener('forena:rendu', async e => {
    dernier = e.detail;
    if (etat.date !== dernier.date) await charger(dernier.date);
    peindre();
  });
  setInterval(async () => {
    if (!dernier || document.hidden) return;
    if (!pin && !(dernier.nom && dernier.date === aujourdHui())) return;
    await charger(dernier.date); peindre();
  }, 20000);
  if (window.FORENA) window.FORENA.rendre();
})();
