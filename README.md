# Manarat Parent–Teacher Meeting booking system

A self-contained, server-based parent booking system for Wednesday **4 November 2026**, **4:00–7:30 PM**, Riyadh time. Teachers each get 42 bookable 5-minute slots. The backend uses SQLite's UNIQUE constraint and an immediate write transaction to stop concurrent double bookings.

## Deploy / run

Requires Python 3.10+ with dependencies available. On a server or hosting service with a persistent disk:

```bash
python -m pip install -r requirements.txt
export PTM_ADMIN_PASSWORD='REPLACE-WITH-A-STRONG-UNIQUE-PASSWORD'
./start.sh
```

On Windows PowerShell:

```powershell
python -m pip install -r requirements.txt
$env:PTM_ADMIN_PASSWORD="REPLACE-WITH-A-STRONG-UNIQUE-PASSWORD"
python -m uvicorn app:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000/` for parent booking, and `http://localhost:8000/admin` to add teachers and export appointments. This is a **server application**, not an HTML file that can be safely used by itself. To give parents a public URL, it must be deployed to an HTTPS hosting service with persistent storage. Never publish an unprotected HTTP address on the public Internet.

## Teacher import

In the admin page, upload a CSV like:

```csv
name,subject,section
Hisham Hamdy,Mathematics,Boys High School
Mohammed Waseem,English,Boys High School
Muhammad Avais,Science,Boys High School
```

The three sample rows above are only examples for importing, not pre-loaded into the live database. You can import all actual teachers in one CSV. For each teacher the system shows slots at 16:00, 16:05 ... 19:25.

## Operational notes

- Use HTTPS and a persistent volume for `ptm.sqlite3`; back up that database regularly.
- Set the environment variable `PTM_DB` to the location of the persistent SQLite database if required.
- Booked slots are removed for that teacher only, across all visitors and devices.
- Simultaneous attempts for the same slot: only one succeeds, the other gets HTTP 409.
- Admins can add/import/disable teachers, view reservations, export CSV, and cancel a booking to reopen a slot.
- No email or SMS notifications are sent; the confirmation is shown on screen and can be looked up by confirmation code using the API.
- The system does not integrate Teams links or authenticate parents; to limit abuse, use a school-managed HTTPS service and consider adding rate limiting/CAPTCHA before public distribution.
- Do not delete the SQLite file once families have begun booking. The admin password hash is kept inside the database; changing the environment password on restart does not change the installed hash.
- The date is fixed in `app.py` for this meeting; change DATE and the page copy for another meeting, and clear/test old data as appropriate.
