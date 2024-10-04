const {
  addTaxUpdate,
  getAllTaxUpdates,
  addProductDiscount,
  getAllProductDiscounts,
  deactivateProductDiscount,
  getAllOrderDiscounts,
  addOrderDiscount,
  completeSale,
} = require("../../controllers/taxAndDiscountcontrollers/taxcontroller");
const { authenticateUser } = require("../../middlewares/authMiddleware");

const router = require("express").Router();

router.post("/addtax", authenticateUser, addTaxUpdate);
router.post("/addproductdiscount", authenticateUser, addProductDiscount);
router.post(
  "/deactivateproductdiscount",
  authenticateUser,
  deactivateProductDiscount
);
router.get("/getAllTaxUpdates", authenticateUser, getAllTaxUpdates);
router.get("/getproductdiscounts", authenticateUser, getAllProductDiscounts);
router.get("/getAllOrderDiscounts", authenticateUser, getAllOrderDiscounts);
router.post("/addOrderDiscount", authenticateUser, addOrderDiscount);

module.exports = router;
