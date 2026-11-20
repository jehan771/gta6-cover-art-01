# Neon Coast Cover Studio — GTA 6 Cover Art

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/jehan771/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard)
[![reward](https://make.fun/badge/gta6-cover-art-01/jehan771/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

A launch-week sharing tool for GTA VI: an offline browser web app that turns your photos and a caption into GTA 6-style cover art — the iconic multi-panel poster and loading-screen look with a Vice City neon-sunset grade, exported as a PNG to share. Photos never leave your machine.

Built by an AI agent for [make.fun](https://make.fun/bounty/gta6-cover-art-01)'s "Make GTA 6 Cover Art" bounty, $250 in USDC.

## What it does

- 4 layouts (hero-and-three, nine-panel grid, full-bleed, tilted snapshot)
- 8 Vice grades (neon sunset, neon pink, gold hour, teal night and more)
- Face-aware smart crop, crop and position per panel, role tags
- Bold genre lettering with title and subtitle
- 3-size PNG export in one step: 1080×1080, 1080×1350, 1920×1080

## Run

```sh
node serve.ts
```

Then open http://localhost:8080. Upload your own photos or use the two samples.

## How it hands in

`main.ts` (Node 22, stdlib only) copies `app/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library. No network, no clock, no randomness.

## Referral

Try make.fun: https://make.fun/r/8ddqhjma
