# Indicateurs de Séquence — Pool de Hockey

Documentation des indicateurs pour mettre en évidence les joueurs en bonne ou mauvaise séquence.

---

## 🔥 Joueurs en feu (bonne séquence)

### Indicateurs de production récente

| Indicateur | Description | Seuil suggéré |
|---|---|---|
| **Streak actif** | Nombre de matchs consécutifs avec au moins 1 point | 🔥 3+ matchs |
| **Points récents** | Total de points sur les X derniers matchs | 🔥 5 pts en 3 matchs |
| **Tendance haussière** | Comparaison des 5 derniers matchs vs les 5 précédents | 🔥 +50% ou plus |
| **Tirs en hausse** | Nombre de tirs sur les 5 derniers matchs vs moyenne | 🔥 Top 15% |
| **Ratio pts/match accéléré** | Ratio en accélération sur les 10 derniers matchs | 🔥 > 1.0 pts/match |

### Indicateurs contextuels

- **Calendrier favorable** : prochains adversaires avec un mauvais bilan défensif
- **Promotion de ligne** : passage au premier trio ou première unité de power play (PP1)
- **Retour de blessure en forme** : 3+ matchs productifs depuis le retour

---

## 🧊 Joueurs en froid (mauvaise séquence)

### Indicateurs de disette

| Indicateur | Description | Seuil suggéré |
|---|---|---|
| **Disette active** | Matchs consécutifs sans point | 🧊 5+ matchs |
| **Tendance baissière** | Comparaison des 5 derniers matchs vs les 5 précédents | 🧊 -50% ou plus |
| **Tirs en baisse** | Nombre de tirs en dessous de la moyenne personnelle | 🧊 Bottom 15% |
| **Temps de glace en baisse** | TOI moyen en recul vs saison | 🧊 -20% ou plus |

### Signaux d'alarme

- **Rétrogradation de ligne** : passage à un trio inférieur ou retrait du PP
- **Calendrier difficile** : prochains adversaires avec une bonne défense
- **Blessure probable** : baisse soudaine de TOI sans explication

---

## 📈 Indicateur intermédiaire — En progression

Pour les joueurs qui remontent la pente sans être encore "en feu" :

| Indicateur | Description | Seuil suggéré |
|---|---|---|
| **Remontée** | Amélioration sur 2-3 matchs après une disette | 📈 1+ pt après 4+ matchs blancs |
| **Tirs sans résultat** | Beaucoup de tirs, peu de buts (régression probable) | ⚠️ PDO bas + tirs élevés |

---

## 🏷️ Badges & Étiquettes suggérés

```
🔥 EN FEU        → Streak 4+ matchs avec point
📈 EN HAUSSE     → Tendance +50% sur 5 matchs
✅ EN FORME      → Streak 2-3 matchs avec point
⚠️ À SURVEILLER  → Tirs élevés, peu de buts (régression positive attendue)
🧊 EN FROID      → 5+ matchs sans point
📉 EN BAISSE     → Tendance -50% sur 5 matchs
🚨 EN CRISE      → 8+ matchs sans point ou rétrogradation de ligne
```

---

## ⚙️ Paramètres configurables (recommandés)

Permettre à l'utilisateur de personnaliser les fenêtres d'analyse :

```json
{
  "fenetreRecente": 5,         // Nombre de matchs pour la période "récente"
  "fenetrePrecedente": 5,      // Nombre de matchs pour la période de comparaison
  "seuilStreakChaud": 3,        // Matchs consécutifs pour badge "En feu"
  "seuilDisette": 5,            // Matchs sans point pour badge "En froid"
  "seuilTendanceHausse": 0.5,  // +50% = tendance haussière
  "seuilTendanceBaisse": -0.5  // -50% = tendance baissière
}
```

---

## 🧮 Formules de calcul

### Score de tendance
```
tendance = (pointsPériodeRécente / matchsPériodeRécente)
         - (pointsPériodePrécédente / matchsPériodePrécédente)
```

### Ratio points/match récent
```
ratioPtsMatch = totalPointsDerniersNMatchs / N
```

### Indice de forme (0 à 100)
```
indiceForme = (streak * 10)
            + (tendance * 20)
            + (ratioTirs * 10)
            + (ratioPtsMatch * 60)
```
> Peut être utilisé pour trier les joueurs du plus en forme au moins en forme.

---

## 🎨 Présentation visuelle recommandée

### Carte joueur

```
┌─────────────────────────────────┐
│ 🔥  Connor McDavid   EDM - C    │
│ ─────────────────────────────── │
│  Derniers 5 matchs :  8 pts     │
│  Streak :             4 matchs  │
│  Tendance :           ↑ +120%   │
│  Tirs :               ↑ Top 5%  │
└─────────────────────────────────┘
```

### Code couleur

| État | Couleur | Badge |
|---|---|---|
| En feu | `#FF4500` (orange-rouge) | 🔥 |
| En hausse | `#32CD32` (vert) | 📈 |
| Neutre | `#888888` (gris) | — |
| En baisse | `#FFA500` (orange) | 📉 |
| En froid | `#4169E1` (bleu glacier) | 🧊 |
| En crise | `#DC143C` (rouge foncé) | 🚨 |

---

## 📝 Notes légales & Sources de données

- Les **concepts et indicateurs** décrits ici sont librement utilisables (pas de droits d'auteur sur les idées).
- Les **données statistiques** doivent provenir d'une source autorisée :
  - NHL API non officielle (gratuite, usage personnel)
  - SportsRadar / Sportradar (payante, usage commercial)
  - Données internes du pool (aucune restriction)
- Ne pas reproduire le **design visuel** d'applications existantes (ESPN, Dobber, etc.).
