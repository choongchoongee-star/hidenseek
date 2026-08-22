# THE ODD ONE

A single-player 3D observation game built for OpenAI Game Builders Seoul Track 1.

Choose a 6, 9, or 12-subject round. All but one subject follow one hidden behavior rule. Observe them and identify the odd subject within two accusations.

The complete and current game design is maintained in [theoddone.md](theoddone.md).

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The included GitHub Actions workflow deploys `dist` to GitHub Pages on pushes to `master` or `main`.
