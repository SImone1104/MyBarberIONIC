const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");

const databasePath = path.join(__dirname, "database.sqlite");

const db = new sqlite3.Database(databasePath, (err) => {
  if (err) console.error(err.message);
  else console.log("Connected to SQLite DB");
});

db.configure("busyTimeout", 5000);

// 1. Tabella Utenti (Esistente)
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT,
    cognome TEXT,
    email TEXT UNIQUE,
    password TEXT,
    telefono TEXT
  )
`);

const userColumns = [
  { name: "nome", definition: "TEXT" },
  { name: "cognome", definition: "TEXT" },
  { name: "telefono", definition: "TEXT" }
];

db.all("PRAGMA table_info(users)", (err, columns) => {
  if (err) {
    console.error("Errore lettura colonne users:", err.message);
    return;
  }

  const existingColumns = columns.map((column) => column.name);

  userColumns.forEach((column) => {
    if (!existingColumns.includes(column.name)) {
      db.run(`ALTER TABLE users ADD COLUMN ${column.name} ${column.definition}`, (err) => {
        if (err) console.error(`Errore aggiunta colonna ${column.name}:`, err.message);
      });
    }
  });
});

// 2. NUOVA Tabella Prenotazioni
db.run(`
  CREATE TABLE IF NOT EXISTS prenotazioni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    data TEXT NOT NULL,
    ora TEXT NOT NULL,
    ora_fine TEXT,
    durata_minuti INTEGER,
    servizio TEXT,
    note TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`, (err) => {
  if (err) {
    console.error("❌ Errore creazione tabella prenotazioni:", err.message);
  } else {
    console.log("✅ Tabella prenotazioni pronta!");
  }
});

const prenotazioneColumns = [
  { name: "ora_fine", definition: "TEXT" },
  { name: "durata_minuti", definition: "INTEGER" }
];

const durataServizioSql = `
  CASE LOWER(TRIM(servizio))
    WHEN 'taglio' THEN 30
    WHEN 'taglio classico' THEN 30
    WHEN 'sfumatura' THEN 30
    WHEN 'barba' THEN 30
    WHEN 'cura barba' THEN 30
    WHEN 'completo' THEN 60
    WHEN 'taglio + barba' THEN 60
    WHEN 'taglio barba' THEN 60
    WHEN 'taglio e barba' THEN 60
    WHEN 'colore' THEN 120
    WHEN 'taglio + colore' THEN 120
    WHEN 'taglio colore' THEN 120
    WHEN 'taglio e colore' THEN 120
    ELSE 30
  END
`;

const inizioPrenotazioneSql = `
  CAST(substr(ora, 1, 2) AS INTEGER) * 60
  + CAST(substr(ora, 4, 2) AS INTEGER)
`;

const finePrenotazioneSql = `
  CASE
    WHEN ora_fine IS NOT NULL AND ora_fine != '' THEN
      CAST(substr(ora_fine, 1, 2) AS INTEGER) * 60
      + CAST(substr(ora_fine, 4, 2) AS INTEGER)
    ELSE
      ${inizioPrenotazioneSql}
      + COALESCE(durata_minuti, ${durataServizioSql})
  END
`;

const durataNuovaPrenotazioneSql = `
  CASE LOWER(TRIM(NEW.servizio))
    WHEN 'taglio' THEN 30
    WHEN 'taglio classico' THEN 30
    WHEN 'sfumatura' THEN 30
    WHEN 'barba' THEN 30
    WHEN 'cura barba' THEN 30
    WHEN 'completo' THEN 60
    WHEN 'taglio + barba' THEN 60
    WHEN 'taglio barba' THEN 60
    WHEN 'taglio e barba' THEN 60
    WHEN 'colore' THEN 120
    WHEN 'taglio + colore' THEN 120
    WHEN 'taglio colore' THEN 120
    WHEN 'taglio e colore' THEN 120
    ELSE 30
  END
`;

const inizioNuovaPrenotazioneSql = `
  CAST(substr(NEW.ora, 1, 2) AS INTEGER) * 60
  + CAST(substr(NEW.ora, 4, 2) AS INTEGER)
`;

const fineNuovaPrenotazioneSql = `
  CASE
    WHEN NEW.ora_fine IS NOT NULL AND NEW.ora_fine != '' THEN
      CAST(substr(NEW.ora_fine, 1, 2) AS INTEGER) * 60
      + CAST(substr(NEW.ora_fine, 4, 2) AS INTEGER)
    ELSE
      ${inizioNuovaPrenotazioneSql}
      + COALESCE(NEW.durata_minuti, ${durataNuovaPrenotazioneSql})
  END
`;

function aggiornaDuratePrenotazioniEsistenti() {
  db.serialize(() => {
    db.run(`
      UPDATE prenotazioni
      SET durata_minuti = ${durataServizioSql}
      WHERE durata_minuti IS NULL OR durata_minuti <= 0
    `, (err) => {
      if (err) {
        console.error("Errore aggiornamento durata prenotazioni:", err.message);
      }
    });

    db.run(`
      UPDATE prenotazioni
      SET ora_fine = printf(
        '%02d:%02d',
        (
          CAST(substr(ora, 1, 2) AS INTEGER) * 60
          + CAST(substr(ora, 4, 2) AS INTEGER)
          + durata_minuti
        ) / 60,
        (
          CAST(substr(ora, 1, 2) AS INTEGER) * 60
          + CAST(substr(ora, 4, 2) AS INTEGER)
          + durata_minuti
        ) % 60
      )
      WHERE ora_fine IS NULL OR ora_fine = ''
    `, (err) => {
      if (err) {
        console.error("Errore aggiornamento ora fine prenotazioni:", err.message);
      }
    });
  });
}

db.all("PRAGMA table_info(prenotazioni)", (err, columns) => {
  if (err) {
    console.error("Errore lettura colonne prenotazioni:", err.message);
    return;
  }

  const existingColumns = columns.map((column) => column.name);

  const colonneMancanti = prenotazioneColumns.filter((column) => !existingColumns.includes(column.name));

  if (colonneMancanti.length === 0) {
    aggiornaDuratePrenotazioniEsistenti();
    return;
  }

  let colonneDaAggiornare = colonneMancanti.length;

  colonneMancanti.forEach((column) => {
    db.run(`ALTER TABLE prenotazioni ADD COLUMN ${column.name} ${column.definition}`, (err) => {
      if (err) {
        console.error(`Errore aggiunta colonna ${column.name}:`, err.message);
      }

      colonneDaAggiornare--;

      if (colonneDaAggiornare === 0) {
        aggiornaDuratePrenotazioniEsistenti();
      }
    });
  });
});

db.serialize(() => {
  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_prenotazioni_data_ora
    ON prenotazioni (data, ora)
  `, (err) => {
    if (err) {
      console.error("Errore creazione indice slot prenotazioni:", err.message);
    }
  });

  db.run(`
    CREATE TRIGGER IF NOT EXISTS trg_prenotazioni_no_overlap_insert
    BEFORE INSERT ON prenotazioni
    WHEN EXISTS (
      SELECT 1
      FROM prenotazioni
      WHERE data = NEW.data
        AND (${inizioPrenotazioneSql}) < (${fineNuovaPrenotazioneSql})
        AND (${finePrenotazioneSql}) > (${inizioNuovaPrenotazioneSql})
    )
    BEGIN
      SELECT RAISE(ABORT, 'Prenotazione sovrapposta');
    END
  `, (err) => {
    if (err) {
      console.error("Errore creazione trigger inserimento prenotazioni:", err.message);
    }
  });

  db.run(`
    CREATE TRIGGER IF NOT EXISTS trg_prenotazioni_no_overlap_update
    BEFORE UPDATE OF data, ora, ora_fine, durata_minuti, servizio ON prenotazioni
    WHEN EXISTS (
      SELECT 1
      FROM prenotazioni
      WHERE id != NEW.id
        AND data = NEW.data
        AND (${inizioPrenotazioneSql}) < (${fineNuovaPrenotazioneSql})
        AND (${finePrenotazioneSql}) > (${inizioNuovaPrenotazioneSql})
    )
    BEGIN
      SELECT RAISE(ABORT, 'Prenotazione sovrapposta');
    END
  `, (err) => {
    if (err) {
      console.error("Errore creazione trigger aggiornamento prenotazioni:", err.message);
    }
  });
});

async function putData() {
  try {
    const saltRounds = 10;
    const hash1 = await bcrypt.hash('password1', saltRounds);
    const hash2 = await bcrypt.hash('password2', saltRounds);

    db.run(
      `INSERT OR IGNORE INTO users (id, nome, cognome, email, password, telefono) VALUES (?, ?, ?, ?, ?, ?)`,
      [1, 'Mario', 'Rossi', 'mario@example.com', hash1.toString(), '3331112222'],
      (err) => { if (err) console.error(err); }
    );

    db.run(
      `INSERT OR IGNORE INTO users (id, nome, cognome, email, password, telefono) VALUES (?, ?, ?, ?, ?, ?)`,
      [2, 'Lucia', 'Bianchi', 'lucia@example.com', hash2.toString(), '3332221111'],
      (err) => { if (err) console.error(err); }
    );

    db.run(
      `UPDATE users SET nome = ?, cognome = ?, telefono = ? WHERE id = ? AND nome IS NULL`,
      ['Mario', 'Rossi', '3331112222', 1],
      (err) => { if (err) console.error(err); }
    );

    db.run(
      `UPDATE users SET nome = ?, cognome = ?, telefono = ? WHERE id = ? AND nome IS NULL`,
      ['Lucia', 'Bianchi', '3332221111', 2],
      (err) => { if (err) console.error(err); }
    );

  } catch (err) {
    console.error(err);
  }
}

putData();

module.exports = db;
