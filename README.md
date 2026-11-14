# Plan des salles — Förena

Page publique (Cloudflare Pages) qui montre le plan des salles de soins pour chaque journée du mois.
Chaque thérapeute choisit la journée et son nom : sa salle et ses heures sont mises en évidence.

## Fichiers
| Fichier | Rôle |
|---|---|
| `index.html` | La page (aucune installation, aucun build). |
| `moteur.js` | Calcul des salles : reproduit l'onglet « Salles » du classeur de couverture (continuité, salle préférée, pause, tests, salles duo et esthé en dernier recours). |
| `public/data/plan.json` | Données du mois : réponses du Form, équipe (groupe, pause, salle préférée), ajustements, tests. Aucune donnée financière. |
| `tools/extraire_donnees.py` | Produit `public/data/plan.json` à partir du classeur de couverture. |

## Mise à jour
`public/data/plan.json` est régénéré à partir du classeur de couverture (SharePoint) puis poussé ici ; Cloudflare republie la page en moins d'une minute.
La page ouverte se recharge seule toutes les 10 minutes.

## Lien direct vers une journée
`https://forena-salles.pages.dev/#2026-12-26`

## Mode accueil (ADS) — bilans reçus
- Bouton « Mode accueil » en haut à droite, protégé par un code (secret Cloudflare `ADS_PIN`).
- L'accueil touche un soin quand le bilan de santé est reçu ; la masso voit la bannière verte et un ✓ dans la grille (mise à jour aux 20 s).
- Hébergement : Worker Cloudflare « forena-salles » (fichiers du site dans `public/`, API dans `worker.js`, réglages dans `wrangler.jsonc`).
- Données : base D1 « forena-ads » liée sous le nom `DB`, créée au premier déploiement (on ne garde que la veille et le jour même).
- API : `worker.js` (GET `?date=AAAA-MM-JJ`, POST `{pin, date, nom, plage, recu}`).
