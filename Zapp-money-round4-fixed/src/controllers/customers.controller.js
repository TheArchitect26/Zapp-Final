import { db } from "../db/index.js";

const PAGE_SIZE = 50;

export async function createCustomer(req, res, next) {
  try {
    const { name, email, metadata = {} } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: "name and email are required" });
    }

    const existing = await db.query(
      `SELECT id FROM customers WHERE email = $1 LIMIT 1`,
      [email]
    );
    if (existing.rows.length) {
      return res.status(409).json({ success: false, error: "CUSTOMER_ALREADY_EXISTS" });
    }

    const created = await db.query(
      `INSERT INTO customers (name, email, metadata, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [name, email, metadata]
    );

    return res.status(201).json({ success: true, customer: created.rows[0] });
  } catch (err) {
    return next(err);
  }
}

export async function listCustomers(req, res, next) {
  try {
    const page   = Math.max(0, Number(req.query.page  ?? 0));
    const limit  = Math.min(PAGE_SIZE, Math.max(1, Number(req.query.limit ?? PAGE_SIZE)));
    const offset = page * limit;

    const [rows, countResult] = await Promise.all([
      db.query(
        `SELECT * FROM customers ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      db.query(`SELECT COUNT(*)::int AS total FROM customers`),
    ]);

    return res.json({
      success: true,
      total: countResult.rows[0]?.total ?? 0,
      page,
      limit,
      data: rows.rows,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getCustomer(req, res, next) {
  try {
    const result = await db.query(
      `SELECT * FROM customers WHERE id = $1 LIMIT 1`,
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: "CUSTOMER_NOT_FOUND" });
    }
    return res.json({ success: true, customer: result.rows[0] });
  } catch (err) {
    return next(err);
  }
}

export async function deleteCustomer(req, res, next) {
  try {
    const removed = await db.query(
      `DELETE FROM customers WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (!removed.rows.length) {
      return res.status(404).json({ success: false, error: "CUSTOMER_NOT_FOUND" });
    }
    return res.json({ success: true, deleted: removed.rows[0] });
  } catch (err) {
    return next(err);
  }
}
