# Deploy Manarat PTM on Railway

**Date:** Wednesday 4 November 2026, 4:00–7:30 PM, Asia/Riyadh; five-minute appointments.

## 1. Put the project on GitHub

1. Extract `Manarat_PTM_Railway_Ready.zip`.
2. Create a **private** repository on GitHub at https://github.com/new (e.g., `manarat-ptm-booking`).
3. On the empty repository, select **uploading an existing file** (or Add file > Upload files).
4. Drag **the CONTENTS of the extracted folder** into GitHub (the `static/` directory as well). `app.py`, `requirements.txt` and `Dockerfile` must be at the repository root.
5. Commit the files. Do NOT upload `.env` files, passwords, or any `*.sqlite3` database files.

## 2. Deploy on Railway

1. Go to https://railway.com/ and open **New Project > Deploy from GitHub repo**.
2. Connect GitHub, select the private `manarat-ptm-booking` repository, and create the service.
3. Railway uses the included **Dockerfile** to install dependencies and start the web server automatically.
4. In the service's **Variables** tab, add:

   - `PTM_ADMIN_PASSWORD` = a strong, unique password of 12+ characters (only set for the initial install; changing this variable later does not reset the saved password hash).
   - `PTM_DB` = `/data/ptm.sqlite3`

5. **BEFORE accepting bookings** attach a persistent volume to this service via Railway canvas > Add Volume / right-click > Attach Volume. Set the mount path to `/data` (exactly). Deploy any pending configuration changes.
6. Under service **Settings > Networking**, select **Generate Domain**. Railway provides a public HTTPS URL, such as `https://YOUR-SERVICE.up.railway.app`. The actual URL is issued by Railway.
7. Open your Railway URL. Open `/admin` at that URL, log in with your administrator password, and import teacher CSV with `name,subject,section` columns.
8. Verify a test reservation for one teacher, check it disappears from availability, then cancel it on the admin page to reopen the slot.

## IMPORTANT

- **Attach the volume and set `PTM_DB` before any real bookings**; the default filesystem does not persist across redeploys.
- One server instance with one attached volume. Do not enable multiple replicas for the SQLite database.
- Make regular encrypted backups of `/data/ptm.sqlite3` and restrict administrator password access.
- The parent-facing booking form collects identifiable student and parent data. Make sure the school has authorization to collect it; restrict access and share the link only with the intended community.
- No automatic email, SMS, Microsoft Teams meeting links, or student identity verification are included.
- The meeting date is fixed in `app.py`; do not reuse this installation for another date without updating the code.

## Troubleshooting

- **Application failed to start / missing password**: define `PTM_ADMIN_PASSWORD` in Variables and redeploy.
- **Bookings disappear after restarts**: verify `/data` volume and `PTM_DB=/data/ptm.sqlite3`.
- **Blank teacher selection**: use `/admin` to add/import teachers (none are preloaded).
- **No public link**: Generate Domain in Settings > Networking.
- **GitHub sees only `manarat_ptm/` rather than files at root**: ensure this repackaged ZIP contents are at repository root (or set Railway root directory correctly).

References:
- https://docs.railway.com/guides/fastapi
- https://docs.railway.com/volumes
- https://docs.railway.com/variables
