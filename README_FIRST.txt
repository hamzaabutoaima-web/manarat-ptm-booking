MANARAT PTM — TEACHER MEETING LISTS AND ADMIN BOOKING LOG
29 October 2026

WHAT THIS UPDATE ADDS
---------------------
In the password-protected /admin dashboard you will see a NEW section:
"Teacher meeting lists & attendance log".

- Browse all confirmed appointments grouped by teacher.
- Select one teacher to display only that teacher's meetings.
- Search by student, parent or class.
- Optionally display all 42 slots (including those still available) for one teacher.
- Print a teacher-specific list, or print separate pages for all teachers with bookings.
- The printed register includes time, student, grade/class, parent, and blank attendance and follow-up columns.
- Save the printed list as PDF using your browser's Print > Save as PDF.
- Download a selected teacher's CSV or all teachers' booking CSV for the meeting.
- Refresh bookings to incorporate newly confirmed parent reservations.
- Contact emails/phone numbers are NOT included in staff handouts (the existing private admin booking table retains them).
- Attendance and follow-up boxes are for paper/PDF notes; this update does not store attendance status online.

IMPORTANT: This changes the ADMIN PAGE ONLY. The existing parent booking page and database are unchanged.
The event date remains Wednesday 4 November 2026, 4:00–7:30 p.m. Asia/Riyadh.

HOW TO APPLY TO THE ALREADY DEPLOYED RENDER WEBSITE
----------------------------------------------------
Your existing repository:
https://github.com/hamzaabutoaima-web/manarat-ptm-booking

1. Download the update ZIP, then Extract All.
2. Open your GitHub repository and choose Add file > Upload files.
3. Drag the "static" FOLDER from the extracted update into GitHub's upload area.
   Verify the changed paths display as:
       static/admin.html
       static/admin.js
       static/style.css
   GitHub should show these as CHANGED existing files, not files inside an extra wrapping folder.
   This is a minimal upgrade; do NOT delete or overwrite any other application files.
4. Commit changes.
5. In Render, open service manarat-ptm-booking > Manual Deploy > Deploy latest commit.
6. After it says Live, open https://manarat-ptm-booking.onrender.com/admin
   and sign in with the PTM_ADMIN_PASSWORD you configured on Render.
7. Scroll to "Teacher meeting lists & attendance log", choose teacher, click Print.

IF YOU CHOOSE TO USE THE FULL SOURCE ZIP
----------------------------------------
The full source bundle includes your previous app.py with the 104-teacher startup directory,
plus the original parent booking page and all other files. This is an alternative to the
3-file update, not something to deploy on top of the minimal update separately.

SAFETY CHECKS
-------------
- A successful deployment does NOT prove the database is persistent.
- Attach a paid Render persistent disk to /data and set PTM_DB=/data/ptm.sqlite3.
- Do not delete/recreate an existing disk holding bookings.
- Before distributing teacher schedules, check they contain real data from the live app.
- Handle all printed/downloaded student and parent information as confidential.

Local browser test of this update: 104 teacher options, 3 example appointments,
individual teacher filtering, 42-slot view and print output passed.
Example test records are NOT included in deployment files.
