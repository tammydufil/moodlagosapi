const {
  getAllProductCategories,
  getAllSubProductCategories,
  createProduct,
  getAllProducts,
  updateProduct,
  getPriceChanges,
  deleteProduct,
  getAllKitchenItems,
  makeItemAvailable,
  makeItemUnavailable,
  getAllBarItems,
  getAllShishaItems,
  getAllItems,
  getAllGeneraProducts,
} = require("../../controllers/adminControllers/productController");
const {
  addTable,
  getAllTables,
  deleteTable,
  updateTableStatus,
  getAllActiveTables,
  updateTableChange,
} = require("../../controllers/adminControllers/tablecontroller");
const {
  
  authenticateUser,
} = require("../../middlewares/authMiddleware");

const router = require("express").Router();

router.get("/getallcategories", authenticateUser, getAllProductCategories);
router.get(
  "/getallsubcategories",
  authenticateUser,
  getAllSubProductCategories
);
router.post("/createproduct", authenticateUser,  createProduct);
router.get("/getallproducts", authenticateUser, getAllProducts);
router.get("/getAllGeneraProducts", authenticateUser, getAllGeneraProducts);
router.get("/getallpriceupdates", authenticateUser,  getPriceChanges);
router.get("/getAllKitchenItems", authenticateUser, getAllKitchenItems);
router.get("/getAllItems", authenticateUser, getAllItems);
router.get("/getAllshishaItems", authenticateUser, getAllShishaItems);
router.get("/getAllBarItems", authenticateUser, getAllBarItems);
router.post("/updateproduct", authenticateUser,  updateProduct);
router.post("/makeItemAvailable", authenticateUser, makeItemAvailable);
router.post("/makeItemUnavailable", authenticateUser, makeItemUnavailable);

router.post("/deleteTable", authenticateUser, deleteTable);
router.post("/updateTableStatus", authenticateUser, updateTableStatus);

router.delete("/deleteproduct", authenticateUser,  deleteProduct);

// Tables

router.post("/addtable", authenticateUser,  addTable);
router.get("/getAllTables", authenticateUser, getAllTables);
router.get("/getAllActiveTables", authenticateUser, getAllActiveTables);
router.post("/updateTableChange", authenticateUser, updateTableChange);

module.exports = router;
