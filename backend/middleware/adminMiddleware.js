module.exports = (req, res, next) => {
  if (!req.user || req.user.ruolo !== "admin") {
    return res.status(403).json({ message: "Accesso riservato al barbiere" });
  }

  next();
};
