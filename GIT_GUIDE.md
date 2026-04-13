# Guide Git et GitHub

Ce guide sert de memoire rapide pour gerer le depot `Hockey_Pool_App`.

## Emplacement du projet

Travailler depuis:

```powershell
C:\Projet_Codex\Hockey_Pool_App
```

## Etat actuel

- depot Git local initialise
- branche principale: `main`
- remote GitHub:

```text
git@github.com:boucherdavid/DB_Hockey_Manager.git
```

- authentification GitHub via SSH

## Commandes Git essentielles

### Voir l'etat du depot

```powershell
git status
git log --oneline -5
git branch
```

### Voir les changements

```powershell
git diff
git diff --staged
```

### Sauvegarder ton travail

```powershell
git add .
git commit -m "Description claire du changement"
git push
```

### Recuperer les changements distants

```powershell
git pull
```

## Workflow recommande

Pour un petit changement:

```powershell
git status
git add .
git commit -m "Mon changement"
git push
```

Pour un changement plus gros:

```powershell
git checkout -b nom-de-branche
git add .
git commit -m "Travail sur ..."
git push -u origin nom-de-branche
```

Puis revenir sur `main`:

```powershell
git checkout main
git pull
```

## Branches

### Creer une branche

```powershell
git checkout -b nom-de-branche
```

### Changer de branche

```powershell
git checkout main
git checkout nom-de-branche
```

### Fusionner une branche dans `main`

```powershell
git checkout main
git pull
git merge nom-de-branche
git push
```

## GitHub CLI

Si `gh` est installe:

### Connexion

```powershell
gh auth login
```

### Consulter le repo

```powershell
gh repo view
gh browse
```

### Pull requests

```powershell
gh pr list
gh pr create
gh pr view
```

### Issues

```powershell
gh issue list
gh issue view 1
```

### GitHub Actions

```powershell
gh run list
gh run view
```

## Extensions VS Code recommandees

- `GitHub Pull Requests and Issues`
- `GitLens`
- `Git Graph`

## Bonnes habitudes

- faire des commits petits et frequents
- utiliser des messages de commit clairs
- verifier `git status` avant chaque commit
- creer une branche pour les changements risqués ou plus gros
- pousser regulierement vers GitHub

## A eviter

Ne pas utiliser sans etre certain:

```powershell
git reset --hard
git push --force
```

## Raccourci ultra simple

Quand tu veux juste sauvegarder ton travail:

```powershell
git add .
git commit -m "Mise a jour"
git push
```
