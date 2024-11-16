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
  
  authenticateUser,
} = require("../../middlewares/authMiddleware");

const router = require("express").Router();

router.post("/register", authenticateUser,  register);
router.post("/login", login);
router.post("/updateuser", authenticateUser,  updateUser);
router.get("/getallusers", authenticateUser,  getAllUsers);
router.get("/getActiveModules", authenticateUser, getActiveModules);
router.post("/deleteuser", authenticateUser,  deleteUser);

router.get("/getUnreadNotifications", authenticateUser, getUnreadNotifications);

router.post("/markNotificationAsRead", authenticateUser, markNotificationAsRead);
router.post(
  "/markAllNotificationsAsRead",
  authenticateUser,
  markAllNotificationsAsRead
);

module.exports = router;
