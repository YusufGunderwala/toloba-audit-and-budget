# Toloba Lawzam Treasury

React and Vite frontend backed by Supabase Auth and Postgres.

## Local development

1. Run `npm ci`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.
3. Run `npm run dev`. Run `npm run build` to generate `dist/`.

## Deploying Lawzam Collection and Toloba Income

1. For an empty Supabase project, run `supabase_schema.sql` to create the base tables. For an existing project, start with the next step.
2. Back up the target database and test the rollout against a staging copy. Apply `supabase/migrations/20261114000100_treasury_income_and_integrity.sql` once. It changes treasury table permissions, backfills Lawzam receipt dates in Asia/Kolkata, and retains historical invoices as read-only passbook entries. If starting from an empty project, create the first Auth user and assign their UUID the `super_admin` role through the Supabase Dashboard.
3. Deploy `supabase/functions/manage-treasury-users` to that same project. It uses the project-provided Supabase URL, anonymous key, and service-role key on the server. Configure the function to let its own `auth.getUser` and role checks validate requests when the project uses a signing key unsupported by the gateway's built-in JWT verification.
4. Deploy the new frontend in the same rollout. The previous frontend uses the retired invoice and account management calls. Check Lawzam creation, voiding, Toloba income, exports, and account management using staging accounts.

Receipts and other income can be recorded through the current date in Anand. The receipt date is distinct from the date the entry was created. On browsers with native file sharing, choose WhatsApp from the share menu. Elsewhere the app downloads the PDF for attachment to a chat.

Audit exports belong in the ignored `private-exports/` folder. The earlier tracked workbook is still present in historical Git commits.

For an existing deployment with the treasury migration already applied, run `supabase/migrations/20261114000300_treasury_integrity_checks.sql` once to add the new write checks. Deploy the updated `manage-treasury-users` function and build the frontend with `npm ci` and `npm run build`.
