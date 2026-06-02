require('dotenv').config();

const express = require('express'); //per creare il server
const cors = require('cors'); //permette al frontend Angular di comunicare con il backend
const db = require('./db/db');  //db apre/prepara il database SQLite

const authRoutes = require('./routes/authRoutes'); //authRoutes gestisce login, registrazione, prenotazioni utente
const adminRoutes = require('./routes/adminRoutes'); //adminRoutes gestisce la parte barbiere/admin

const app = express();

// Middleware
// app.use(cors());


//Questo permette richieste da altri indirizzi. È utile perché frontend e backend sono separati:
app.use(cors({
  origin: "*", 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' })); // Permette al server di leggere dati in formato JSON

// Routes
app.use('/api/auth', authRoutes); //Tutte le richieste GET,POST.. che hanno URL POST http://localhost:3000/api/auth/login   va gestita da authRoutes.js
app.use('/api/admin', adminRoutes); //Tutte le richieste GET,POST.. che hanno URL POST http://localhost:3000/api/admin/prenotazioni   va gestita da adminRoutes.js

// Rotta di prova
app.get('/', (req, res) => {
    res.send('Il server è attivo e funzionante!');
});

const PORT = process.env.PORT || 3000;
// Accetta connessioni anche da altri dispositivi sulla stessa rete.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server avviato su http://0.0.0.0:${PORT}`);
});

/*
server.js
  ↓
crea Express
  ↓
attiva CORS
  ↓
attiva lettura JSON
  ↓
collega /api/auth e /api/admin
  ↓
avvia il server sulla porta 3000

*/
