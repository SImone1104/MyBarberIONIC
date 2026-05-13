const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");

const databasePath = path.join(__dirname, "..", "db", "database.sqlite");
const db = new sqlite3.Database(databasePath);

const admin = {
  nome: "Barbiere",
  cognome: "Admin",
  email: "admin@mybarber.local",
  password: "Admin123!",
  telefono: "3330000000",
  ruolo: "admin"
};

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function ensureUsersSchema() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT,
      cognome TEXT,
      email TEXT UNIQUE,
      password TEXT,
      telefono TEXT,
      ruolo TEXT DEFAULT 'user'
    )
  `);

  const columns = await all("PRAGMA table_info(users)");
  const existingColumns = new Set(columns.map((column) => column.name));
  const requiredColumns = [
    { name: "nome", definition: "TEXT" },
    { name: "cognome", definition: "TEXT" },
    { name: "telefono", definition: "TEXT" },
    { name: "ruolo", definition: "TEXT DEFAULT 'user'" }
  ];

  for (const column of requiredColumns) {
    if (!existingColumns.has(column.name)) {
      await run(`ALTER TABLE users ADD COLUMN ${column.name} ${column.definition}`);
    }
  }

  await run("UPDATE users SET ruolo = 'user' WHERE ruolo IS NULL OR ruolo = ''");
}

async function seedAdmin() {
  await ensureUsersSchema();

  const passwordHash = await bcrypt.hash(admin.password, 10);

  await run(
    `
      INSERT INTO users (nome, cognome, email, password, telefono, ruolo)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(email) DO UPDATE SET
        nome = excluded.nome,
        cognome = excluded.cognome,
        password = excluded.password,
        telefono = excluded.telefono,
        ruolo = excluded.ruolo
    `,
    [admin.nome, admin.cognome, admin.email, passwordHash, admin.telefono, admin.ruolo]
  );

  console.log(`Admin pronto: ${admin.email} / ${admin.password}`);
}

seedAdmin()
  .catch((err) => {
    console.error("Errore seed admin:", err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    db.close();
  });
