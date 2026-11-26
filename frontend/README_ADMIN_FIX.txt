InHouseGym — Admin Dashboard Cross-Device Fix
Base: your InHouseGym_Brevo_Only-2.zip (that's why this doesn't have the BMI calculator and pincode toast — those are in the master BMI zip; this fix was not built on that base, it was important to say this first)
Date: 2026-10-27

WHAT WAS THE PROBLEM

User signup and rental info was saved only in that browser's localStorage.
The admin dashboard also read the same localStorage.
So the data only showed in the admin on the laptop where the login/rent happened, not on another laptop/mobile.
WHAT IS THE FIX
New APIs for users and rentals have been built in the backend (Render + MongoDB):

POST /api/auth/register, POST /api/auth/login, POST /api/auth/reset-password
GET /api/users, DELETE /api/users/:id, POST /api/users/migrate
GET /api/rentals (?email=...), POST /api/rentals, POST /api/rentals/migrate, PUT /api/rentals/:id, DELETE /api/rentals/:id
Passwords are now saved as bcrypt hashes, not in plain text.
The users and rentals lists are only available with the admin key.
These are the changes in the frontend (src/main.jsx):

Signup: it also registers on the backend, and the local save also remains (fallback).
Login: backend login is tried first, then the local fallback (for old accounts).
Forgot password: the backend user is also searched, and after the reset the backend password also changes.
Checkout: the rental is also saved on the backend.
My Rentals: that customer's rentals are fetched from the backend.
Cancel: the status also becomes Cancelled on the backend.
Admin dashboard: as soon as it opens, it fetches users and rentals from the backend, and migrates the laptop's old local data to the backend (once; it doesn't create duplicates).
Admin delete: it also deletes from the backend.
DEPLOY ORDER — DO IT IN THIS ORDER, OTHERWISE ADMIN WILL LOOK EMPTY

1. BACKEND FIRST:

Push the files from InHouseGym_Backend_AdminFix.zip to the GitHub repo giitsolutions/inhouse-gym-backend- (there's a hyphen at the end, don't forget it).
Never push .env.
The inhouse-gym-backend service on Render will deploy on its own. Wait until the deploy completes.
Check: https://inhouse-gym-backend.onrender.com/api/health should return {"ok":true}.
No new env var is needed. bcryptjs is in package.json, Render will install it itself.
Render's free tier sleeps after 15 min idle; the first request can take 30–50 sec.
2. FRONTEND AFTERWARDS:

Upload this zip's dist folder to Hostinger (as you did before), OR run it on your laptop with npm run dev.
Then open the admin dashboard on your laptop — the first time, the old local data will migrate to the backend.
After that, open admin on another laptop/mobile and hard refresh — the same users and rentals should show.
3. TESTING (important)

On the laptop, sign up a new test user and make a test rental.
Open admin on mobile/another laptop — the test user and the test rental should both show.
Log in on mobile with that test user — login should work, and the rental should show in My Rentals.
Delete the test data from admin afterwards, so the real data stays clean.
THINGS TO KEEP IN MIND

Don't push this zip to a public GitHub repo, because in this base the admin key is in the code itself (that's an old thing about this base; this fix didn't change it, so that your current admin work doesn't break).
The Aadhaar/PAN document file is now also saved on the backend (earlier it was only in localStorage). Don't give the admin key to anyone, otherwise they can see the users/rentals list.
If the backend is down or Render is asleep, the site will keep running on local data (fallback), and admin migration will later take the old data to the backend. This means: if you upload the frontend before the backend deploy completes, admin won't find the old data on the backend — so keep the order given above.
Old users who were created only in the browser of someone else's laptop/mobile won't come to the backend by themselves — they'll have to be migrated by opening admin from that same device, or they'll have to sign up again.
This fix is only for users and rentals. Products and offer already synced from the backend; there is no change in them.