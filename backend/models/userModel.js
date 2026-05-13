const db = require("../db/db");

const User = {
  create: ({ nome, cognome, email, password, telefono, ruolo = "user" }) => {
    return new Promise((resolve, reject) => {
      const query = `INSERT INTO users (nome, cognome, email, password, telefono, ruolo) VALUES (?, ?, ?, ?, ?, ?)`;
      db.run(query, [nome, cognome, email, password, telefono, ruolo], function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, nome, cognome, email, telefono, ruolo });
      });
    });
  },

  findByEmail: (email) => {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM users WHERE email = ?`;
      db.get(query, [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  findById: (id) => {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM users WHERE id = ?`;
      db.get(query, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  updateProfile: (id, { nome, cognome, email, telefono }) => {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE users
        SET nome = ?, cognome = ?, email = ?, telefono = ?
        WHERE id = ?
      `;

      db.run(query, [nome, cognome, email, telefono, id], function (err) {
        if (err) reject(err);
        else if (this.changes === 0) resolve(null);
        else resolve({ id: Number(id), nome, cognome, email, telefono });
      });
    });
  }
};

module.exports = User;
