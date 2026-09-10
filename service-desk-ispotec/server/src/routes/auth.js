const router = require("express").Router();
const c = require("../controllers/auth");
const { auth } = require("../middlewares/auth");
router.post("/login", c.login);
router.post("/register", c.register);
router.get("/me", auth, c.me);
module.exports = router;
