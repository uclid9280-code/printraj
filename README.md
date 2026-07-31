# Aadhaar Tracker Portal

Aadhaar slip / request tracking portal (vanilla JS frontend + small Node server).

## Local desktop par chalana

```
node server.js
```

Phir browser me `http://localhost:5173` kholiye (Windows par `START_PORTAL.bat` double-click karein).
Bina `DATABASE_URL` ke data server ke folder me `data.json` file me save hota hai, aur ek hi WiFi ke
mobile bhi Backup tab me dikhne wale network URL se judh sakte hain.

## Online (kisi bhi mobile se, kahin se bhi) — Supabase SQL + GitHub Pages

App `index.html` me diye `window.CLOUD_CONFIG` (Supabase project URL + publishable key)
se seedha Supabase se baat karta hai, isliye kisi server ki zaroorat nahi — sirf static
hosting chahiye:

1. GitHub par repo ki **Settings → Pages → Source: Deploy from a branch → `main` / root** karein.
2. Kuch minute me app `https://<username>.github.io/printraj/` par live ho jayega.
3. Kisi bhi mobile/desktop me wo URL kholiye, email + password se login kariye — sab jagah
   ek hi data (Supabase SQL database) dikhega.

Data table: `public.aadhaar_items` (RLS on, sirf logged-in user ko access).
Naya user Supabase dashboard → Authentication → Users se add kar sakte hain.

## Apna khud ka Node server (optional) — SQL database ke saath

Server `DATABASE_URL` set hone par Postgres (SQL) use karta hai — table `aadhaar_items`
apne aap ban jati hai.

1. **Database**: [supabase.com](https://supabase.com) par free project banayein →
   Project Settings → Database → Connection string (URI) copy karein.
2. **Hosting**: [render.com](https://render.com) par GitHub se login → New → Web Service →
   ye repo chunein. `render.yaml` already maujood hai (build: `npm install`, start: `node server.js`).
3. Render me environment variable `DATABASE_URL` = Supabase ka connection string daalein.
4. Deploy hone ke baad Render ka URL (jaise `https://aadhaar-tracker.onrender.com`) kisi bhi
   mobile/desktop browser me kholiye — sab devices ka data ek hi SQL database se sync hoga.

## API

| Endpoint | Kaam |
|---|---|
| `GET /api/info` | Server URLs aur storage type |
| `GET /api/health` | Health check (Render ke liye) |
| `GET /api/data` | Poora data |
| `POST /api/sync` | Client ka data bhejein, merge hoke poora data wapas milta hai |

Sync `updatedAt` par last-write-wins hai; delete soft-delete (`deleted: true`) hai taki
ek device par hataya record dusre device se wapas na aa jaye.
