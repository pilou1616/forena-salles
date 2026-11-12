"""Extrait du classeur de couverture les seules données nécessaires au plan des salles.
Usage : python3 extraire_donnees.py Couverture.xlsx data.json
Aucune donnée financière n'est copiée (pas de budget, pas de rangs)."""
import sys, json, datetime as dt, warnings
import openpyxl
warnings.filterwarnings('ignore')

src, dst = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src, data_only=True)

def iso(v):
    if isinstance(v, dt.datetime): return v.date().isoformat()
    if isinstance(v, dt.date): return v.isoformat()
    return None

P = wb['Paramètres']
plages = [str(P.cell(19 + i, 1).value) for i in range(10)]
fins = [str(P.cell(19 + i, 4).value) for i in range(10)]
derniere = int(P['B16'].value)

B = wb['Budget']
jours = []
for r in range(5, 36):
    d = iso(B.cell(r, 2).value)
    if d: jours.append({'date': d, 'jour': B.cell(r, 3).value, 'ferme': B.cell(r, 6).value == 'Fermé', 'ferie': B.cell(r, 7).value == 'Férié'})

BL = wb['Blocs']
blocs = {}
for r in range(5, 81):
    lab = BL.cell(r, 13).value
    if lab: blocs[str(lab)] = [int(BL.cell(r, 14).value or 0), int(BL.cell(r, 15).value or 0)]

E = wb['Équipe']
equipe = {}
for r in range(5, 201):
    n = E.cell(r, 1).value
    if not n: continue
    g = E.cell(r, 5).value; pz = E.cell(r, 8).value; pr = E.cell(r, 10).value
    equipe[n] = {'groupe': int(g) if isinstance(g, (int, float)) else 9,
                 'pause': int(pz) if isinstance(pz, (int, float)) else 0,
                 'pref': int(pr) if isinstance(pr, (int, float)) else 0,
                 'dept': E.cell(r, 9).value or 'Massothérapie'}

R = wb['Réponses']
reponses = []
for r in range(3, 83):
    n = R.cell(r, 1).value
    if not n:
        reponses.append(None); continue
    inc = R.cell(r, 34).value
    reponses.append({'nom': n, 'inclure': 1 if isinstance(inc, (int, float)) and inc == 1 else 0,
                     'jours': [str(R.cell(r, 2 + i).value) if R.cell(r, 2 + i).value not in (None, '') else '' for i in range(31)]})

AJ = wb['Ajustements salles']
ajustements = []
for r in range(5, 305):
    d = iso(AJ.cell(r, 1).value)
    if d and AJ.cell(r, 3).value:
        ajustements.append({'date': d, 'plage': str(AJ.cell(r, 2).value or ''), 'salle': int(AJ.cell(r, 3).value), 'nom': str(AJ.cell(r, 4).value or '')})

T = wb['Tests et entrevues']
tests = []
for r in range(6, 106):
    d = iso(T.cell(r, 1).value)
    if d and T.cell(r, 2).value and T.cell(r, 4).value:
        tests.append({'date': d, 'plage': plages.index(str(T.cell(r, 2).value)) + 1 if str(T.cell(r, 2).value) in plages else 0,
                      'salle': int(T.cell(r, 4).value), 'nom': str(T.cell(r, 5).value or '')})

out = {'genere': dt.datetime.now().isoformat(timespec='minutes'), 'mois': jours[0]['date'][:7] if jours else '',
       'plages': plages, 'fins': fins, 'dernierePlage': derniere, 'jours': jours, 'blocs': blocs,
       'equipe': equipe, 'reponses': reponses, 'ajustements': ajustements, 'tests': tests}
json.dump(out, open(dst, 'w'), ensure_ascii=False, indent=0)
print('ok', len([x for x in reponses if x]), 'réponses,', len(jours), 'jours')
