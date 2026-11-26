# InHouseGym — Gym Equipment Rental Website

Rent treadmills, cross trainers and exercise bikes for home use in Delhi NCR. Customers can browse equipment, apply coupons, add to cart and place a rental order. Admin manages products, orders, users, reviews, coupons and festive offers from a separate Design 4 admin dashboard.

Live site: https://inhousegym.in/

## Tech Stack

- Frontend: React 18 + Vite - frontend/ (src/main.jsx, src/styles.css)
- Backend: Node.js + Express + MongoDB (Mongoose) - backend/ (server.js)
- Database: MongoDB Atlas (inhouse-gym)
- Email: EmailJS (order mail and password-reset OTP)

## Run

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm start
```

Backend needs a .env file (see backend/.env.example):

```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/inhouse-gym
ADMIN_KEY=<your-admin-key>
PORT=5000
```

Live backend: https://inhouse-gym-backend.onrender.com - check /api/health returns {"ok":true}.

Note: Never push .env to GitHub. On the Render free tier, the server sleeps after 15 minutes idle, so the first request can take 30-50 seconds.

## User Dashboard

This is the customer side - what a normal user sees after opening the site.

### Home

- Hero slideshow with featured equipment
- Festive offer ribbon (shown when an offer is live)
- Offers & Coupons section - copy a code and use it at checkout
- Popular Equipment
- Choose, Book, Train, Return (How It Works steps)
- Our Growth stats and customer reviews
- Why InHouseGym - Flexible Rentals (3 / 6 months), Clean & Maintained, Fast Delivery, Secure Payments

### Shop / Browse Equipment

- All Equipment, Treadmills, Cross Trainers, Exercise Bikes - 3 categories
- Treadmill weight-capacity filter (only for Treadmills): Standard Load - Up to 110 kg, High Load - Up to 135 kg, Max Load - Above 135 kg
- Each card shows photo, category, monthly rent, rating and offer price

### Product Detail Page

- Main image + gallery (extra photos added from admin, swipe on mobile, fullscreen viewer)
- Description, Specifications and Reviews - 3 tabs
- 3-month and 6-month rental prices, offer discount and GST (18%) shown separately
- Delivery Only in NCR Regions, Delivery Within 48 Hours, Stabilizer Free with every rental
- Add to Cart and Rent Now

### Reviews

- Customer reviews on every product - rating, review bars and Verified Customer tag
- Write a Review - enter your name, rating and review; a review appears on the site only after admin approval

### Cart

- Slide-out cart drawer - change rental duration (3 / 6 months) and quantity
- Apply a coupon code - the discount is applied before GST
- The total shows Rent, Coupon Discount, GST (18%) and Final Total separately

### Checkout

- Guest checkout - login/signup is not required to place an order
- Only Full Name, Phone Number (10 digit) and House Address are asked
- Confirm Order (Cash on Delivery) - the order is confirmed on the same screen
- The order number is shown in My Rentals

### My Dashboard (My Rentals)

- Opens from My Dashboard in the header
- See your active and past rental orders, the order date is shown just below the order number
- Cancel a rental from here

### Login / Signup

- Signup and Login - with email and password
- Forgot Password - OTP on email, then set a new password
- After login, cart and rentals sync through the backend, so they are visible on other devices too

### Other Pages

- How It Works, About Us, Contact Us
- WhatsApp chat button (on the customer side)

## Admin Dashboard

This is a separate minimal Design 4 admin interface - only for the admin, normal users do not see it. Admin login is at /admin-login.

### Admin login

Email: `inhousegym.admin@gmail.com`
Password: `InHouseGym#2026$Admin`

Note: Do not write the real admin password in a README that goes to a public repo - keep it only in your private copy.

### Admin sections - 8 tabs

- Dashboard - Total Equipment, Treadmills / Cross Trainers / Exercise Bikes count and category-wise share
- Products - list of all equipments; filter by Category and Enabled / Disabled status; enable/disable, move up/down, edit or delete
- Add Equipment - add name, category, price, photo (URL or from device), max weight, rating, description and specifications; option to show in Popular Equipment. Edit Equipment is not a separate tab - clicking Edit on an equipment opens this same form (Save Changes). Delete is done from the Products list.
- Orders / Rentals - all customer orders: order number, order date, customer name / phone / address, items and total; cancel, delete or bulk delete orders
- Users - list of registered users; delete a user
- Reviews - customer reviews written on the website appear here; Approve or Delete - only approved reviews appear on the site
- Coupons - create a coupon code: percent or flat discount, category (All Equipment or one category), expiry date, minimum order and Active/Off; the Show coupons on Home page ON/OFF toggle is also here
- Festive Offers - Offer Title, Category, Discount (%), Enable Offer and per-equipment discount (%); when the offer is live, the ribbon and discounted prices appear on the site
- Logout

## Data Sync - not localStorage, through the backend

In this zip, products, offers, users and rentals sync through the backend (MongoDB Atlas), so the admin sees the same data on another laptop or mobile. Browser localStorage is only a cache / fallback. When the admin dashboard is opened for the first time, old local data from the laptop is also migrated to the backend.

Main backend endpoints (full list in backend/README.md):

- GET /api/health
- GET /api/products, PUT /api/products
- GET /api/offer, PUT /api/offer
- POST /api/auth/register, POST /api/auth/login, POST /api/auth/reset-password
- GET /api/users, GET /api/rentals, POST /api/rentals, PUT /api/rentals/:id, DELETE /api/rentals/:id
- GET /api/coupons, POST /api/coupons
- GET /api/reviews, POST /api/reviews

Admin calls need this header: x-admin-key: <your ADMIN_KEY>.

## Project Structure

- InHouseGym_AdminFix_Complete-13.zip
- frontend/src/main.jsx - full website + admin (single file)
- frontend/src/styles.css
- frontend/index.html - SEO + title: InHouseGym - Gym Equipment on Rent in Delhi NCR
- frontend/package.json - react, react-dom, vite, @emailjs/browser
- frontend/README.md - this file (earlier it had only the admin part)
- backend/server.js - Express API: products, offer, auth, users, rentals, coupons, reviews
- backend/package.json - express, mongoose, bcryptjs, cors, dotenv
- backend/.env.example
- backend/README.md - backend setup + endpoints
