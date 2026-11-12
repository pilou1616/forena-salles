/* Moteur d'attribution des salles — reproduit l'onglet « Salles » du classeur de couverture Förena.
   Entrée : data (plan.json) et un index de jour (0 = 1er du mois). Sortie : grille 10 plages × 18 salles. */
(function (root) {
  const ROOMS = [1, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 16, 17, 18];   // massothérapie (index 1..14)
  const LR = [13, 15, 5, 9];                                          // dernier recours (index 15..18)
  const ALL = ROOMS.concat(LR);
  const ESTHE = [5, 9];
  const NP = 10;

  function blocInfo(data, txt) { const b = data.blocs[txt]; return b ? { s: b[0], n: b[1] } : { s: 0, n: 0 }; }

  // Calcul : début, nombre de soins faisables, durée (avec pause), plage de pause
  function preparer(data, d, esthe) {
    const out = [];
    const last = data.dernierePlage;
    data.reponses.forEach((rep, k) => {
      if (!rep) return;
      const eq = data.equipe[rep.nom] || { groupe: 9, pause: 0, pref: 0, dept: 'Massothérapie' };
      const isE = eq.dept === 'Esthétique';
      if (isE !== esthe || !rep.inclure) return;
      const { s, n } = blocInfo(data, rep.jours[d] || '');
      if (!s) return;
      const a = last - s + 1, c = eq.pause || 0;
      let n0 = (c >= 1 && c < n && a > c) ? Math.min(n, a - 1) : Math.min(n, a);
      n0 = Math.max(0, n0);
      if (!n0) return;
      const span = n0 + ((c >= 1 && c < n0) ? 1 : 0);
      const pz = (c >= 1 && c < n0) ? s + c : 0;
      const groupe = (eq.groupe >= 1 && eq.groupe <= 3) ? eq.groupe : 9;
      out.push({ nom: rep.nom, K: s, L: s + span, M: pz, key: s * 10000 + groupe * 100 + (k + 1), pref: eq.pref || 0, demandes: n, faits: n0 });
    });
    out.sort((x, y) => x.key - y.key);
    return out;
  }

  // Moteur générique (même logique que « Calcul salles »)
  function attribuer(P, rooms, lrRooms, blk) {
    const NR = rooms.length, NA = NR + lrRooms.length;
    const room = P.map(() => new Array(NP + 1).fill(0));
    const AM = P.map(p => { const i = rooms.indexOf(p.pref); return i >= 0 ? i + 1 : 0; });
    const reserved = new Array(NR + 1).fill(0);
    AM.forEach(a => { if (a) reserved[a] = 1; });
    const pres = (i, p) => P[i].K <= p && P[i].L > p && P[i].M !== p;
    for (let p = 1; p <= NP; p++) {
      const CO = new Array(NA + 1).fill(0), HL = new Array(NA + 1).fill(0), HR = new Array(NA + 1).fill(0);
      if (p > 1) P.forEach((x, i) => { if (pres(i, p) && room[i][p - 1] >= 1 && room[i][p - 1] <= NA) CO[room[i][p - 1]]++; });
      for (let j = 1; j <= NA; j++) {
        if (p > 1 && !blk[j][p]) HL[j] = P.some((x, i) => x.M === p && room[i][p - 1] === j) ? 1 : 0;
        if (p >= 3) HR[j] = P.some((x, i) => x.M === p - 1 && room[i][p - 2] === j && x.K <= p && x.L > p) ? 1 : 0;
      }
      let holdok = 0;
      if (p > 1) {
        let free = 0, hl = 0, contc = 0, pc = 0;
        for (let j = 1; j <= NR; j++) { if (!blk[j][p] && CO[j] === 0) free++; hl += HL[j]; contc += (1 - blk[j][p]) * CO[j]; }
        P.forEach((x, i) => { if (pres(i, p)) pc++; });
        holdok = (free - hl >= pc - contc) ? 1 : 0;
      }
      const tr = new Array(NA + 1).fill(0);
      for (let j = 1; j <= NA; j++) tr[j] = blk[j][p] ? 1 : CO[j] + ((holdok && HL[j]) ? 1 : 0);
      // continuité, salle visée, réclamations
      const cont = P.map((x, i) => p > 1 && room[i][p - 1] >= 1 && room[i][p - 1] <= NA && !blk[room[i][p - 1]][p]);
      const ret = P.map((x, i) => p >= 3 && x.M === p - 1 && room[i][p - 2] >= 1 && room[i][p - 2] <= NA);
      const EP = P.map((x, i) => ret[i] ? room[i][p - 2] : AM[i]);
      const cl = P.map(() => 0);
      P.forEach((x, i) => {
        const ep = EP[i];
        if (!ep || !pres(i, p) || cont[i]) return;
        if (tr[ep] !== 0) return;
        if (!ret[i] && HR[ep] !== 0) return;
        for (let q = 0; q < i; q++) if (cl[q] && EP[q] === ep) return;
        cl[i] = 1;
      });
      const rc = new Array(NR + 1).fill(0);
      P.forEach((x, i) => { if (cl[i] && EP[i] >= 1 && EP[i] <= NR) rc[EP[i]] = 1; });
      const libre = new Array(NR + 1).fill(0);
      for (let j = 1; j <= NR; j++) libre[j] = (tr[j] === 0 && rc[j] === 0) ? 1 : 0;
      const fr = new Array(NR + 1).fill(0);
      let totNR = 0; for (let j = 1; j <= NR; j++) totNR += libre[j] * (1 - reserved[j]);
      let a = 0, b = 0;
      for (let j = 1; j <= NR; j++) {
        if (!libre[j]) continue;
        if (!reserved[j]) { a++; fr[j] = a; } else { b++; fr[j] = totNR + b; }
      }
      let cum = 0;
      P.forEach((x, i) => {
        if (!pres(i, p)) { room[i][p] = 0; return; }
        if (cont[i]) { room[i][p] = room[i][p - 1]; return; }
        if (cl[i]) { room[i][p] = EP[i]; return; }
        cum++;
        let j = 0; for (let t = 1; t <= NR; t++) if (fr[t] === cum) { j = t; break; }
        if (j) { room[i][p] = j; return; }
        let pick = 99;
        for (let kk = 1; kk <= lrRooms.length; kk++) {
          const idx = NR + kk;
          let busy = 0; for (let q = p; q < x.L && q <= NP; q++) busy += blk[idx][q];
          if (busy) continue;
          if (tr[idx] !== 0) continue;
          let taken = false; for (let q = 0; q < i; q++) if (room[q][p] === idx) { taken = true; break; }
          if (taken) continue;
          pick = idx; break;
        }
        room[i][p] = pick;
      });
    }
    return room;
  }

  function calculerJour(data, d) {
    const jour = data.jours[d];
    const date = jour.date;
    const vide = () => Array.from({ length: NP }, () => ALL.map(() => null));
    if (!jour || jour.ferme) return { date, ferme: true, grille: vide(), personnes: [], esthe: [] };
    const plages = data.plages;
    // esthétique
    const PE = preparer(data, d, true);
    const blkE = Array.from({ length: 3 }, () => new Array(NP + 1).fill(0));
    const roomE = attribuer(PE, ESTHE, [], blkE);
    // massothérapie : salles bloquées
    const blk = Array.from({ length: ALL.length + 1 }, () => new Array(NP + 1).fill(0));
    const testsJ = data.tests.filter(t => t.date === date);
    const ajJ = data.ajustements.filter(a => a.date === date);
    const actif = a => a.nom && a.nom.toLowerCase() !== 'libre';
    for (let p = 1; p <= NP; p++) {
      ALL.forEach((num, j0) => {
        const j = j0 + 1;
        let b = testsJ.some(t => t.plage === p && t.salle === num);
        if (num === 13 || num === 15) b = b || ajJ.some(a => a.salle === num && actif(a));
        if (num === 5 || num === 9) {
          b = PE.some((x, i) => roomE[i][p] === (num === 5 ? 1 : 2)) || ajJ.some(a => a.salle === num && a.plage === plages[p - 1] && actif(a));
        }
        blk[j][p] = b ? 1 : 0;
      });
    }
    const PM = preparer(data, d, false);
    const roomM = attribuer(PM, ROOMS, LR, blk);
    // grille affichée
    const grille = [];
    for (let p = 1; p <= NP; p++) {
      const ligne = ALL.map((num, j0) => {
        const j = j0 + 1;
        const aj = ajJ.find(a => a.salle === num && a.plage === plages[p - 1]);
        if (aj) return aj.nom.toLowerCase() === 'libre' ? null : { nom: aj.nom, type: 'ajustement' };
        const t = testsJ.find(t => t.plage === p && t.salle === num);
        if (num === 5 || num === 9) {
          const ie = PE.findIndex((x, i) => roomE[i][p] === (num === 5 ? 1 : 2));
          if (ie >= 0) return { nom: PE[ie].nom, type: 'esthe' };
          const im = PM.findIndex((x, i) => roomM[i][p] === j);
          return im >= 0 ? { nom: PM[im].nom, type: 'recours' } : null;
        }
        if (t && (j <= 14 ? blk[j][p] : true)) return { nom: 'Test-' + t.nom, type: 'test' };
        const im = PM.findIndex((x, i) => roomM[i][p] === j);
        if (im < 0) return null;
        return { nom: PM[im].nom, type: j > 14 ? 'recours' : 'masso' };
      });
      grille.push(ligne);
    }
    const resume = (P, room, nums) => P.map((x, i) => {
      const seq = []; for (let p = 1; p <= NP; p++) if (room[i][p] >= 1 && room[i][p] <= nums.length) seq.push(nums[room[i][p] - 1]);
      const sans = room[i].filter(v => v === 99).length;
      return { nom: x.nom, salles: [...new Set(seq)], debut: plages[x.K - 1], fin: data.fins[Math.min(x.L, NP + 1) - 2] || '21h30',
               pause: x.M ? plages[x.M - 1] : '', sans, perdus: x.demandes - x.faits, plagesSalle: room[i].slice(1).map(v => v >= 1 && v <= nums.length ? nums[v - 1] : (v === 99 ? 'sans' : null)) };
    });
    return { date, ferme: false, grille, personnes: resume(PM, roomM, ALL), esthe: resume(PE, roomE, ESTHE) };
  }

  const api = { calculerJour, ALL, ROOMS, LR, ESTHE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Moteur = api;
})(this);
