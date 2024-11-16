const {
  fetchSalesDataForEmployee,
  fetchEmployeeSalesByDate,
  fetchSalesDataForAllEmployees,
  fetchAllEmployeeSalesByDateForGraph,
  fetchOrderCountByDateForGraph,
  getSalesReport,
  getRevenuePerLocationReport,
  getTopSellingProducts,
  getSalesPerLocation,
  getTotalLogsByTime,
  getReportData,
  getSalesReportByDateRange,
  getCashierSalesReportByDateRange,
} = require("../../controllers/ReportControllers/dashboard");
const { authenticateUser } = require("../../middlewares/authMiddleware");

const router = require("express").Router();

router.get(
  "/fetchSalesDataForEmployee",
  authenticateUser,
  fetchSalesDataForEmployee
);
router.get(
  "/fetchEmployeeSalesByDate",
  authenticateUser,
  fetchEmployeeSalesByDate
);
router.get(
  "/fetchSalesDataForAllEmployees",
  authenticateUser,
  fetchSalesDataForAllEmployees
);
router.get(
  "/fetchAllEmployeeSalesByDateForGraph",
  authenticateUser,
  fetchAllEmployeeSalesByDateForGraph
);
router.get(
  "/fetchOrderCountByDateForGraph",
  authenticateUser,
  fetchOrderCountByDateForGraph
);
router.get("/getSalesReport", authenticateUser, getSalesReport);
router.get(
  "/getRevenuePerLocationReport",
  authenticateUser,
  getRevenuePerLocationReport
);
router.get("/getTopSellingProducts", authenticateUser, getTopSellingProducts);
router.get("/getSalesPerLocation", authenticateUser, getSalesPerLocation);
router.get("/getTotalLogsByTime", authenticateUser, getTotalLogsByTime);
router.get("/getReportData", authenticateUser, getReportData);
router.get(
  "/getSalesReportByDateRange/:selectedDate",
  authenticateUser,
  getSalesReportByDateRange
);

router.get(
  "/getCashierSalesReportByDateRange/:selectedDate",
  authenticateUser,
  getCashierSalesReportByDateRange
);
module.exports = router;
