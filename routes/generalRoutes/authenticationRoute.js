const {
  login,
  register,
  updateUser,
  getAllUsers,
  deleteUser,
  getActiveModules,
  getUnreadNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} = require("../../controllers/generalControllers/authenticationController");
const {
  isAdmin,
  authenticateUser,
} = require("../../middlewares/authMiddleware");

const router = require("express").Router();

router.post("/login", login);
router.post("/register", authenticateUser, isAdmin, register);
router.post("/updateuser", authenticateUser, isAdmin, updateUser);
router.get("/getallusers", authenticateUser, isAdmin, getAllUsers);
router.get("/getActiveModules", authenticateUser, getActiveModules);
router.post("/deleteuser", authenticateUser, isAdmin, deleteUser);

router.get("/getUnreadNotifications", authenticateUser, getUnreadNotifications);

router.post("/markNotificationAsRead", authenticateUser, markNotificationAsRead);
router.post(
  "/markAllNotificationsAsRead",
  authenticateUser,
  markAllNotificationsAsRead
);

module.exports = router;
