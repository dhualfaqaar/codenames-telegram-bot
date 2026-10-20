# Working on this bot

The owner uses Cloudflare Workers Builds (GitHub integration) to deploy the live Worker. Do not add a second GitHub Actions deployment workflow or request GitHub Actions Cloudflare secrets: the existing Cloudflare integration handles builds/deployments.

After a requested code change:
1. Run `npm run lint`, `npm test`, and `npm run build`. Do not ship failing changes.
2. Commit and push **only the current session's existing Arena branch** (`git push origin "$(git branch --show-current)"`). Never switch/create/rename branches on behalf of an Arena session. Cloudflare Builds receives the GitHub push; saving files locally alone does not trigger a build.
3. Inspect the Cloudflare Workers Builds check for the pushed commit with `gh pr checks` or `gh api repos/dhualfaqaar/codenames-telegram-bot/commits/<sha>/check-runs`. A successful local build or a successful `wrangler preview` is not proof of a live deployment. Branch previews use isolated Durable Objects and cannot receive production Telegram webhooks. If the Cloudflare build fails or the pushed branch is not configured as the production branch, tell the owner clearly; do not claim the bot was updated.

Never put Cloudflare/Telegram credentials in code, logs, commits, or chat. Existing Worker secrets (`TELEGRAM_BOT_TOKEN` and `WEBHOOK_SECRET`) stay in Cloudflare.
