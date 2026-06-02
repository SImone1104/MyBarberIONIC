//I Middleware controllano che il token sia valido q

const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

module.exports = (req, res, next) => {


    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(401).json({ message: "Access denied" });
    }

    const token = authHeader.split(" ")[1];

    try {

        const verified = jwt.verify(token, SECRET); // decodifica il token

        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ message: "Invalid token" });
    }
};


/*Dopo il middleware le richieste saranno:
{
  "headers": {
    "authorization": "Bearer eyJhbGciOiJIUzI1NiIs..."
  },
  "body": {},
  "user": {
    "id": 7,
    "email": "giuseppe@example.com",
    "ruolo": "user",
    "iat": 1770000000,
    "exp": 1770003600
  }
}


A quel punto il controller può fare:

const userId = req.user.id;

Come??
Decodificando il token
*/
