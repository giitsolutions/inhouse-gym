// InHouseGym backend — keeps products, offers, users and rentals in sync across all devices.
// Deploy: Render (Web Service). Database: MongoDB Atlas (free tier).
//
// FIX (2026-10-27): users and rentals used to be saved only in the browser's localStorage,
// so the admin saw nothing on another laptop/mobile. Now signup, login,
// checkout and the admin dashboard all talk to this backend, so the data shows on every device.
// A password is never saved directly (plaintext) — it is saved as a bcrypt hash.
// The users and rentals lists are only available with the admin key, unlike products/offer which are public.

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors()); // let the frontend run from anywhere it is hosted
// Rentals can also carry an Aadhaar/PAN document as a data-URL (max 2 MB per file),
// so the limit is raised from 2 MB to 20 MB. One rental document must stay within MongoDB's 16 MB limit,
// so send checkout in smaller batches when there are many items at once.
app.use(express.json({ limit: "20mb" }));

const PORT = process.env.PORT || 5000;
const ADMIN_KEY = process.env.ADMIN_KEY || "change-this-admin-key";

// ---------- Database ----------
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((e) => console.error("MongoDB connection error:", e.message));

// A single collection, key-value style: "products" and "offer" are two documents.
// The whole catalog is saved at once (the frontend also sends the full array),
// so no separate per-product routes are needed — simple and robust.
const kvSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  data: mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now },
});
const KV = mongoose.model("KV", kvSchema);

// ---------- Users ----------
// Email is always saved lowercase, so "ABC@x.com" and "abc@x.com" do not become separate users.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // KYC info coming from checkout (masked numbers + file names; file data may also be present)
    customerAadhaar: { type: String, default: "" },
    customerPan: { type: String, default: "" },
    customerAadhaarFile: { type: String, default: "" },
    customerAadhaarFileName: { type: String, default: "" },
    customerPanFile: { type: String, default: "" },
    customerPanFileName: { type: String, default: "" },
  },
  { timestamps: true }
);
const User = mongoose.model("User", userSchema);

// ---------- Rentals / Orders ----------
// strict:false is set so the frontend's full rental object (product fields,
// order fields, customer fields) is saved without losing anything. The original local id
// also stays in the "id" field, so the old cancel/delete logic keeps working.
const rentalSchema = new mongoose.Schema(
  {
    id: mongoose.Schema.Types.Mixed,
    order: { type: String, default: "" },
    status: { type: String, default: "Active" },
    customerName: { type: String, default: "" },
    customerPhone: { type: String, default: "" },
    customerAddress: { type: String, default: "" },
    customerCity: { type: String, default: "" },
    customerPin: { type: String, default: "" },
    customerAadhaar: { type: String, default: "" },
    customerPan: { type: String, default: "" },
    customerAadhaarFile: { type: String, default: "" },
    customerAadhaarFileName: { type: String, default: "" },
    customerPanFile: { type: String, default: "" },
    customerPanFileName: { type: String, default: "" },
    customerEmail: { type: String, default: "", lowercase: true, trim: true },
  },
  { strict: false, timestamps: true }
);
const Rental = mongoose.model("Rental", rentalSchema);

// ---------- Order number counter ----------
// Give new orders a 5-digit sequential number: 10001, 10002, ...
// The counter is atomic ($inc), so even if two customers order at the same time,
// the number is never duplicated. Old orders were 6-digit random numbers, so
// starting at 10001 never collides with them.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 10000 },
});
const Counter = mongoose.model("Counter", counterSchema);
async function nextOrderNo() {
  await Counter.findOneAndUpdate(
    { _id: "orderNo" },
    { $setOnInsert: { seq: 10000 } },
    { upsert: true, new: true }
  );
  const doc = await Counter.findOneAndUpdate(
    { _id: "orderNo" },
    { $inc: { seq: 1 } },
    { new: true }
  );
  return String(doc.seq);
}
// ---------- Cart (per-user, cross-device) ----------
const cartSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    items: { type: Array, default: [] },
  },
  { timestamps: true }
);
const Cart = mongoose.model("Cart", cartSchema);

const reviewSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  product: { type: String, default: "" },
  rating: { type: Number, default: 5 },
  text: { type: String, default: "" },
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now },
});
const Review = mongoose.model("Review", reviewSchema);


// ---------- Helpers ----------
function publicUser(doc) {
  if (!doc) return null;
  const u = doc.toObject ? doc.toObject() : doc;
  const { passwordHash, __v, ...rest } = u;
  return rest;
}

function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$/.test(value);
}

async function hashPassword(password) {
  return bcrypt.hash(String(password), 10);
}

// Only someone with the correct ADMIN_KEY can read/write here.
// GET on products/offer is public (public data), but GET on users/rentals is
// personal data, so it needs the admin key.
function needAdmin(req, res, next) {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  next();
}

function validEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim());
}

// Find a rental by _id, by the old local "id", or by order number.
async function findRentalByParam(param) {
  if (mongoose.Types.ObjectId.isValid(param)) {
    const byId = await Rental.findById(param);
    if (byId) return byId;
  }
  const byLocalId = await Rental.findOne({ id: param });
  if (byLocalId) return byLocalId;
  // The id can also be a number (Date.now())
  if (!Number.isNaN(Number(param))) {
    const byNumId = await Rental.findOne({ id: Number(param) });
    if (byNumId) return byNumId;
  }
  return null;
}

// ---------- Routes ----------
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/products", async (req, res) => {
  try {
    const doc = await KV.findOne({ key: "products" });
    res.json(doc ? doc.data : []);
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

app.put("/api/products", needAdmin, async (req, res) => {
  try {
    if (!Array.isArray(req.body)) {
      return res.status(400).json({ error: "products must be an array" });
    }
    await KV.findOneAndUpdate(
      { key: "products" },
      { key: "products", data: req.body, updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ ok: true, count: req.body.length });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

app.get("/api/offer", async (req, res) => {
  try {
    const doc = await KV.findOne({ key: "offer" });
    res.json(doc ? doc.data : null);
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

app.put("/api/offer", needAdmin, async (req, res) => {
  try {
    await KV.findOneAndUpdate(
      { key: "offer" },
      { key: "offer", data: req.body || {}, updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// ---------- Return policy notice (home page card, admin-editable) ----------
app.get("/api/return-policy", async (req, res) => {
  try {
    const doc = await KV.findOne({ key: "return-policy" });
    res.json(doc ? doc.data : null);
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

app.put("/api/return-policy", needAdmin, async (req, res) => {
  try {
    await KV.findOneAndUpdate(
      { key: "return-policy" },
      { key: "return-policy", data: req.body || {}, updatedAt: new Date() },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// ---------- Auth / Users ----------
// Signup: create a new user, save the password hashed.
app.post("/api/auth/register", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";
    if (!name || !validEmail(email) || String(password).length < 6) {
      return res.status(400).json({ error: "name, valid email and 6+ character password required" });
    }
    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: "account already exists" });
    const user = await User.create({
      name,
      email,
      passwordHash: await hashPassword(password),
    });
    res.status(201).json(publicUser(user));
  } catch (e) {
    if (e && e.code === 11000) return res.status(409).json({ error: "account already exists" });
    res.status(500).json({ error: "db error" });
  }
});

// Login: check the password against the hash, never send the password back.
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const password = req.body.password || "";
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "invalid email or password" });
    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) return res.status(401).json({ error: "invalid email or password" });
    res.json(publicUser(user));
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// Forgot password: the frontend only calls this after verifying the OTP.
// This route does not check the OTP itself, so only call it from that flow.
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const newPassword = req.body.newPassword || "";
    if (!validEmail(email) || String(newPassword).length < 6) {
      return res.status(400).json({ error: "valid email and 6+ character password required" });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "account not found" });
    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// Admin: all registered users (never send passwordHash).
app.get("/api/users", needAdmin, async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: 1 });
    res.json(users.map(publicUser));
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// Admin: delete a user — by _id, email, or the old local id.
app.delete("/api/users/:id", needAdmin, async (req, res) => {
  try {
    const param = decodeURIComponent(req.params.id);
    let deleted = null;
    if (mongoose.Types.ObjectId.isValid(param)) {
      deleted = await User.findByIdAndDelete(param);
    }
    if (!deleted && validEmail(param)) {
      deleted = await User.findOneAndDelete({ email: param.toLowerCase() });
    }
    if (!deleted) return res.status(404).json({ error: "user not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// Admin one-time migration: bring the old users from the laptop's localStorage into the backend.
// An existing user's password is never overwritten, only the KYC fields are updated.
// A new user's password is saved hashed.
app.post("/api/users/migrate", needAdmin, async (req, res) => {
  try {
    const list = Array.isArray(req.body) ? req.body : [];
    let created = 0;
    let updated = 0;
    for (const item of list) {
      if (!item || !validEmail(item.email)) continue;
      const email = item.email.trim().toLowerCase();
      const existing = await User.findOne({ email });
      const kyc = {
        customerAadhaar: item.customerAadhaar || "",
        customerPan: item.customerPan || "",
        customerAadhaarFile: item.customerAadhaarFile || "",
        customerAadhaarFileName: item.customerAadhaarFileName || "",
        customerPanFile: item.customerPanFile || "",
        customerPanFileName: item.customerPanFileName || "",
      };
      const hasKyc = Object.values(kyc).some(Boolean);
      if (existing) {
        if (hasKyc) {
          await User.updateOne({ email }, { $set: kyc });
          updated++;
        }
        continue;
      }
      if (!item.password && !item.passwordHash) continue;
      const passwordHash = isBcryptHash(item.passwordHash)
        ? item.passwordHash
        : isBcryptHash(item.password)
          ? item.password
          : await hashPassword(item.password);
      await User.create({ name: item.name || "", email, passwordHash, ...kyc });
      created++;
    }
    res.json({ ok: true, created, updated });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// ---------- Rentals / Orders ----------
// Admin: all rentals. With ?email=... only that customer's rentals.
// The customer's "My Rentals" page also calls this route with an email.
app.get("/api/rentals", needAdmin, async (req, res) => {
  try {
    const email = (req.query.email || "").trim().toLowerCase();
    const query = email ? { customerEmail: email } : {};
    const rentals = await Rental.find(query).sort({ createdAt: -1 });
    res.json(rentals);
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// Checkout: save one rental or an array of rentals.
app.post("/api/rentals", async (req, res) => {
  try {
    const list = Array.isArray(req.body) ? req.body : [req.body];
    if (!list.length || list.some((r) => !r || typeof r !== "object")) {
      return res.status(400).json({ error: "rental object required" });
    }
    // Give every checkout a single sequential 5-digit order number (10001, 10002, ...).
    // Even if one checkout has 2 equipments, both get that same one number.
    let batchOrderNo = null;
    try { batchOrderNo = await nextOrderNo(); } catch (e) { console.error("order counter error:", e.message); }
    const cleaned = list.map((r) => {
      const { password, passwordHash, _id, __v, ...rest } = r;
      if (rest.customerEmail) rest.customerEmail = String(rest.customerEmail).trim().toLowerCase();
      if (batchOrderNo) rest.order = batchOrderNo;
      else if (!/^\d{5}$/.test(String(rest.order || ""))) rest.order = String(10000 + Math.floor(Math.random() * 90000));
      return rest;
    });
    const created = await Rental.insertMany(cleaned);
    res.status(201).json(created);
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// Admin one-time migration: bring the laptop's old rentals into the backend.
// A rental already in the backend (same local id, or same order + product) is not created again.
app.post("/api/rentals/migrate", needAdmin, async (req, res) => {
  try {
    const list = Array.isArray(req.body) ? req.body : [];
    let created = 0;
    let skipped = 0;
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const { _id, __v, password, passwordHash, ...rest } = item;
      if (rest.customerEmail) rest.customerEmail = String(rest.customerEmail).trim().toLowerCase();
      let exists = null;
      if (rest.id !== undefined && rest.id !== null) {
        exists = await Rental.findOne({ id: rest.id });
      }
      if (!exists && rest.order && rest.name) {
        exists = await Rental.findOne({ order: rest.order, name: rest.name });
      }
      if (exists) {
        skipped++;
        continue;
      }
      await Rental.create(rest);
      created++;
    }
    res.json({ ok: true, created, skipped });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// Cancel / status update: only the status fields are updated, not the customer data.
// So a customer can cancel their rental without the admin key.
app.put("/api/rentals/:id", async (req, res) => {
  try {
    const param = decodeURIComponent(req.params.id);
    const rental = await findRentalByParam(param);
    if (!rental) return res.status(404).json({ error: "rental not found" });
    const allowed = {};
    if (req.body.status) allowed.status = req.body.status;
    if (req.body.cancelledAt) allowed.cancelledAt = req.body.cancelledAt;
    if (req.body.cancelledBy) allowed.cancelledBy = req.body.cancelledBy;
    Object.assign(rental, allowed);
    await rental.save();
    res.json(rental);
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// Admin: delete a rental.
app.delete("/api/rentals/:id", needAdmin, async (req, res) => {
  try {
    const param = decodeURIComponent(req.params.id);
    const rental = await findRentalByParam(param);
    if (!rental) return res.status(404).json({ error: "rental not found" });
    await rental.deleteOne();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});
// Cart: a logged-in user's cart shows on every device.
app.get("/api/cart", async (req, res) => {
  try {
    const email = (req.query.email || "").trim().toLowerCase();
    if (!email) return res.json([]);
    const doc = await Cart.findOne({ email });
    res.json(doc ? doc.items : []);
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

app.post("/api/cart", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!email) return res.status(400).json({ error: "email required" });
    await Cart.findOneAndUpdate({ email }, { items }, { upsert: true, new: true });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});


// Reviews: a customer can leave a review + star rating on the website.
// A new review stays "pending" first — it only shows on the website after the admin approves it.
app.post("/api/reviews", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim().slice(0, 60);
    const text = String(req.body.text || "").trim().slice(0, 600);
    const product = String(req.body.product || "").trim().slice(0, 80);
    const rating = Math.max(1, Math.min(5, Number(req.body.rating) || 5));
    if (!name || !text) return res.status(400).json({ error: "name and review required" });
    const doc = await Review.create({ name, product, rating, text, status: "pending" });
    res.json({ ok: true, id: doc._id });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// Only approved reviews show on the website.
app.get("/api/reviews", async (req, res) => {
  try {
    const docs = await Review.find({ status: "approved" }).sort({ createdAt: -1 }).limit(24);
    res.json(docs);
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// Admin: all reviews (pending + approved).
app.get("/api/reviews/all", needAdmin, async (req, res) => {
  try {
    const docs = await Review.find({}).sort({ createdAt: -1 }).limit(100);
    res.json(docs);
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// Admin: approve a review / move it back to pending.
app.post("/api/reviews/:id/status", needAdmin, async (req, res) => {
  try {
    const status = req.body.status === "approved" ? "approved" : "pending";
    const doc = await Review.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!doc) return res.status(404).json({ error: "review not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

// Admin: delete a review.
app.delete("/api/reviews/:id", needAdmin, async (req, res) => {
  try {
    const doc = await Review.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ error: "review not found" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: "db error" });
  }
});

/* ---------- COUPONS ---------- */
const Coupon = mongoose.model("Coupon", new mongoose.Schema({
  code: { type: String, default: "" },
  type: { type: String, default: "percent" },
  value: { type: Number, default: 0 },
  expiry: { type: String, default: "" },
  minOrder: { type: Number, default: 0 },
  category: { type: String, default: "All Equipment" },
  active: { type: Boolean, default: true },
  usedCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
}));

// Public: active coupons for the home page cards and checkout
app.get("/api/coupons", async (req, res) => {
  try {
    const all = await Coupon.find({ active: true }).sort({ createdAt: -1 }).lean();
    const today = new Date().toISOString().slice(0, 10);
    res.json(all.filter((c) => !c.expiry || c.expiry >= today));
  } catch (e) { res.status(500).json({ error: "server error" }); }
});

// Public: check a coupon code against a rent total
app.post("/api/coupons/validate", async (req, res) => {
  try {
    const code = String((req.body || {}).code || "").trim().toUpperCase();
    const total = Number((req.body || {}).total) || 0;
    const items = Array.isArray((req.body || {}).items) ? (req.body || {}).items : [];
    const c = await Coupon.findOne({ code }).lean();
    if (!c || !c.active) return res.json({ valid: false, message: "This coupon code is invalid or has expired." });
    const today = new Date().toISOString().slice(0, 10);
    if (c.expiry && c.expiry < today) return res.json({ valid: false, message: "This coupon code is invalid or has expired." });
    const category = c.category || "All Equipment";
    const eligibleTotal = items.length ? items.filter(i => category === "All Equipment" || (i.category || "") === category).reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0) : total;
    if (eligibleTotal <= 0) return res.json({ valid: false, message: "This coupon is only for " + category + " equipment." });
    if (c.minOrder && eligibleTotal < c.minOrder) return res.json({ valid: false, message: "This coupon needs a minimum order of Rs." + c.minOrder + (category === "All Equipment" ? "." : " on " + category + " equipment.") });
    const discount = c.type === "flat" ? Math.min(Number(c.value) || 0, eligibleTotal) : Math.round(eligibleTotal * (Number(c.value) || 0) / 100);
    res.json({ valid: true, code: c.code, type: c.type, value: c.value, discount, category, eligibleTotal });
  } catch (e) { res.status(500).json({ error: "server error" }); }
});

// Public: count one use after a successful order
app.post("/api/coupons/redeem", async (req, res) => {
  try {
    const code = String((req.body || {}).code || "").trim().toUpperCase();
    if (code) await Coupon.updateOne({ code }, { $inc: { usedCount: 1 } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "server error" }); }
});

// Admin: list all coupons
app.get("/api/coupons/all", needAdmin, async (req, res) => {
  try { res.json(await Coupon.find({}).sort({ createdAt: -1 }).lean()); }
  catch (e) { res.status(500).json({ error: "server error" }); }
});

// Admin: create or update a coupon
app.post("/api/coupons", needAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const code = String(b.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ error: "code required" });
    const data = { code, type: b.type === "flat" ? "flat" : "percent", value: Number(b.value) || 0, expiry: b.expiry || "", minOrder: Number(b.minOrder) || 0, active: b.active !== false, category: String(b.category || "All Equipment") };
    if (b._id && !b.category) delete data.category;
    if (b._id) { await Coupon.updateOne({ _id: b._id }, { $set: data }); return res.json({ ok: true, updated: true }); }
    const exists = await Coupon.findOne({ code });
    if (exists) return res.status(400).json({ error: "code exists" });
    const c = await Coupon.create(data);
    res.json({ ok: true, id: c._id });
  } catch (e) { res.status(500).json({ error: "server error" }); }
});

// Admin: delete a coupon
app.delete("/api/coupons/:id", needAdmin, async (req, res) => {
  try { await Coupon.deleteOne({ _id: req.params.id }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: "server error" }); }
});

app.listen(PORT, () => console.log("InHouseGym backend running on port " + PORT));
