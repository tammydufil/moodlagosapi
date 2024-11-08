const {
  getTotalOrderLogsByTime,
  fetchRevenueByPaymentType,
  getTotalPaymentsByMonth,
} = require("../../controllers/ReportControllers/dashboard");
const {
  getKitchenSalesTransactionsByStatus,
  placeOrder,
  getStaffSalesTransactionsByStatus,
  updateExistingOrder,
  cancelOrder,
  acceptAllItemsInOrder,
  updateItemInOrderStatus,
  fetchOrderRejectionReasons,
  serveItemsInOrder,
  serveIndividualItem,
  getAllCompletedSales,
  completeSale,
  getCompletedSales,
  acceptAllBarItemsInOrder,
  serveBarItemsInOrder,
  getBarSalesTransactionsByStatus,
  getCompletedSalesKitchen,
  getCompletedSalesBar,
  serveAllItemsBarInOrder,
  getShishaTransactionsByStatus,
  acceptAllShishaItemsInOrder,
  serveShishaItemsInOrder,
  insertIntoCasierPending,
  getCasierPendingData,
  getAllSpecialDiscountReasons,
  applySpecialDiscount,
  updateSpecialDiscountStatus,
  getPaymentMethods,
  getCasierPendingDiscountApproval,
  getCompletedSalesForEmployee,
  getCompletedSalesShisha,
  getPendingSalesForEmployee,
  getPendingSalesForLocation,
  mergeOrders,
  splitMergedOrders,
  getallFloortransactionlog,
  deleteItemByOrderId,
  updateItemQuantity,
  updateManagerRemoval,
  getAllFloorManagerActionTransactionLog,
  duplicateAndDeleteOrder,
  mergeBill,
} = require("../../controllers/salesControllers/orderController");
const {
  isAdmin,
  authenticateUser,
} = require("../../middlewares/authMiddleware");

const router = require("express").Router();

// Kitchen Routes
router.post("/placeorder", authenticateUser, placeOrder);
router.post("/updateexistingorder", authenticateUser, updateExistingOrder);
router.post(
  "/insertIntoCasierPending",
  authenticateUser,
  insertIntoCasierPending
);
router.get("/getCasierPendingData", authenticateUser, getCasierPendingData);
router.get(
  "/getAllSpecialDiscountReasons",
  authenticateUser,
  getAllSpecialDiscountReasons
);
router.post("/cancelOrder", authenticateUser, cancelOrder);
router.post("/updateiteminorder", authenticateUser, updateItemInOrderStatus);
router.post("/deleteItemByOrderId", authenticateUser, deleteItemByOrderId);
router.post("/updateItemQuantity", authenticateUser, updateItemQuantity);
router.get(
  "/getkitchentransactionlog",
  authenticateUser,
  getKitchenSalesTransactionsByStatus
);
router.get(
  "/getbartransactionlog",
  authenticateUser,
  getBarSalesTransactionsByStatus
);
router.get(
  "/getShishaTransactionsByStatus",
  authenticateUser,
  getShishaTransactionsByStatus
);
router.get(
  "/getstafftransactionlog",
  authenticateUser,
  getStaffSalesTransactionsByStatus
);
router.get(
  "/getallFloortransactionlog",
  authenticateUser,
  getallFloortransactionlog
);
router.get(
  "/fetchOrderRejectionReasons",
  authenticateUser,
  fetchOrderRejectionReasons
);
router.get("/getAllCompletedSales", authenticateUser, getCompletedSales);
router.get(
  "/getCompletedSalesShisha",
  authenticateUser,
  getCompletedSalesShisha
);
router.get(
  "/getCompletedSalesForEmployee",
  authenticateUser,
  getCompletedSalesForEmployee
);
router.get(
  "/getCompletedSalesKitchen",
  authenticateUser,
  getCompletedSalesKitchen
);
router.get("/getCompletedSalesBar", authenticateUser, getCompletedSalesBar);
router.get(
  "/getTotalOrderLogsByTime",
  authenticateUser,
  getTotalOrderLogsByTime
);
router.get(
  "/fetchRevenueDataForEmployee",
  authenticateUser,
  fetchRevenueByPaymentType
);
router.get(
  "/getTotalPaymentsByMonth",
  authenticateUser,
  getTotalPaymentsByMonth
);
router.post("/acceptallitemsinorder", authenticateUser, acceptAllItemsInOrder);
router.post(
  "/acceptAllShishaItemsInOrder",
  authenticateUser,
  acceptAllShishaItemsInOrder
);
router.post(
  "/acceptAllBarItemsInOrder",
  authenticateUser,
  acceptAllBarItemsInOrder
);
router.post(
  "/serveAllItemsBarInOrder",
  authenticateUser,
  serveAllItemsBarInOrder
);
router.post("/serveallitemsinorder", authenticateUser, serveItemsInOrder);
router.post("/serveBarItemsInOrder", authenticateUser, serveBarItemsInOrder);
router.post(
  "/serveShishaItemsInOrder",
  authenticateUser,
  serveShishaItemsInOrder
);
router.post("/updateManagerRemoval", authenticateUser, updateManagerRemoval);
router.get(
  "/getAllFloorManagerActionTransactionLog",
  authenticateUser,
  getAllFloorManagerActionTransactionLog
);
router.post("/serveindividualitem", authenticateUser, serveIndividualItem);
router.post("/completeSale", authenticateUser, completeSale);
router.post("/applySpecialDiscount", authenticateUser, applySpecialDiscount);
router.post(
  "/updateSpecialDiscountStatus",
  authenticateUser,
  updateSpecialDiscountStatus
);
router.post("/mergeOrders", authenticateUser, mergeOrders);
router.post(
  "/duplicateAndDeleteOrder",
  authenticateUser,
  duplicateAndDeleteOrder
);
router.post("/splitMergedOrders", authenticateUser, splitMergedOrders);
router.post("/mergeBill", authenticateUser, mergeBill);
router.get("/getPaymentMethods", authenticateUser, getPaymentMethods);
router.get(
  "/getCasierPendingDiscountApproval",
  authenticateUser,
  getCasierPendingDiscountApproval
);
router.get(
  "/getPendingSalesForEmployee",
  authenticateUser,
  getPendingSalesForEmployee
);
router.get(
  "/getPendingSalesForLocation",
  authenticateUser,
  getPendingSalesForLocation
);

module.exports = router;
