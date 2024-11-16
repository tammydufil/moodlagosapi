const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../models/index");
const jwt = require("jsonwebtoken");

const fetchSalesDataForEmployee = async (req, res) => {
  try {
    const tokenUser = req.user;
    const username = tokenUser.username;

    const userQuery = `
          SELECT [orderManage] 
          FROM [MoodLagos].[dbo].[userCreation_table] 
          WHERE [username] = :username
        `;
    const user = await sequelize.query(userQuery, {
      type: QueryTypes.SELECT,
      replacements: { username },
    });

    if (!user || user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const orderManage = user[0].orderManage;
    let conditionField =
      orderManage === "1" ? "st.username" : "st.actionusername";

    // Base query to get total sales, grouping by orderid
    const salesBaseQuery = `
          SELECT SUM(CAST(cs.total AS DECIMAL(18, 2))) AS total_sales 
          FROM [MoodLagos].[dbo].[CompletedSales] cs
          JOIN (
              SELECT DISTINCT orderid 
              FROM [MoodLagos].[dbo].[casierPending] st
              WHERE ${conditionField} = :username 
                AND st.finalstatus = 'Completed' 
                AND st.status = 'Served'         
          ) AS unique_orders ON cs.orderid = unique_orders.orderid
        `;

    const salesTodayQuery = `${salesBaseQuery} 
          WHERE CONVERT(DATE, cs.date) = CONVERT(DATE, GETDATE())`;

    const salesYesterdayQuery = `${salesBaseQuery} 
          WHERE CONVERT(DATE, cs.date) = CONVERT(DATE, DATEADD(day, -1, GETDATE()))`;

    const salesThisWeekQuery = `${salesBaseQuery} 
          WHERE DATEPART(week, cs.date) = DATEPART(week, GETDATE())
          AND DATEPART(year, cs.date) = DATEPART(year, GETDATE())`;

    const salesThisMonthQuery = `${salesBaseQuery} 
          WHERE MONTH(cs.date) = MONTH(GETDATE()) 
          AND YEAR(cs.date) = YEAR(GETDATE())`;

    // Execute all queries in parallel
    const [salesToday, salesYesterday, salesThisWeek, salesThisMonth] =
      await Promise.all([
        sequelize.query(salesTodayQuery, {
          type: QueryTypes.SELECT,
          replacements: { username },
        }),
        sequelize.query(salesYesterdayQuery, {
          type: QueryTypes.SELECT,
          replacements: { username },
        }),
        sequelize.query(salesThisWeekQuery, {
          type: QueryTypes.SELECT,
          replacements: { username },
        }),
        sequelize.query(salesThisMonthQuery, {
          type: QueryTypes.SELECT,
          replacements: { username },
        }),
      ]);

    res.status(200).json({
      salesToday: salesToday[0].total_sales || 0,
      salesYesterday: salesYesterday[0].total_sales || 0,
      salesThisWeek: salesThisWeek[0].total_sales || 0,
      salesThisMonth: salesThisMonth[0].total_sales || 0,
    });
  } catch (error) {
    console.error("Error fetching sales data:", error);
    res.status(500).json({
      message: "Failed to fetch sales data",
      error: error.message,
    });
  }
};

const fetchEmployeeSalesByDate = async (req, res) => {
  try {
    // Extract token from headers
    const token = req.headers.authorization.split(" ")[1];
    const decodedToken = jwt.verify(token, process.env.JWT_KEY);
    const username = decodedToken.username;

    const { day, month, year } = req.query;

    // Construct date filter
    let dateCondition = "";
    if (day) {
      dateCondition = `AND CAST(cs.date AS DATE) = CAST('${year}-${month}-${day}' AS DATE)`; // Specific day
    } else if (month && year) {
      dateCondition = `AND YEAR(CAST(cs.date AS DATE)) = '${year}' AND MONTH(CAST(cs.date AS DATE)) = '${month}'`; // Specific month & year
    } else if (year) {
      dateCondition = `AND YEAR(CAST(cs.date AS DATE)) = '${year}'`; // Specific year
    }

    // Fetch user data to check orderManage permission
    const user = await sequelize.query(
      `SELECT * FROM [MoodLagos].[dbo].[userCreation_table] WHERE username = :username`,
      {
        replacements: { username },
        type: QueryTypes.SELECT,
      }
    );

    if (!user.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const userPermissions = user[0];

    // Determine which username to use for filtering orders
    const userColumn =
      userPermissions.orderManage === "1" ? "st.username" : "st.actionusername";

    // Fetch sales transactions with only one item per orderid
    const sales = await sequelize.query(
      `SELECT 
         cs.id, 
         cs.orderid, 
         cs.paymentType, 
         cs.subtotal, 
         cs.vat, 
         cs.orderdiscount, 
         cs.date, 
         cs.total, 
         st.username, 
         st.itemname, 
         st.quantity, 
         st.price, 
         st.createdDate
       FROM 
         [MoodLagos].[dbo].[CompletedSales] cs
       JOIN 
         (SELECT 
             orderid, 
             username, 
             itemname, 
             quantity, 
             price, 
             createdDate,
             ROW_NUMBER() OVER (PARTITION BY orderid ORDER BY createdDate) AS rn
           FROM 
             [MoodLagos].[dbo].[casierPending]
           WHERE 
             finalstatus = 'Completed' 
             AND status = 'Served') st ON cs.orderid = st.orderid
       WHERE 
         ${userColumn} = :username
         AND st.rn = 1  -- Get only the first item per orderid
         ${dateCondition}
       ORDER BY 
         cs.date DESC`,
      {
        replacements: { username },
        type: QueryTypes.SELECT,
      }
    );

    if (!sales.length) {
      return res
        .status(404)
        .json({ message: "No sales found for the specified date." });
    }

    // Return the sales data
    res.status(200).json({ data: sales });
  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({
      message: "Failed to fetch sales data",
      error: error.message,
    });
  }
};

const fetchAllEmployeeSalesByDateForGraph = async (req, res) => {
  try {
    // Extract token from headers
    const token = req.headers.authorization.split(" ")[1];
    const decodedToken = jwt.verify(token, process.env.JWT_KEY);
    const username = decodedToken.username;

    const { day, month, year } = req.query;

    // Construct date filter
    let dateCondition = "";
    if (day) {
      dateCondition = `AND CAST(cs.date AS DATE) = CAST('${year}-${month}-${day}' AS DATE)`; // Specific day
    } else if (month && year) {
      dateCondition = `AND YEAR(CAST(cs.date AS DATE)) = '${year}' AND MONTH(CAST(cs.date AS DATE)) = '${month}'`; // Specific month & year
    } else if (year) {
      dateCondition = `AND YEAR(CAST(cs.date AS DATE)) = '${year}'`; // Specific year
    }

    // Fetch user data to check orderManage permission
    const user = await sequelize.query(
      `SELECT * FROM [MoodLagos].[dbo].[userCreation_table] WHERE username = :username`,
      {
        replacements: { username },
        type: QueryTypes.SELECT,
      }
    );

    if (!user.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const userPermissions = user[0];

    // Determine which username to use for filtering orders
    const userColumn =
      userPermissions.orderManage === "1" ? "st.username" : "st.actionusername";

    // Fetch sales transactions with only one item per orderid
    const sales = await sequelize.query(
      `SELECT 
         cs.id, 
         cs.orderid, 
         cs.paymentType, 
         cs.subtotal, 
         cs.vat, 
         cs.orderdiscount, 
         cs.date, 
         cs.total, 
         st.username, 
         st.itemname, 
         st.quantity, 
         st.price, 
         st.createdDate
       FROM 
         [MoodLagos].[dbo].[CompletedSales] cs
       JOIN 
         (SELECT 
             orderid, 
             username, 
             itemname, 
             quantity, 
             price, 
             createdDate,
             ROW_NUMBER() OVER (PARTITION BY orderid ORDER BY createdDate) AS rn
           FROM 
             [MoodLagos].[dbo].[casierPending]
           WHERE 
             finalstatus = 'Completed' 
             AND status = 'Served') st ON cs.orderid = st.orderid
       WHERE 
         st.rn = 1  
         ${dateCondition}
       ORDER BY 
         cs.date DESC`,
      {
        replacements: { username },
        type: QueryTypes.SELECT,
      }
    );

    if (!sales.length) {
      return res
        .status(404)
        .json({ message: "No sales found for the specified date." });
    }

    // Return the sales data
    res.status(200).json({ data: sales });
  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({
      message: "Failed to fetch sales data",
      error: error.message,
    });
  }
};

const fetchSalesDataForAllEmployees = async (req, res) => {
  try {
    // Base query to get total sales, grouping by orderid
    const salesBaseQuery = `
      SELECT SUM(CAST(cs.total AS DECIMAL(18, 2))) AS total_sales 
      FROM [MoodLagos].[dbo].[CompletedSales] cs
      JOIN (
          SELECT DISTINCT orderid 
          FROM [MoodLagos].[dbo].[casierPending] 
          WHERE finalstatus = 'Completed' 
            AND status = 'Served'
      ) AS unique_orders ON cs.orderid = unique_orders.orderid
    `;

    // Prepare queries for total sales data
    const salesTodayQuery = `${salesBaseQuery} 
        WHERE CONVERT(DATE, cs.date) = CONVERT(DATE, GETDATE())`;

    const salesYesterdayQuery = `${salesBaseQuery} 
        WHERE CONVERT(DATE, cs.date) = CONVERT(DATE, DATEADD(day, -1, GETDATE()))`;

    const salesThisWeekQuery = `${salesBaseQuery} 
        WHERE DATEPART(week, cs.date) = DATEPART(week, GETDATE())
        AND DATEPART(year, cs.date) = DATEPART(year, GETDATE())`;

    const salesThisMonthQuery = `${salesBaseQuery} 
        WHERE MONTH(cs.date) = MONTH(GETDATE()) 
        AND YEAR(cs.date) = YEAR(GETDATE())`;

    // Execute all queries in parallel
    const [salesToday, salesYesterday, salesThisWeek, salesThisMonth] =
      await Promise.all([
        sequelize.query(salesTodayQuery, {
          type: QueryTypes.SELECT,
        }),
        sequelize.query(salesYesterdayQuery, {
          type: QueryTypes.SELECT,
        }),
        sequelize.query(salesThisWeekQuery, {
          type: QueryTypes.SELECT,
        }),
        sequelize.query(salesThisMonthQuery, {
          type: QueryTypes.SELECT,
        }),
      ]);

    res.status(200).json({
      salesToday: salesToday[0].total_sales || 0,
      salesYesterday: salesYesterday[0].total_sales || 0,
      salesThisWeek: salesThisWeek[0].total_sales || 0,
      salesThisMonth: salesThisMonth[0].total_sales || 0,
    });
  } catch (error) {
    console.error("Error fetching sales data:", error);
    res.status(500).json({
      message: "Failed to fetch sales data",
      error: error.message,
    });
  }
};

// const fetchAllEmployeeSalesByDateForGraph = async (req, res) => {
//   try {
//     // Extract token from headers (if you still need it for other purposes)
//     const token = req.headers.authorization.split(" ")[1];
//     const decodedToken = jwt.verify(token, process.env.JWT_KEY);

//     const { day, month, year } = req.query;

//     // Construct date filter
//     let dateCondition = "";
//     if (day) {
//       dateCondition = `AND CAST(cs.date AS DATE) = CAST('${year}-${month}-${day}' AS DATE)`; // Specific day
//     } else if (month && year) {
//       dateCondition = `AND YEAR(CAST(cs.date AS DATE)) = '${year}' AND MONTH(CAST(cs.date AS DATE)) = '${month}'`; // Specific month & year
//     } else if (year) {
//       dateCondition = `AND YEAR(CAST(cs.date AS DATE)) = '${year}'`; // Specific year
//     }

//     // Fetch sales transactions for all employees with totals
//     const sales = await sequelize.query(
//       `SELECT
//          cs.orderid,
//          SUM(CAST(cs.total AS DECIMAL(18, 2))) AS total_sales,
//          COUNT(DISTINCT st.orderid) AS order_count
//        FROM
//          [MoodLagos].[dbo].[CompletedSales] cs
//        JOIN
//          (SELECT DISTINCT orderid
//           FROM [MoodLagos].[dbo].[casierPending]
//           WHERE finalstatus = 'Completed'
//           AND status = 'Served') st ON cs.orderid = st.orderid
//        WHERE
//          cs.finalstatus = 'Completed'
//          AND cs.status = 'Served'
//          ${dateCondition}
//        GROUP BY
//          cs.orderid
//        ORDER BY
//          cs.date DESC`,
//       {
//         type: QueryTypes.SELECT,
//       }
//     );

//     if (!sales.length) {
//       return res
//         .status(404)
//         .json({ message: "No sales found for the specified date." });
//     }

//     // Return the sales data
//     res.status(200).json({ data: sales });
//   } catch (error) {
//     console.error("Error fetching sales:", error);
//     res.status(500).json({
//       message: "Failed to fetch sales data",
//       error: error.message,
//     });
//   }
// };
const fetchOrderCountByDateForGraph = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decodedToken = jwt.verify(token, process.env.JWT_KEY);

    const { day, month, year } = req.query;

    // Construct date filter
    let dateCondition = "";
    if (day) {
      dateCondition = `AND CAST(cs.createdDate AS DATE) = CAST('${year}-${month}-${day}' AS DATE)`; // Specific day
    } else if (month && year) {
      dateCondition = `AND YEAR(CAST(cs.createdDate AS DATE)) = '${year}' AND MONTH(CAST(cs.createdDate AS DATE)) = '${month}'`; // Specific month & year
    } else if (year) {
      dateCondition = `AND YEAR(CAST(cs.createdDate AS DATE)) = '${year}'`; // Specific year
    }

    // Fetch sales transactions without filtering to just one item per orderid
    const sales = await sequelize.query(
      `SELECT 
         cs.id, 
         cs.orderid, 
         cs.paymentType, 
         cs.subtotal, 
         cs.vat, 
         cs.orderdiscount, 
         cs.createdDate AS saleDate, 
         cs.total, 
         st.username, 
         st.itemname, 
         st.quantity, 
         st.price, 
         st.createdDate AS transactionDate
       FROM 
         [MoodLagos].[dbo].[CompletedSales] cs
       JOIN 
         [MoodLagos].[dbo].[casierPending] st ON cs.orderid = st.orderid
       WHERE 
         st.finalstatus = 'Completed' 
         AND st.status = 'Served'
         ${dateCondition}
       ORDER BY 
         cs.createdDate DESC`,
      {
        type: QueryTypes.SELECT,
      }
    );

    if (!sales.length) {
      return res
        .status(404)
        .json({ message: "No sales found for the specified date." });
    }

    // Return the sales data
    res.status(200).json({ data: sales });
  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({
      message: "Failed to fetch sales data",
      error: error.message,
    });
  }
};

const getSalesReport = async (req, res) => {
  const { month, year } = req.query; // Extract month and year from query parameters

  let query = `
        SELECT st.[sid], st.[orderid], st.[itemname], st.[username], st.[actionusername], 
               st.[servedtime], st.[acceptorrejecttime], st.[quantity], 
               st.[price], st.[updated], st.[category], st.[itemorderid], 
               st.[location], st.[rejectionreason], st.[finalstatus], 
               st.[status], st.[completedtime], st.[createdDate], st.[table],
               cs.[paymentType], cs.[subtotal], cs.[delivery], cs.[vat], cs.[orderdiscount], cs.[date], cs.[total]
        FROM [MoodLagos].[dbo].[casierPending] st
        LEFT JOIN [MoodLagos].[dbo].[CompletedSales] cs ON st.orderid = cs.orderid
        WHERE 1=1
    `;

  const replacements = {};

  // Append conditions based on the input parameters
  if (month) {
    query += ` AND MONTH(st.createdDate) = :month`;
    replacements.month = Number(month);
  }

  if (year) {
    query += ` AND YEAR(st.createdDate) = :year`;
    replacements.year = Number(year);
  }

  try {
    const result = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching sales report:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const getRevenuePerLocationReport = async (req, res) => {
  try {
    const currentMonth = new Date().getMonth() + 1; // JavaScript months are 0-indexed, so +1 for the correct month
    const currentYear = new Date().getFullYear();
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1; // Adjust for January
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // 1. Total revenue this month (both kitchen and bar) with status 'Served' and finalstatus 'Completed'
    const totalRevenueThisMonth = await sequelize.query(
      `SELECT SUM(
          CASE 
            WHEN productDiscount IS NOT NULL 
            THEN (CAST(price AS DECIMAL(18, 2)) * CAST(quantity AS DECIMAL(18, 2))) * (1 - (CAST(productDiscount AS DECIMAL(18, 2)) / 100)) 
            ELSE (CAST(price AS DECIMAL(18, 2)) * CAST(quantity AS DECIMAL(18, 2))) 
          END
        ) AS total_revenue_this_month
         FROM [MoodLagos].[dbo].[casierPending]
         WHERE MONTH(completedtime) = :currentMonth AND YEAR(completedtime) = :currentYear 
         AND status = 'Served' AND finalstatus = 'Completed'`,
      {
        type: QueryTypes.SELECT,
        replacements: { currentMonth, currentYear },
      }
    );

    // 2. Total revenue this month (kitchen only) with status 'Served' and finalstatus 'Completed'
    const kitchenRevenueThisMonth = await sequelize.query(
      `SELECT SUM(
          CASE 
            WHEN productDiscount IS NOT NULL 
            THEN (CAST(price AS DECIMAL(18, 2)) * CAST(quantity AS DECIMAL(18, 2))) * (1 - (CAST(productDiscount AS DECIMAL(18, 2)) / 100)) 
            ELSE (CAST(price AS DECIMAL(18, 2)) * CAST(quantity AS DECIMAL(18, 2))) 
          END
        ) AS kitchen_revenue_this_month
         FROM [MoodLagos].[dbo].[casierPending]
         WHERE MONTH(completedtime) = :currentMonth AND YEAR(completedtime) = :currentYear 
         AND location = 'KITCHEN' AND status = 'Served' AND finalstatus = 'Completed'`,
      {
        type: QueryTypes.SELECT,
        replacements: { currentMonth, currentYear },
      }
    );

    // 3. Total revenue this month (bar only) with status 'Served' and finalstatus 'Completed'
    const barRevenueThisMonth = await sequelize.query(
      `SELECT SUM(
          CASE 
            WHEN productDiscount IS NOT NULL 
            THEN (CAST(price AS DECIMAL(18, 2)) * CAST(quantity AS DECIMAL(18, 2))) * (1 - (CAST(productDiscount AS DECIMAL(18, 2)) / 100)) 
            ELSE (CAST(price AS DECIMAL(18, 2)) * CAST(quantity AS DECIMAL(18, 2))) 
          END
        ) AS bar_revenue_this_month
         FROM [MoodLagos].[dbo].[casierPending]
         WHERE MONTH(completedtime) = :currentMonth AND YEAR(completedtime) = :currentYear 
         AND location = 'BAR' AND status = 'Served' AND finalstatus = 'Completed'`,
      {
        type: QueryTypes.SELECT,
        replacements: { currentMonth, currentYear },
      }
    );

    // 4. Total revenue this month (shisha only) with status 'Served' and finalstatus 'Completed'
    const shishaRevenueThisMonth = await sequelize.query(
      `SELECT SUM(
          CASE 
            WHEN productDiscount IS NOT NULL 
            THEN (CAST(price AS DECIMAL(18, 2)) * CAST(quantity AS DECIMAL(18, 2))) * (1 - (CAST(productDiscount AS DECIMAL(18, 2)) / 100)) 
            ELSE (CAST(price AS DECIMAL(18, 2)) * CAST(quantity AS DECIMAL(18, 2))) 
          END
        ) AS shisha_revenue_this_month
         FROM [MoodLagos].[dbo].[casierPending]
         WHERE MONTH(completedtime) = :currentMonth AND YEAR(completedtime) = :currentYear 
         AND location = 'SHISHA' AND status = 'Served' AND finalstatus = 'Completed'`,
      {
        type: QueryTypes.SELECT,
        replacements: { currentMonth, currentYear },
      }
    );

    // 5. Total revenue last month (both kitchen and bar) with status 'Served' and finalstatus 'Completed'
    const totalRevenueLastMonth = await sequelize.query(
      `SELECT SUM(
          CASE 
            WHEN productDiscount IS NOT NULL 
            THEN (CAST(price AS DECIMAL(18, 2)) * CAST(quantity AS DECIMAL(18, 2))) * (1 - (CAST(productDiscount AS DECIMAL(18, 2)) / 100)) 
            ELSE (CAST(price AS DECIMAL(18, 2)) * CAST(quantity AS DECIMAL(18, 2))) 
          END
        ) AS total_revenue_last_month
         FROM [MoodLagos].[dbo].[casierPending]
         WHERE MONTH(completedtime) = :lastMonth AND YEAR(completedtime) = :lastMonthYear 
         AND status = 'Served' AND finalstatus = 'Completed'`,
      {
        type: QueryTypes.SELECT,
        replacements: { lastMonth, lastMonthYear },
      }
    );

    // Response with calculated values
    const response = {
      totalRevenueThisMonth:
        totalRevenueThisMonth[0]?.total_revenue_this_month || 0,
      kitchenRevenueThisMonth:
        kitchenRevenueThisMonth[0]?.kitchen_revenue_this_month || 0,
      barRevenueThisMonth: barRevenueThisMonth[0]?.bar_revenue_this_month || 0,
      shishaRevenueThisMonth:
        shishaRevenueThisMonth[0]?.shisha_revenue_this_month || 0,
      totalRevenueLastMonth:
        totalRevenueLastMonth[0]?.total_revenue_last_month || 0,
    };

    // Send the response back
    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching revenue report:", error);
    res
      .status(500)
      .json({ message: "Error fetching revenue report", error: error.message });
  }
};

const getTopSellingProducts = async (req, res) => {
  try {
    const { month, year, limit, location } = req.query;

    // Set the default limit to 5 if not provided
    const productLimit = parseInt(limit, 10) || 5;

    // Start with the common filters
    let whereClause = "WHERE status = 'Served' AND finalstatus = 'Completed'";

    // Check if year is provided and append to where clause
    if (year && year !== "null") {
      whereClause += " AND YEAR(completedtime) = CAST(:year AS INT)";
    }

    // Check if month is provided and append to where clause
    if (month && month !== "null") {
      whereClause += " AND MONTH(completedtime) = CAST(:month AS INT)";
    }

    // Check if location is provided and append to where clause
    if (location && location !== "null") {
      whereClause += " AND location = :location";
    }

    // SQL Query to get top-selling products based on quantity sold
    const query = `
            SELECT TOP (:productLimit)
              itemname,
              SUM(CAST(quantity AS DECIMAL(18, 2))) AS total_quantity_sold,
              SUM(CAST(price AS DECIMAL(18, 2)) * CAST(quantity AS DECIMAL(18, 2))) AS total_revenue
            FROM [MoodLagos].[dbo].[casierPending]
            ${whereClause}
            GROUP BY itemname
            ORDER BY total_quantity_sold DESC
          `;

    // Build the replacements object dynamically
    const replacements = { productLimit };
    if (month && month !== "null") replacements.month = month; // Add month only if it's provided
    if (year && year !== "null") replacements.year = year; // Add year only if it's provided
    if (location && location !== "null") replacements.location = location; // Add location only if it's provided

    const topSellingProducts = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements,
    });

    // Send the response back with the top-selling products
    res.status(200).json({ topSellingProducts });
  } catch (error) {
    console.error("Error fetching top-selling products:", error);
    res.status(500).json({
      message: "Error fetching top-selling products",
      error: error.message,
    });
  }
};
const getSalesPerLocation = async (req, res) => {
  try {
    const { month, year } = req.query;

    let whereClause = "WHERE status = 'Served' AND finalstatus = 'Completed'";

    if (year && year !== "null") {
      whereClause += " AND YEAR(completedtime) = CAST(:year AS INT)";
    }

    if (month && month !== "null") {
      whereClause += " AND MONTH(completedtime) = CAST(:month AS INT)";
    }

    const query = `
      SELECT 
        location,
        itemname,
        completedtime,
        SUM(CAST(quantity AS DECIMAL(18, 2))) AS total_quantity,
        SUM(CAST(price AS DECIMAL(18, 2)) * CAST(quantity AS DECIMAL(18, 2))) AS total_revenue
      FROM [MoodLagos].[dbo].[casierPending]
      ${whereClause}
      GROUP BY 
        location, itemname, completedtime
    `;

    const replacements = {};
    if (month && month !== "null") replacements.month = month;
    if (year && year !== "null") replacements.year = year;

    const salesData = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements,
    });

    const structuredData = salesData.reduce((acc, curr) => {
      const loc = curr.location?.toUpperCase();

      // Categorize into Kitchen, Bar, Shisha, or Other
      const locationKey =
        loc === "KITCHEN" || loc === "BAR" || loc === "SHISHA" ? loc : "Other";

      if (!acc[locationKey]) {
        acc[locationKey] = {
          total_quantity: 0,
          total_revenue: 0,
          items: [],
        };
      }

      // Aggregate quantities and revenues
      acc[locationKey].total_quantity += parseFloat(curr.total_quantity);
      acc[locationKey].total_revenue += parseFloat(curr.total_revenue);

      // Add item details
      acc[locationKey].items.push({
        itemname: curr.itemname,
        quantity: parseFloat(curr.total_quantity),
        revenue: parseFloat(curr.total_revenue),
        completedtime: curr.completedtime,
      });

      return acc;
    }, {});

    // Send the structured sales data as the response
    res.status(200).json({ salesData: structuredData });
  } catch (error) {
    console.error("Error fetching sales per location:", error);
    res.status(500).json({
      message: "Error fetching sales per location",
      error: error.message,
    });
  }
};

const getTotalLogsByTime = async (req, res) => {
  try {
    const { startMonth, endMonth, year } = req.query;

    // Start with the base where clause to filter by completed status
    let whereClause = "WHERE finalstatus = 'Completed'";

    // Append year filter to the where clause if provided
    if (year && year !== "null") {
      whereClause += " AND YEAR(completedtime) = CAST(:year AS INT)";
    }

    // Append month or range filter to the where clause
    if (
      startMonth &&
      endMonth &&
      startMonth !== "null" &&
      endMonth !== "null"
    ) {
      if (startMonth === endMonth) {
        // If the start and end months are the same, query for just that month
        whereClause += " AND MONTH(completedtime) = CAST(:startMonth AS INT)";
      } else {
        // Query for a range of months
        whereClause +=
          " AND MONTH(completedtime) BETWEEN CAST(:startMonth AS INT) AND CAST(:endMonth AS INT)";
      }
    }

    // SQL Query to get total quantity, revenue, and month of items sold within the specified time
    const query = `
        SELECT 
          itemname,
          SUM(CAST(quantity AS DECIMAL(18, 2))) AS total_quantity,
          -- Calculate total revenue with discount applied if productDiscount is not null
          SUM(
            CASE 
              WHEN productDiscount IS NOT NULL 
              THEN (CAST(price AS DECIMAL(18, 2)) * CAST(quantity AS DECIMAL(18, 2))) * (1 - (CAST(productDiscount AS DECIMAL(18, 2)) / 100)) 
              ELSE (CAST(price AS DECIMAL(18, 2)) * CAST(quantity AS DECIMAL(18, 2))) 
            END
          ) AS total_revenue,
          MONTH(completedtime) AS month_sold
        FROM [MoodLagos].[dbo].[casierPending]
        ${whereClause}
        GROUP BY itemname, MONTH(completedtime)
        ORDER BY total_revenue DESC
      `;

    // Replacements object for the query to handle dynamic month and year
    const replacements = {};
    if (startMonth && startMonth !== "null")
      replacements.startMonth = startMonth;
    if (endMonth && endMonth !== "null") replacements.endMonth = endMonth;
    if (year && year !== "null") replacements.year = year;

    // Execute the query to get the data
    const salesData = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements,
    });

    // Send the sales data as the response
    res.status(200).json({
      message: "Total logs of items sold",
      data: salesData,
    });
  } catch (error) {
    console.error("Error fetching total logs:", error);
    res.status(500).json({
      message: "Error fetching total logs",
      error: error.message,
    });
  }
};

const getTotalOrderLogsByTime = async (req, res) => {
  try {
    const { startMonth, endMonth, year } = req.query;

    // Base where clause to filter completed orders
    let whereClause = "WHERE sales.finalstatus = 'Completed'";

    // Append year filter to the where clause if provided
    if (year && year !== "null") {
      whereClause += " AND YEAR(completed.date) = CAST(:year AS INT)";
    }

    // Append month or range filter to the where clause
    if (
      startMonth &&
      endMonth &&
      startMonth !== "null" &&
      endMonth !== "null"
    ) {
      if (startMonth === endMonth) {
        // If the start and end months are the same, query for that specific month
        whereClause += " AND MONTH(completed.date) = CAST(:startMonth AS INT)";
      } else {
        // Query for a range of months
        whereClause +=
          " AND MONTH(completed.date) BETWEEN CAST(:startMonth AS INT) AND CAST(:endMonth AS INT)";
      }
    }

    // SQL Query to get all completed sales and join with sales transactions
    const query = `
      SELECT 
        completed.orderid,
        completed.paymentType,
        completed.subtotal,
        completed.vat,
        completed.orderdiscount,
        completed.date,
        completed.total,
        completed.delivery,
        sales.sid,
        sales.itemname,
        sales.username,
        sales.quantity,
        sales.price,
        sales.category,
        sales.[table]
        ,sales.[specialdiscountvalue]
        ,sales.[specialdiscountstatus]
        ,sales.[specialdiscountreason]
        ,sales.[specialdiscountapprovedby]
        ,sales.[specialdiscountapplied]
        ,sales.[tablechangeinfo]
        ,sales.[mergeorderid]
        ,sales.[mergestatus]
        ,sales.[mergedby]
	  ,[productDiscount]
      FROM [MoodLagos].[dbo].[CompletedSales] AS completed
      INNER JOIN [MoodLagos].[dbo].[casierPending] AS sales
        ON completed.orderid = sales.orderid
      ${whereClause}
      ORDER BY completed.orderid
      OFFSET 0 ROWS FETCH NEXT 1000 ROWS ONLY
    `;

    // Replacements object for the query to handle dynamic month and year
    const replacements = {};
    if (startMonth && startMonth !== "null")
      replacements.startMonth = startMonth;
    if (endMonth && endMonth !== "null") replacements.endMonth = endMonth;
    if (year && year !== "null") replacements.year = year;

    // Execute the query to get the data
    const salesData = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements,
    });

    // Send the sales data as the response
    res.status(200).json({
      message: "Total logs of items sold with orders and items grouped",
      data: salesData,
    });
  } catch (error) {
    console.error("Error fetching total logs:", error);
    res.status(500).json({
      message: "Error fetching total logs",
      error: error.message,
    });
  }
};

const getReportData = async (req, res) => {
  try {
    // Get the current year and month
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed

    // Determine last month and adjust the year if needed
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    // Total Orders this month (count distinct orderid)
    const totalOrdersQuery = `
        SELECT COUNT(DISTINCT orderid) AS total_orders
        FROM [MoodLagos].[dbo].[casierPending]
        WHERE createdDate >= :startDate AND createdDate < :endDate AND finalstatus = 'Completed'
      `;

    // Average Service Time (in minutes) this month
    const avgServiceTimeThisMonthQuery = `
        SELECT AVG(DATEDIFF(MINUTE, createdDate, completedtime)) AS avg_service_time_this_month
        FROM [MoodLagos].[dbo].[casierPending]
        WHERE createdDate >= :startDate AND createdDate < :endDate AND finalstatus = 'Completed'
      `;

    // Average Service Time (in minutes) last month
    const avgServiceTimeLastMonthQuery = `
        SELECT AVG(DATEDIFF(MINUTE, createdDate, completedtime)) AS avg_service_time_last_month
        FROM [MoodLagos].[dbo].[casierPending]
        WHERE createdDate >= :lastMonthStartDate AND createdDate < :lastMonthEndDate AND finalstatus = 'Completed'
      `;

    // Employee of the last month (based on highest sales)
    const employeeOfLastMonthQuery = `
        SELECT TOP 1 username, 
               SUM(CAST(price AS DECIMAL(18,2)) * CAST(quantity AS DECIMAL(18,2))) AS total_sales
        FROM [MoodLagos].[dbo].[casierPending]
        WHERE createdDate >= :lastMonthStartDate AND createdDate < :lastMonthEndDate AND finalstatus = 'Completed'
        GROUP BY username
        ORDER BY total_sales DESC
      `;

    // Define the date ranges
    const startDate = new Date(currentYear, currentMonth - 1, 1); // Start of current month
    const endDate = new Date(currentYear, currentMonth, 1); // Start of next month
    const lastMonthStartDate = new Date(lastMonthYear, lastMonth - 1, 1); // Start of last month
    const lastMonthEndDate = new Date(lastMonthYear, lastMonth, 1); // Start of this month

    // Adjusting last month end date to the end of last month
    lastMonthEndDate.setDate(0); // Set to last day of last month

    // Execute the queries
    const totalOrdersResult = await sequelize.query(totalOrdersQuery, {
      type: QueryTypes.SELECT,
      replacements: { startDate, endDate },
    });

    const avgServiceTimeThisMonthResult = await sequelize.query(
      avgServiceTimeThisMonthQuery,
      {
        type: QueryTypes.SELECT,
        replacements: { startDate, endDate },
      }
    );

    const avgServiceTimeLastMonthResult = await sequelize.query(
      avgServiceTimeLastMonthQuery,
      {
        type: QueryTypes.SELECT,
        replacements: {
          lastMonthStartDate,
          lastMonthEndDate,
        },
      }
    );

    const employeeOfLastMonthResult = await sequelize.query(
      employeeOfLastMonthQuery,
      {
        type: QueryTypes.SELECT,
        replacements: {
          lastMonthStartDate: startDate,
          lastMonthEndDate: endDate,
        },
      }
    );

    // Prepare the response data
    res.status(200).json({
      totalOrders: totalOrdersResult[0]?.total_orders || 0,
      avgServiceTimeThisMonth:
        avgServiceTimeThisMonthResult[0]?.avg_service_time_this_month || 0,
      avgServiceTimeLastMonth:
        avgServiceTimeLastMonthResult[0]?.avg_service_time_last_month || 0,
      employeeOfLastMonth: employeeOfLastMonthResult[0]?.username || "No data",
    });
  } catch (error) {
    console.error("Error fetching report data:", error);
    res.status(500).json({
      message: "Error fetching report data",
      error: error.message,
    });
  }
};

const fetchRevenueByPaymentType = async (req, res) => {
  try {
    // Base query to get total revenue grouped by payment type for the current month
    const revenueBaseQuery = `
      SELECT 
          paymentType,
          SUM(CAST(total AS DECIMAL(18, 2))) AS total_revenue
      FROM 
          [MoodLagos].[dbo].[CompletedSales]
      WHERE 
          MONTH(date) = MONTH(GETDATE()) 
          AND YEAR(date) = YEAR(GETDATE())
      GROUP BY 
          paymentType
    `;

    // Execute the base query
    const revenueData = await sequelize.query(revenueBaseQuery, {
      type: QueryTypes.SELECT,
    });

    console.log(revenueData);

    // Initialize totals
    let CASHTOTAL = 0;
    let MONIEPOINTTOTAL = 0;
    let PAYFORCETOTAL = 0;
    let othersTotal = 0;

    // Iterate through revenue data to sum totals based on payment type
    revenueData.forEach((item) => {
      switch (item.paymentType?.toUpperCase()) {
        case "CASH":
          CASHTOTAL += Number(item.total_revenue);
          break;
        case "MONIEPOINT":
          MONIEPOINTTOTAL += Number(item.total_revenue);
          break;
        case "PAYFORCE":
          PAYFORCETOTAL += Number(item.total_revenue);
          break;
        default:
          othersTotal += Number(item.total_revenue);
          break;
      }
    });

    // Send the response with totals
    res.status(200).json({
      CASHTOTAL,
      MONIEPOINTTOTAL,
      PAYFORCETOTAL,
      othersTotal,
    });
  } catch (error) {
    console.error("Error fetching revenue by payment type:", error);
    res.status(500).json({
      message: "Failed to fetch revenue data",
      error: error.message,
    });
  }
};

const getTotalPaymentsByMonth = async (req, res) => {
  try {
    const { startMonth, endMonth, year } = req.query;

    // Start with the base where clause to filter by completed status
    let whereClause = "WHERE total is not NULL";

    // Append year filter to the where clause if provided
    if (year && year !== "null") {
      whereClause += " AND YEAR(date) = CAST(:year AS INT)";
    }

    // Append month or range filter to the where clause
    if (
      startMonth &&
      endMonth &&
      startMonth !== "null" &&
      endMonth !== "null"
    ) {
      if (startMonth === endMonth) {
        // If the start and end months are the same, query for just that month
        whereClause += " AND MONTH(date) = CAST(:startMonth AS INT)";
      } else {
        // Query for a range of months
        whereClause +=
          " AND MONTH(date) BETWEEN CAST(:startMonth AS INT) AND CAST(:endMonth AS INT)";
      }
    }

    // SQL Query to get total payments for each payment type per month
    const query = `
        SELECT 
          paymentType,
          SUM(CAST(total AS DECIMAL(18, 2))) AS total_payment,
          MONTH(date) AS month,
          YEAR(date) AS year
        FROM [MoodLagos].[dbo].[CompletedSales]
        ${whereClause}
        GROUP BY paymentType, MONTH(date), YEAR(date)
        ORDER BY MONTH(date)
      `;

    // Replacements object for the query to handle dynamic month and year
    const replacements = {};
    if (startMonth && startMonth !== "null")
      replacements.startMonth = startMonth;
    if (endMonth && endMonth !== "null") replacements.endMonth = endMonth;
    if (year && year !== "null") replacements.year = year;

    // Execute the query to get the data
    const paymentData = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements,
    });

    // Send the payment data as the response
    res.status(200).json({
      message: "Total payments by month",
      data: paymentData,
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({
      message: "Error fetching payments",
      error: error.message,
    });
  }
};

const getSalesReportByDateRange = async (req, res) => {
  try {
    const { selectedDate } = req.params;

    // Parse selectedDate as a date object to verify its validity
    const parsedDate = new Date(selectedDate);
    if (isNaN(parsedDate.getTime())) {
      throw new Error("Invalid selectedDate format");
    }

    // Define start and end times
    const startDateTime = new Date(parsedDate);
    startDateTime.setDate(startDateTime.getDate() );

    startDateTime.setHours(12, 0, 0); // 12 PM on the selected date

    const endDateTime = new Date(parsedDate);
    endDateTime.setDate(endDateTime.getDate() + 1);
    endDateTime.setHours(10, 0, 0); // 10 AM the next day

    // Format for SQL compatibility and to ensure UTC alignment
    const startDateString = startDateTime
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    const endDateString = endDateTime
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    console.log("Start Date:", startDateString);
    console.log("End Date:", endDateString);

    // Update salesQuery to include only completed statuses
    const salesQuery = `
      SELECT 
        itemname,
        SUM(CAST(quantity AS INT)) AS total_quantity,
        SUM(CAST(price AS DECIMAL(18, 2)) * CAST(quantity AS INT)) AS total_revenue
      FROM [MoodLagos].[dbo].[casierPending]
      WHERE 
        CONVERT(DATETIME, completedtime, 120) BETWEEN :startDateString AND :endDateString
        AND cashierStatus = 'Complete'
      GROUP BY itemname
    `;

    const salesData = await sequelize.query(salesQuery, {
      type: QueryTypes.SELECT,
      replacements: { startDateString, endDateString },
    });

    const subcategoryQuery = `
      SELECT 
        pc.productSubcategory AS subcategory,
        SUM(CAST(cp.quantity AS INT)) AS total_quantity_sold,
        SUM(CAST(cp.price AS DECIMAL(18, 2)) * CAST(cp.quantity AS INT)) AS total_revenue
      FROM [MoodLagos].[dbo].[casierPending] AS cp
      JOIN [MoodLagos].[dbo].[productCreation_table] AS pc
      ON cp.itemname = pc.productName
      WHERE 
        CONVERT(DATETIME, cp.completedtime, 120) BETWEEN :startDateString AND :endDateString
        AND cp.cashierStatus = 'Complete'
      GROUP BY pc.productSubcategory
    `;

    const subcategoryData = await sequelize.query(subcategoryQuery, {
      type: QueryTypes.SELECT,
      replacements: { startDateString, endDateString },
    });

    const totalQuantity = subcategoryData.reduce(
      (sum, item) => sum + item.total_quantity_sold,
      0
    );
    const subcategoryReport = subcategoryData.map((subcategory) => ({
      ...subcategory,
      percentage: (
        (subcategory.total_quantity_sold / totalQuantity) *
        100
      ).toFixed(2),
    }));

    res.status(200).json({
      message: "Sales report by date range",
      itemsSoldReport: salesData,
      subcategorySalesReport: subcategoryReport,
    });
  } catch (error) {
    console.error("Error fetching sales report:", error);
    res.status(500).json({
      message: "Error fetching sales report",
      error: error.message,
    });
  }
};

const getCashierSalesReportByDateRange = async (req, res) => {
  try {
    const { selectedDate } = req.params;

    // // Parse selectedDate as a date object to verify its validity
    // const parsedDate = new Date(selectedDate);
    // if (isNaN(parsedDate.getTime())) {
    //   throw new Error("Invalid selectedDate format");
    // }

    // // Define start and end times
    // const startDateTime = new Date(parsedDate);
    // startDateTime.setDate(startDateTime.getDate() - 1);
    // startDateTime.setHours(12, 0, 0); // 12 PM on the selected date

    // const endDateTime = new Date(parsedDate);
    // endDateTime.setHours(10, 0, 0); // 10 AM the next day

    // const startDateString = startDateTime
    //   .toISOString()
    //   .slice(0, 19)
    //   .replace("T", " ");
    // const endDateString = endDateTime
    //   .toISOString()
    //   .slice(0, 19)
    //   .replace("T", " ");


    const parsedDate = new Date(selectedDate);
    if (isNaN(parsedDate.getTime())) {
      throw new Error("Invalid selectedDate format");
    }

    // Define start and end times
    const startDateTime = new Date(parsedDate);
    startDateTime.setDate(startDateTime.getDate() );

    startDateTime.setHours(12, 0, 0); // 12 PM on the selected date

    const endDateTime = new Date(parsedDate);
    endDateTime.setDate(endDateTime.getDate() + 1);
    endDateTime.setHours(10, 0, 0); // 10 AM the next day

    // Format for SQL compatibility and to ensure UTC alignment
    const startDateString = startDateTime
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    const endDateString = endDateTime
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

      const salesReportQuery = `
      SELECT 
        cs.paymentType,
        SUM(TRY_CAST(cs.subtotal AS DECIMAL(18, 2))) AS total_subtotal,
        SUM(TRY_CAST(cs.vat AS DECIMAL(18, 2))) AS total_vat,
        SUM(TRY_CAST(cs.orderdiscount AS DECIMAL(18, 2))) AS total_discount,
        SUM(TRY_CAST(cs.delivery AS DECIMAL(18, 2))) AS total_delivery,
        SUM(TRY_CAST(cs.total AS DECIMAL(18, 2))) AS grand_total
      FROM 
        [MoodLagos].[dbo].[CompletedSales] cs
      INNER JOIN 
        (SELECT DISTINCT orderid FROM [MoodLagos].[dbo].[casierPending] WHERE cashierStatus = 'Complete') cp
        ON cs.orderid = cp.orderid
      WHERE 
        CONVERT(DATETIME, cs.[date], 120) BETWEEN :startDateString AND :endDateString
      GROUP BY 
        cs.paymentType
    `;
    

    const salesData = await sequelize.query(salesReportQuery, {
      type: QueryTypes.SELECT,
      replacements: { startDateString, endDateString },
    });

    // Calculate accumulations
    const totals = salesData.reduce(
      (acc, sale) => {
        const discount =
          sale.total_subtotal + sale.total_vat - sale.grand_total;
        acc.totalDiscount += discount;
        acc.totalSubtotal += sale.total_subtotal;
        acc.totalVAT += sale.total_vat;
        acc.totalSales += sale.grand_total;

        // Track payment type totals
        acc.paymentTypeTotals[sale.paymentType] =
          (acc.paymentTypeTotals[sale.paymentType] || 0) + sale.grand_total;

        // Track delivery totals
        if (sale.total_delivery) {
          acc.totalDelivery += sale.total_delivery;
          acc.totalNonNullDelivery += sale.grand_total;
        }

        return acc;
      },
      {
        totalDiscount: 0,
        totalSubtotal: 0,
        totalVAT: 0,
        totalSales: 0,
        paymentTypeTotals: {},
        totalDelivery: 0,
        totalNonNullDelivery: 0,
      }
    );

    // Calculate payment type percentages
    const paymentTypePercentages = Object.keys(totals.paymentTypeTotals).map(
      (type) => ({
        paymentType: type,
        total: totals.paymentTypeTotals[type],
        percentage: (
          (totals.paymentTypeTotals[type] / totals.totalSales) *
          100
        ).toFixed(2),
      })
    );

    // Query to join with casierPending table for employee-specific sales totals
    const employeeSalesQuery = `
    SELECT 
      cp.username AS employee,
      SUM(TRY_CAST(cs.subtotal AS DECIMAL(18, 2))) AS total_sales
    FROM 
      [MoodLagos].[dbo].[CompletedSales] AS cs
    JOIN 
      (SELECT DISTINCT orderid, username FROM [MoodLagos].[dbo].[casierPending] WHERE cashierStatus = 'Complete') cp
      ON cs.orderid = cp.orderid
    WHERE 
      CONVERT(DATETIME, cs.[date], 120) BETWEEN :startDateString AND :endDateString
    GROUP BY 
      cp.username
  `;
  

    const employeeSales = await sequelize.query(employeeSalesQuery, {
      type: QueryTypes.SELECT,
      replacements: { startDateString, endDateString },
    });

    // Respond with calculated results
    res.status(200).json({
      message: "Detailed sales report by date range",
      totals: {
        totalDiscount: totals.totalDiscount.toFixed(2),
        totalSubtotal: totals.totalSubtotal.toFixed(2),
        totalVAT: totals.totalVAT.toFixed(2),
        totalSales: totals.totalSales.toFixed(2),
        totalDelivery: totals.totalDelivery.toFixed(2),
        totalNonNullDelivery: totals.totalNonNullDelivery.toFixed(2),
      },
      paymentTypeSummary: paymentTypePercentages,
      employeeSales,
    });
  } catch (error) {
    console.error("Error fetching detailed sales report:", error);
    res.status(500).json({
      message: "Error fetching detailed sales report",
      error: error.message,
    });
  }
};

module.exports = {
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
  getTotalOrderLogsByTime,
  fetchRevenueByPaymentType,
  getTotalPaymentsByMonth,
  getSalesReportByDateRange,
  getCashierSalesReportByDateRange,
};
