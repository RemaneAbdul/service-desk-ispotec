const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const c = require("../controllers/auth");
const { auth } = require("../middlewares/auth");

router.post("/login", rateLimit({windowMs:15*60*1000,limit:20}), c.login);
router.post("/refresh", c.refresh);
router.post("/register", rateLimit({windowMs:60*60*1000,limit:10}), c.register);
router.get("/departments", c.departments);
router.get("/notifications", auth, c.notifications);
router.patch("/notifications/:id/read", auth, c.markNotificationRead);
router.post("/logout", auth, c.logout);
router.get("/me", auth, c.me);

module.exports = router;
