require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./db/db');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middleware
// app.use(cors());

app.use(cors({
  origin: "*", 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' })); // Permette al server di leggere dati in formato JSON

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Rotta di prova
app.get('/', (req, res) => {
    res.send('Il server è attivo e funzionante!');
});

const PORT = process.env.PORT || 3000;
// Accetta connessioni anche da altri dispositivi sulla stessa rete.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server avviato su http://0.0.0.0:${PORT}`);
});
