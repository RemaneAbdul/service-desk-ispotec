const router = require("express").Router();
const multer = require("multer");
const c = require("../controllers/tickets");
const { auth, requireStaff } = require("../middlewares/auth");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.use(auth);
router.get("/", c.list);
router.post("/", c.create);
router.get("/:id", c.get);
router.post("/:id/replies", c.reply);
router.patch("/:id", requireStaff, c.update);
router.post("/:id/reopen", c.reopen);
router.post("/:id/rating", c.rate);
router.post("/:id/attachments", upload.single("file"), c.uploadAttachment);

module.exports = router;
