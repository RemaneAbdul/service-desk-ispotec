const router = require("express").Router();
const c = require("../controllers/admin");
const { auth, requireAdmin } = require("../middlewares/auth");

router.use(auth, requireAdmin);

router.get("/dashboard", c.dashboard);
router.get("/pending-users", c.pendingUsers);
router.get("/users", c.users);
router.post("/users", c.createUser);
router.patch("/users/:id", c.updateUser);
router.post("/users/:id/approve", c.approve);
router.post("/users/:id/reject", c.reject);
router.patch("/users/:id/status", c.setStatus);

router.get("/departments", c.departments);
router.post("/departments", c.createDepartment);
router.patch("/departments/:id", c.updateDepartment);

router.get("/categories", c.categories);
router.post("/categories", c.createCategory);
router.patch("/categories/:id", c.updateCategory);

router.get("/services", c.services);
router.post("/services", c.createService);
router.patch("/services/:id", c.updateService);

router.get("/notifications", c.notifications);
router.patch("/notifications/:id/read", c.markNotificationRead);

module.exports = router;
