# Outabit privacy-friendly analytics

This folder contains the free Cloudflare Workers + D1 aggregate collector used by the static GitHub Pages website. The deployed Worker is `outabit-analytics`, and the public collection endpoint is configured in `../analytics-config.js`.

## What it measures

- Aggregate visits (one per browser tab session), page views, and Android beta download clicks.
- Counts are grouped by UTC day, page path, and broad referral category.
- Recognized sources: LinkedIn, Facebook, Instagram, YouTube, Google, Bing, DuckDuckGo, tagged email/newsletter links, direct, internal, and other.
- Source tags use `utm_source`. Only the broad allowlisted label is sent; the query string is not sent or stored.

Visits are browser sessions, not unique people. A visitor who opens the site in two separate tabs or sessions can count twice.

## Source-tagged links

Use these links in social profiles and posts when reliable attribution matters:

- LinkedIn: `https://outabit.com/?utm_source=linkedin`
- Facebook: `https://outabit.com/?utm_source=facebook`
- YouTube: `https://outabit.com/?utm_source=youtube`
- Instagram: `https://outabit.com/?utm_source=instagram`
- Email: `https://outabit.com/?utm_source=email`

The browser referrer is used when available. Some apps and privacy settings suppress it, so source tags are more dependable.

## What it deliberately does not collect

- No cookies, advertising IDs, persistent visitor IDs, fingerprinting, session replay, or per-visitor records.
- No form fields, names, email draft contents, app activity/location/health data, page titles, query strings, URL fragments, full referring URLs, IP addresses, or user-agent strings are written to D1.
- The browser keeps only the broad source label and a session-counted flag in `sessionStorage`.
- Cloudflare necessarily receives network metadata such as the visitor IP while handling HTTPS, but the Worker does not read or store it.
- Cloudflare Workers Logs and Traces are disabled for this Worker.

## Operations

- The D1 schema is in `schema.sql`.
- `wrangler.toml` contains only non-secret deployment configuration.
- `REPORT_TOKEN` is stored as an encrypted Cloudflare Worker secret and must never be committed.
- The private report is at `https://outabit-analytics.terry77075.workers.dev/report`. HTTP Basic authentication accepts any username; the password is the `REPORT_TOKEN` value.
- Deploy code changes from this folder with `npx wrangler deploy` after authenticating to the approved Cloudflare account.

Cloudflare Workers Free currently includes 100,000 requests per day. D1 Free includes 5 million rows read per day, 100,000 rows written per day, and 5 GB total storage. Free-tier D1 queries stop at the daily limit rather than creating overage charges:

- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/
