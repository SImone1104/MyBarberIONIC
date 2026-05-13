const express = require("express");
const router = express.Router();
const authController = require("../controllers/authControllers");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/servizi", authController.getServiziPubblici);
router.get("/contatti-salone", authController.getContattiSalonePubblici);

// esempio route protetta
router.get("/profile", authMiddleware, authController.getProfile);
router.put("/profile", authMiddleware, authController.updateProfile);

// Rotta per creare una prenotazione (Protetta)
router.post("/prenota", authMiddleware, authController.creaPrenotazione);
router.put("/prenota/:id/riprogramma", authMiddleware, authController.riprogrammaPrenotazione);

// Rotta per vedere gli orari gia occupati in una data (Protetta)
router.get("/orari-occupati", authMiddleware, authController.getOrariOccupati);

// Rotta per vedere le proprie prenotazioni (Protetta)
router.get("/miei-appuntamenti", authMiddleware, authController.getPrenotazioniUtente);

router.get("/notifiche", authMiddleware, authController.getNotificheUtente);
router.put("/notifiche/:id/letta", authMiddleware, authController.segnaNotificaLetta);

// Rotta per eliminare (Protetta)
router.delete("/prenota/:id", authMiddleware, authController.deletePrenotazione);

module.exports = router;

