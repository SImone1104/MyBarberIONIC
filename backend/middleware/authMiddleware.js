const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

module.exports = (req, res, next) => {


    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(401).json({ message: "Access denied" });
    }

    const token = authHeader.split(" ")[1];

    try {

        const verified = jwt.verify(token, SECRET);

        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ message: "Invalid token" });
    }
};
