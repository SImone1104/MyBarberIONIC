const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const adminMiddleware = require("../middleware/adminMiddleware");
const adminController = require("../controllers/adminControllers");

router.use(authMiddleware, adminMiddleware); //Questa riga protegge tutte le rotte admin.
/*prima controlla token valido
poi controlla ruolo admin
solo dopo entra nei controller admin*/

router.get("/prenotazioni", adminController.getPrenotazioni);
router.post("/prenotazioni", adminController.creaPrenotazione);
router.put("/prenotazioni/:id", adminController.updatePrenotazione);
router.delete("/prenotazioni/:id", adminController.deletePrenotazione);

router.get("/clienti", adminController.getClienti);
router.get("/clienti/:id", adminController.getCliente);

router.get("/statistiche", adminController.getStatistiche);

router.get("/contatti", adminController.getContattiSalone);
router.put("/contatti", adminController.updateContattiSalone);

router.get("/disponibilita", adminController.getDisponibilita);
router.post("/disponibilita", adminController.creaDisponibilita);
router.get("/disponibilita/ricorrenti", adminController.getDisponibilitaRicorrente);
router.post("/disponibilita/ricorrenti", adminController.creaDisponibilitaRicorrente);
router.delete("/disponibilita/ricorrenti/:id", adminController.deleteDisponibilitaRicorrente);
router.delete("/disponibilita/:id", adminController.deleteDisponibilita);

router.get("/servizi", adminController.getServizi);
router.post("/servizi", adminController.creaServizio);
router.put("/servizi/:id", adminController.updateServizio);
router.delete("/servizi/:id", adminController.deleteServizio);

module.exports = router;
