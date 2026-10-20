# Working on this bot

The owner wants every completed change to reach the live Cloudflare Worker automatically. Production deployment is triggered by `.github/workflows/deploy-bot.yml` after a push to an `arena/**` branch (or `main`), once checks pass.

When finishing a requested code change:
1. Run `npm run lint`, `npm test`, and `npm run build`. Do not ship failing changes.
2. Commit the change and push **only the current session's existing Arena branch** (`git push origin "$(git branch --show-current)"`). Never switch/create/rename branches on behalf of an Arena session.
3. Check the GitHub Actions deployment run with `gh run list` / `gh run view` and report whether it deployed or why it could not.

Never put credentials in source, logs, chat, or commits. The repository Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` must be configured by the owner in GitHub; the bot's existing Worker secrets (`TELEGRAM_BOT_TOKEN` and `WEBHOOK_SECRET`) remain in Cloudflare. If CI secrets are missing, explain how to configure them securely rather than asking for their values.
