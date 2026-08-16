# THE ODD ONE

A single-player 3D observation game built for OpenAI Game Builders Seoul Track 1.

Twelve subjects wander through a behavioral test site. Eleven share one hidden behavior rule; one does not. Watch closely and identify the odd subject in three accusations.

The complete and current game design is maintained in [theoddone.md](theoddone.md).

## Controls

- `WASD` — move
- Mouse — look
- `Q` / `E` — descend / ascend
- `Shift` — boost
- Left click — accuse the subject under the crosshair
- `Esc` — release the cursor

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
