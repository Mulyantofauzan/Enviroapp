# ENVIRO MVP Design

Source: `prd_evo_environment_operations.md` (v2). This spec covers the MVP only.

## 1. Goal and success

Replace the paper log at mining settling ponds with a fast, phone-first form.

- **Users:** field operators (write), admin (write + master data), manager and auditor (read only in MVP).
- **Success:** an operator enters one full day (weather, water in/out, coagulant) for a pond in under 2 minutes on a phone.

## 2. Scope

**In MVP**
- Email + password login, four roles.
- Settling pond master data (admin).
- Weather, surface water (inlet/outlet), coagulant stock entry.
- Auto flow m3/d. Auto coagulant remaining.
- Out-of-limit highlight (never blocks save).
- History list and edit of past days.
- Configurable thresholds (admin).
- Installable PWA, app shell cached.

**Out of MVP (phase 2+)**
- Enviro event calendar, evidence camera with GPS, offline data queue and auto-sync, dashboard charts, Excel/PDF export.

Data model must not block phase 2. Event and evidence tables are added then.

## 3. Stack

Cloudflare Workers + Hono (API), D1 (SQLite) database, React PWA built with Vite, R2 later for evidence files. D1 replaces PostgreSQL from the PRD for simplicity; this is a chosen deviation.

Repo layout:
- `apps/api`: Hono on Workers, D1 binding.
- `apps/web`: React PWA.
- `packages/shared`: types, flow and remaining math, threshold check. Used by both apps.

## 4. Data model (D1)

Types: ids are TEXT (UUID), dates are TEXT `YYYY-MM-DD`, measurements are REAL.

- `users(id, name, email unique, password_hash, role)`; role in Admin, Manager, Operator, Auditor.
- `settling_ponds(id, name, is_active)`.
- `weather(id, date unique, rainfall_mm, rain_hours, logged_by)`: one row per day.
- `surface_water(id, date, sp_id, ph_inlet, ph_outlet, tss_inlet, tss_outlet, debit_inlet_m3s, debit_outlet_m3s, logged_by)`: unique (date, sp_id).
- `coagulant(id, date, sp_id, type, stock_in, stock_out, stock_remaining, logged_by)`: unique (date, sp_id, type); type in Tawas Serbuk, Tawas Batu, Kapur.
- `thresholds(key primary key, min, max)`: keys such as `ph_inlet`, `ph_outlet`, `tss_inlet`, `tss_outlet`. Null min or max means no bound on that side.

Saving a day for a pond replaces the existing row for the same unique key. No audit trail (per PRD).

## 5. Rules

- **Flow:** only m3/s is stored. m3/d = m3/s * 86400, computed when shown or exported. Never saved.
- **Coagulant remaining:** default = previous day's remaining for that pond and type + stock_in - stock_out. If no previous row, default is stock_in - stock_out. Operator may type an override; the override is saved as `stock_remaining`. Negative result shows a warning but still saves.
- **Edit of past day:** remaining of later days is not rewritten automatically. The history screen flags a later day whose stored remaining no longer matches its computed default.
- **Out of limit:** `shared` function compares a value to its threshold. UI paints the field pink. Save is never blocked.
- **Permissions:** Operator and Admin can write entries. Admin alone manages users, ponds, thresholds. Manager and Auditor read only.

## 6. API

All routes need a session, except login. Session is an HttpOnly cookie. Passwords hashed with PBKDF2 (Web Crypto) with per-user salt.

- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET /ponds`, admin `POST/PATCH /ponds`
- `GET /day?date=&sp=` returns weather, water, coagulant for that day and pond, plus yesterday's remaining per type
- `PUT /weather/:date`, `PUT /water/:date/:sp`, `PUT /coagulant/:date/:sp/:type`
- `GET /history?from=&to=&sp=`
- `GET /thresholds`, admin `PUT /thresholds/:key`
- admin `GET/POST/PATCH /users`

Errors return `{ error: "plain message" }` with a fitting status. Input is validated; numbers must be finite and non-negative where physical.

## 7. Screens (phone first)

1. **Login.**
2. **Today:** date at top, pond chips. Sections: Weather, Water in/out, Coagulant. Number keypad on number fields. Fixed Save bar at the bottom (thumb zone).
3. **History:** list by date and pond, tap to edit.
4. **Admin:** users, ponds, thresholds. Admin only.

Bottom tab bar: Today, History, Admin (admin only).

## 8. Visual direction

- **Color:** Silt `#E4E8E1` ground, Peat `#1E2B25` ink, Moss `#3F6B45` main action, Pond `#2E6F73` water values, Alert pink `#F4C7CC` out-of-limit, Overdue red `#B3261E` reserved for phase 2.
- **Type:** Bricolage Grotesque for headings, Instrument Sans for body, tabular numerals in all number fields.
- **Shape:** large radius on inputs and Save, small radius on chips. No identical-card grid.
- **Memorable element:** the pond header is a flow strip, inlet value left, outlet right, a line between; it shifts color when outlet is out of limit. Everything else stays quiet.
- **Motion:** one pink pulse when a value goes out of limit. Respect reduced motion. No scroll fade-ins.
- **Copy:** sentence case. Button "Save day", toast "Day saved". Errors say what to fix.
- **Quality floor:** works at 360px width, visible focus, AA contrast.

## 9. Testing

- Vitest unit tests in `packages/shared`: flow math, remaining default and override, threshold check.
- API route tests with Miniflare/D1: auth, role gates, upsert replaces row, validation errors.
- Manual check on a real phone width for the Today flow and the 2-minute goal.

## 10. Assumptions to confirm

- Weather is one row per day for the whole site, not per pond.
- Initial thresholds are set by admin after first login; no hard-coded regulatory values.
- Single site, single timezone; dates are local calendar dates entered by the user.
