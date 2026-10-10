# Operator final checks — the few steps only the operator can do

- [ ] Create the public repository, push, confirm the `About` panel shows the licence.
  Proof: `git remote get-url origin` prints an `https://github.com/` URL.
- [ ] Confirm `design_documents/showcase.json` `repo_url` and `live_url` are the real ones.
  Proof: `npx vite-node scripts/showcase-config.ts` prints `showcase.json: live <url>`.
- [ ] After uploading the video, replace `video_url` in `showcase.json` with its address, then run `judge-kit render`, `readme lint` and `claims lint`.
  Proof: the three tools print `judge-kit: OK`, `readme: OK`, `claims: OK (<n> claims)`.
- [ ] Run the deployed gate once more.
  Proof: `BASE_URL=<live_url> npx playwright test e2e/smoke.spec.ts` shows `4 passed`.
- [ ] Run the whole browser suite once on the final commit.
  Proof: `npm run e2e` prints `full: 59 passed, 0 failed, 1 skipped` (or `60 passed, 0 failed, 0 skipped` with a Bedrock route).
- [ ] Run the showcase gate online (DP-SUBMISSION runs it as its last step).
  Proof: `npx vite-node hee/src/showcase/cli.ts gate --entry . --online` prints `showcase gate OK`.
- [ ] Open the live URL in a private window with no sign-in and press `Load the sample week` and `Review the week`.
  Proof: the page shows the calendar and the review ends.
