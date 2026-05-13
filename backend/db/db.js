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
    telefono TEXT,
    ruolo TEXT DEFAULT 'user'
  )
`);

const userColumns = [
  { name: "nome", definition: "TEXT" },
  { name: "cognome", definition: "TEXT" },
  { name: "telefono", definition: "TEXT" },
  { name: "ruolo", definition: "TEXT DEFAULT 'user'" }
];

db.all("PRAGMA table_info(users)", (err, columns) => {
  if (err) {
    console.error("Errore lettura colonne users:", err.message);
    return;
  }

  const existingColumns = columns.map((column) => column.name);

  const missingColumns = userColumns.filter((column) => !existingColumns.includes(column.name));

  if (missingColumns.length === 0) {
    db.run(`UPDATE users SET ruolo = 'user' WHERE ruolo IS NULL OR ruolo = ''`, (err) => {
      if (err) console.error("Errore aggiornamento ruoli users:", err.message);
      putData();
    });
    return;
  }

  let columnsToAdd = missingColumns.length;

  missingColumns.forEach((column) => {
    if (!existingColumns.includes(column.name)) {
      db.run(`ALTER TABLE users ADD COLUMN ${column.name} ${column.definition}`, (err) => {
        if (err) console.error(`Errore aggiunta colonna ${column.name}:`, err.message);

        columnsToAdd--;

        if (columnsToAdd === 0) {
          db.run(`UPDATE users SET ruolo = 'user' WHERE ruolo IS NULL OR ruolo = ''`, (err) => {
            if (err) console.error("Errore aggiornamento ruoli users:", err.message);
            putData();
          });
        }
      });
    }
  });
});

const serviziDefault = [
  {
    valore: "taglio",
    nome: "Taglio",
    descrizione: "Linee pulite, rifinitura precisa e styling finale.",
    prezzo: 13,
    durataMinuti: 30,
    badge: "Classico",
    immagine: "assets/services/taglio-classico.png",
    dettagli: "Consulenza stile|Rifinitura collo|Styling incluso"
  },
  {
    valore: "sfumatura",
    nome: "Taglio e shampoo",
    descrizione: "Fade basso, medio o alto con dettagli netti e naturali.",
    prezzo: 16,
    durataMinuti: 30,
    badge: "Trend",
    immagine: "assets/services/sfumatura.png",
    dettagli: "Fade personalizzato|Controllo simmetria|Finish opaco"
  },
  {
    valore: "barba",
    nome: "Barba",
    descrizione: "Modellatura barba, panno caldo e prodotti dedicati.",
    prezzo: 7,
    durataMinuti: 30,
    badge: "Relax",
    immagine: "assets/services/barba.png",
    dettagli: "Panno caldo|Olio barba|Rasatura contorni"
  },
  {
    valore: "completo",
    nome: "Taglio e Barba",
    descrizione: "Servizio completo per un look ordinato e curato.",
    prezzo: 18,
    durataMinuti: 60,
    badge: "Completo",
    immagine: "assets/services/taglio-barba.png",
    dettagli: "Taglio su misura|Barba completa|Styling finale"
  },
  {
    valore: "colore",
    nome: "Taglio + colore",
    descrizione: "Taglio, applicazione colore e finitura completa.",
    prezzo: 55,
    durataMinuti: 120,
    badge: "Premium",
    immagine: "assets/services/colore.png",
    dettagli: "Consulenza colore|Applicazione tecnica|Finish protettivo"
  }
];

db.run(`
  CREATE TABLE IF NOT EXISTS servizi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    valore TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    descrizione TEXT,
    prezzo REAL NOT NULL DEFAULT 0,
    durata_minuti INTEGER NOT NULL DEFAULT 30,
    badge TEXT,
    immagine TEXT,
    dettagli TEXT,
    attivo INTEGER NOT NULL DEFAULT 1
  )
`, (err) => {
  if (err) {
    console.error("Errore creazione tabella servizi:", err.message);
    return;
  }

  serviziDefault.forEach((servizio) => {
    db.run(
      `INSERT OR IGNORE INTO servizi
        (valore, nome, descrizione, prezzo, durata_minuti, badge, immagine, dettagli, attivo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        servizio.valore,
        servizio.nome,
        servizio.descrizione,
        servizio.prezzo,
        servizio.durataMinuti,
        servizio.badge,
        servizio.immagine,
        servizio.dettagli
      ],
      (err) => { if (err) console.error("Errore seed servizio:", err.message); }
    );
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
    stato TEXT DEFAULT 'confermata',
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`, (err) => {
  if (err) {
    console.error("❌ Errore creazione tabella prenotazioni:", err.message);
  } else {
    console.log("✅ Tabella prenotazioni pronta!");
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS disponibilita_blocchi (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    ora_inizio TEXT NOT NULL,
    ora_fine TEXT NOT NULL,
    intera_giornata INTEGER NOT NULL DEFAULT 0,
    motivo TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) {
    console.error("Errore creazione tabella disponibilita_blocchi:", err.message);
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS disponibilita_regole (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    giorno_settimana INTEGER NOT NULL,
    ora_inizio TEXT NOT NULL,
    ora_fine TEXT NOT NULL,
    intera_giornata INTEGER NOT NULL DEFAULT 0,
    motivo TEXT,
    valida_dal TEXT,
    valida_al TEXT,
    attiva INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) {
    console.error("Errore creazione tabella disponibilita_regole:", err.message);
  }
});

const prenotazioneColumns = [
  { name: "ora_fine", definition: "TEXT" },
  { name: "durata_minuti", definition: "INTEGER" },
  { name: "stato", definition: "TEXT DEFAULT 'confermata'" }
];

db.run(`
  CREATE TABLE IF NOT EXISTS notifiche (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    prenotazione_id INTEGER,
    titolo TEXT NOT NULL,
    messaggio TEXT NOT NULL,
    letta INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (prenotazione_id) REFERENCES prenotazioni(id)
  )
`, (err) => {
  if (err) {
    console.error("Errore creazione tabella notifiche:", err.message);
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS contatti_salone (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nome TEXT NOT NULL DEFAULT 'MyBarber',
    indirizzo TEXT NOT NULL DEFAULT 'Via Roma, 123 - 90100 Palermo (PA)',
    telefono TEXT NOT NULL DEFAULT '+39 091 1234567',
    email TEXT NOT NULL DEFAULT 'info@mybarber.it',
    orari TEXT NOT NULL DEFAULT 'Lunedi: Chiuso|Martedi - Venerdi: 09:00 - 19:30|Sabato: 08:30 - 20:00|Domenica: Chiuso',
    latitudine REAL NOT NULL DEFAULT 38.1157,
    longitudine REAL NOT NULL DEFAULT 13.3613,
    maps_url TEXT,
    instagram_url TEXT NOT NULL DEFAULT 'https://www.instagram.com/',
    facebook_url TEXT NOT NULL DEFAULT 'https://www.facebook.com/',
    tiktok_url TEXT NOT NULL DEFAULT 'https://www.tiktok.com/',
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) {
    console.error("Errore creazione tabella contatti_salone:", err.message);
    return;
  }

  db.run(
    `
      INSERT OR IGNORE INTO contatti_salone
        (id, nome, indirizzo, telefono, email, orari, latitudine, longitudine, maps_url, instagram_url, facebook_url, tiktok_url)
      VALUES
        (1, 'MyBarber', 'Via Roma, 123 - 90100 Palermo (PA)', '+39 091 1234567', 'info@mybarber.it',
         'Lunedi: Chiuso|Martedi - Venerdi: 09:00 - 19:30|Sabato: 08:30 - 20:00|Domenica: Chiuso',
         38.1157, 13.3613, 'https://www.google.com/maps/dir/?api=1&destination=38.1157,13.3613',
         'https://www.instagram.com/', 'https://www.facebook.com/', 'https://www.tiktok.com/')
    `,
    (seedErr) => { if (seedErr) console.error("Errore seed contatti_salone:", seedErr.message); }
  );
});

const durataServizioSql = `
  COALESCE(
    (SELECT durata_minuti FROM servizi WHERE valore = LOWER(TRIM(servizio))),
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
  )
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
  COALESCE(
    (SELECT durata_minuti FROM servizi WHERE valore = LOWER(TRIM(NEW.servizio))),
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
  )
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

    db.run(`
      UPDATE prenotazioni
      SET stato = 'confermata'
      WHERE stato IS NULL OR stato = ''
    `, (err) => {
      if (err) {
        console.error("Errore aggiornamento stato prenotazioni:", err.message);
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
      `INSERT OR IGNORE INTO users (id, nome, cognome, email, password, telefono, ruolo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [1, 'Mario', 'Rossi', 'mario@example.com', hash1.toString(), '3331112222', 'user'],
      (err) => { if (err) console.error(err); }
    );

    db.run(
      `INSERT OR IGNORE INTO users (id, nome, cognome, email, password, telefono, ruolo) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [2, 'Lucia', 'Bianchi', 'lucia@example.com', hash2.toString(), '3332221111', 'user'],
      (err) => { if (err) console.error(err); }
    );

    const adminHash = await bcrypt.hash('Admin123!', saltRounds);
    db.run(
      `INSERT OR IGNORE INTO users (nome, cognome, email, password, telefono, ruolo) VALUES (?, ?, ?, ?, ?, ?)`,
      ['Barbiere', 'Admin', 'admin@mybarber.local', adminHash.toString(), '3330000000', 'admin'],
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

    db.run(
      `UPDATE users SET ruolo = ? WHERE email = ?`,
      ['admin', 'admin@mybarber.local'],
      (err) => { if (err) console.error(err); }
    );

  } catch (err) {
    console.error(err);
  }
}

module.exports = db;
