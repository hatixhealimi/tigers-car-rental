const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { body, validationResult } = require("express-validator");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "db", "tigers.db");
if (!fs.existsSync(dbPath)) {
  console.log("Database not found — running seed...");
  require("./db/seed.js");
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/locales", express.static(path.join(__dirname, "locales")));

function localize(row, lang, fields) {
  const L = ["en", "sq", "de"].includes(lang) ? lang : "en";
  const out = { ...row };
  for (const f of fields) {
    out[f] = row[`${f}_${L}`] ?? row[`${f}_en`];
    delete out[`${f}_en`];
    delete out[`${f}_sq`];
    delete out[`${f}_de`];
  }
  return out;
}

app.get("/api/cars", (req, res) => {
  const lang = req.query.lang || "en";
  const category = req.query.category;
  let rows;
  if (category && category !== "all") {
    rows = db
      .prepare("SELECT * FROM cars WHERE available = 1 AND category = ? ORDER BY price_per_day")
      .all(category);
  } else {
    rows = db.prepare("SELECT * FROM cars WHERE available = 1 ORDER BY price_per_day").all();
  }
  res.json(
    rows.map((r) => {
      const car = localize(r, lang, ["description"]);
      car.features = JSON.parse(car.features);
      return car;
    })
  );
});

app.get("/api/cars/:slug", (req, res) => {
  const lang = req.query.lang || "en";
  const row = db.prepare("SELECT * FROM cars WHERE slug = ?").get(req.params.slug);
  if (!row) return res.status(404).json({ error: "Car not found" });
  const car = localize(row, lang, ["description"]);
  car.features = JSON.parse(car.features);
  res.json(car);
});

app.get("/api/team", (req, res) => {
  const lang = req.query.lang || "en";
  const rows = db.prepare("SELECT * FROM team ORDER BY sort_order").all();
  res.json(rows.map((r) => localize(r, lang, ["role", "bio"])));
});

app.get("/api/blog", (req, res) => {
  const lang = req.query.lang || "en";
  const rows = db
    .prepare("SELECT id, slug, title_en, title_sq, title_de, excerpt_en, excerpt_sq, excerpt_de, image_url, author, published_at FROM blog_posts ORDER BY published_at DESC")
    .all();
  res.json(rows.map((r) => localize(r, lang, ["title", "excerpt"])));
});

app.get("/api/blog/:slug", (req, res) => {
  const lang = req.query.lang || "en";
  const row = db.prepare("SELECT * FROM blog_posts WHERE slug = ?").get(req.params.slug);
  if (!row) return res.status(404).json({ error: "Post not found" });
  res.json(localize(row, lang, ["title", "excerpt", "body"]));
});

app.get("/api/locations", (req, res) => {
  const lang = req.query.lang || "en";
  const rows = db.prepare("SELECT * FROM locations").all();
  res.json(rows.map((r) => localize(r, lang, ["name", "hours"])));
});

app.get("/api/services", (req, res) => {
  const lang = req.query.lang || "en";
  const rows = db.prepare("SELECT * FROM services").all();
  res.json(rows.map((r) => localize(r, lang, ["title", "summary", "body"])));
});

app.get("/api/services/:slug", (req, res) => {
  const lang = req.query.lang || "en";
  const row = db.prepare("SELECT * FROM services WHERE slug = ?").get(req.params.slug);
  if (!row) return res.status(404).json({ error: "Service not found" });
  res.json(localize(row, lang, ["title", "summary", "body"]));
});

app.post(
  "/api/contact",
  body("name").trim().isLength({ min: 2 }).withMessage("Name required"),
  body("email").isEmail().withMessage("Valid email required"),
  body("subject").trim().isLength({ min: 2 }).withMessage("Subject required"),
  body("message").trim().isLength({ min: 10 }).withMessage("Message too short"),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { name, email, phone, subject, message } = req.body;
    const info = db
      .prepare(
        "INSERT INTO contact_messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)"
      )
      .run(name, email, phone || null, subject, message);
    res.json({ success: true, id: info.lastInsertRowid });
  }
);

app.post(
  "/api/bookings",
  body("car_id").isInt({ min: 1 }),
  body("customer_name").trim().isLength({ min: 2 }),
  body("customer_email").isEmail(),
  body("customer_phone").trim().isLength({ min: 6 }),
  body("pickup_location").trim().notEmpty(),
  body("dropoff_location").trim().notEmpty(),
  body("pickup_date").notEmpty(),
  body("dropoff_date").notEmpty(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const car = db.prepare("SELECT id FROM cars WHERE id = ? AND available = 1").get(req.body.car_id);
    if (!car) return res.status(400).json({ error: "Car unavailable" });

    const {
      car_id,
      customer_name,
      customer_email,
      customer_phone,
      pickup_location,
      dropoff_location,
      pickup_date,
      dropoff_date,
      notes,
    } = req.body;

    if (new Date(dropoff_date) < new Date(pickup_date)) {
      return res.status(400).json({ error: "Drop-off must be after pick-up" });
    }

    const info = db
      .prepare(
        `INSERT INTO bookings (car_id, customer_name, customer_email, customer_phone, pickup_location, dropoff_location, pickup_date, dropoff_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        car_id,
        customer_name,
        customer_email,
        customer_phone,
        pickup_location,
        dropoff_location,
        pickup_date,
        dropoff_date,
        notes || null
      );

    res.json({ success: true, bookingId: info.lastInsertRowid });
  }
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", brand: "Tigers Car Rental" });
});

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  const file = path.join(__dirname, "public", req.path.endsWith(".html") ? req.path : "index.html");
  if (fs.existsSync(path.join(__dirname, "public", req.path)) && req.path !== "/") {
    return res.sendFile(path.join(__dirname, "public", req.path));
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Tigers Car Rental running on port ${PORT}`);
});
