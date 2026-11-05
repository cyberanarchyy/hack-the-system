# The NR Bloc

Website for The NR Bloc, Norwich: retro gaming, gigs, weekly nights and venue hire.

Next.js 16 (App Router, TypeScript, Tailwind v4), same setup as `portfolio` and `graindamage`. No database: each event is a `.md` file in `content/events/`, and posters live in `public/images/events/`.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Changing the words

Almost all the text is in `src/site.config.ts`: tagline, intro, weekly nights, the consoles list, venue hire, donation details, email and social links.

### Logo and header image

- **Logo:** put the image in `public/images/` (e.g. `public/images/logo.png`) and set `logo: "/images/logo.png"` in `src/site.config.ts`. Leave it as `""` to use the pixel-text logo.
- **Header image:** put the photo in `public/images/` (e.g. `public/images/hero.jpg`) and set `heroImage: "/images/hero.jpg"`. Leave it as `""` for the animated arcade-grid background.

## Adding events

Go to `/admin` on the site (works from your phone) and log in with the admin password. Fill in the title, date, type (gig, gaming or other), time, price, an optional ticket link, a description, and an optional poster, then press **Publish**.

The poster is resized in your browser before it uploads. The event file and poster are committed to this repo in one commit, which triggers a Vercel deploy, so the event is live a minute or two later. Past events drop off the listings automatically. You can delete an event from the list on `/admin`.

You can also add an event by hand as `content/events/<slug>.md`:

```md
---
title: "Band Name + Support"
date: "2026-12-12"
slug: "band-name-support-2026-12-12"
type: "gig"            # gig, gaming or event
time: "7pm till 11pm"  # optional
price: "£5 OTD"        # optional
ticketUrl: "https://..." # optional
poster: "/images/events/band-name-support-2026-12-12.jpg" # optional
---

Optional description.
```

## Environment variables

See `.env.local.example`:

- `ADMIN_PASSWORD`: password for `/admin`.
- `SESSION_SECRET`: random secret used to sign the admin session cookie (`openssl rand -base64 32`).
- `GITHUB_TOKEN`: fine-grained personal access token for only this repo, with **Contents: Read and write**.
- `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH`: the repo `/admin` commits to (defaults to `cyberanarchyy/nr-bloc` on `main`).

## Deploy on Vercel

1. On [vercel.com](https://vercel.com), choose **Add New → Project** and import this repo. The default settings are correct.
2. Under **Settings → Environment Variables**, add the variables above, then redeploy.

Vercel deploys automatically on every push to `main`, including the commits `/admin` makes.

## Moving thenrbloc.com over (Cloudflare)

The domain's DNS is on Cloudflare. The old site is served by Cloudflare too, so the switch happens there.

1. In the Vercel project, go to **Settings → Domains** and add `thenrbloc.com` and `www.thenrbloc.com`. Let Vercel redirect one to the other.
2. In Cloudflare, if the old site is a **Workers & Pages** project, open it, go to **Custom domains** and remove `thenrbloc.com` and `www.thenrbloc.com`. This frees up the DNS records.
3. In Cloudflare, go to **DNS → Records** for thenrbloc.com and set:
   - `A` record, name `@`, value `76.76.21.21`
   - `CNAME` record, name `www`, value `cname.vercel-dns.com`

   Use whatever values Vercel shows if they differ. Set **Proxy status** to **DNS only** (grey cloud) so Vercel can issue the HTTPS certificate.
4. Don't touch any `MX` or `TXT` records. Those are for email.
5. Wait for Vercel to show the domain as valid (usually minutes). The old Cloudflare project can then be deleted.
