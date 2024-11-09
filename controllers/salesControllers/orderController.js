const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../models/index");
const jwt = require("jsonwebtoken");

const placeOrder = async (req, res) => {
  const transactions = req.body;

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res
      .status(400)
      .json({ message: "Transaction data is required and must be an array" });
  }

  for (const transaction of transactions) {
    const {
      orderid,
      itemname,
      username,
      quantity,
      price,
      category,
      location,
      status,
      itemorderid,
      table,
      note,
    } = transaction;
    if (
      !orderid ||
      !itemname ||
      !username ||
      !quantity ||
      !price ||
      !category ||
      !location ||
      !status ||
      !itemorderid ||
      !table
    ) {
      return res
        .status(400)
        .json({ message: "All fields are required for each transaction" });
    }
  }

  try {
    const transaction = await sequelize.transaction();

    // Insert transactions into the salesTransaction_table
    for (const transactionData of transactions) {
      const isSpaceLocation =
        transactionData.location.toUpperCase() === "SPACE";
      const additionalColumns = isSpaceLocation
        ? ", [servedtime], [acceptorrejecttime]"
        : "";
      const additionalValues = isSpaceLocation ? ", GETDATE(), GETDATE()" : "";

      await sequelize.query(
        `INSERT INTO [MoodLagos].[dbo].[salesTransaction_table] 
        ([orderid], [itemname], [username], [quantity], [price], [category], [location], [status], [createdDate], [itemorderid], [table], [productDiscount], [note]${additionalColumns})
        VALUES (:orderid, :itemname, :username, :quantity, :price, :category, :location, :status, GETDATE(), :itemorderid, :table, :productDiscount, :note${additionalValues})`,
        {
          type: QueryTypes.INSERT,
          replacements: {
            orderid: transactionData.orderid,
            itemname: transactionData.itemname,
            username: transactionData.username,
            quantity: transactionData.quantity,
            price: transactionData.price,
            category: transactionData.category,
            location: transactionData.location,
            status: isSpaceLocation ? "Served" : transactionData.status,
            itemorderid: transactionData.itemorderid,
            table: transactionData.table,
            productDiscount: transactionData.productDiscount,
            note: transactionData?.note,
          },
          transaction,
        }
      );
    }

    // Determine unique locations in the transactions to create notifications
    const uniqueLocations = [...new Set(transactions.map((t) => t.location))];

    // Create notifications for distinct locations
    for (const location of uniqueLocations) {
      if (["kitchen", "shisha", "bar"].includes(location.toLowerCase())) {
        await sequelize.query(
          `INSERT INTO [MoodLagos].[dbo].[notifications] 
          ([username], [location], [notification], [isread])
          VALUES (NULL, :location, :notification, 0)`, // isread is set to false by default (0)
          {
            type: QueryTypes.INSERT,
            replacements: {
              location: location,
              notification: `New order placed for ${location} `,
            },
            transaction,
          }
        );
      }
    }

    // Commit the transaction
    await transaction.commit();

    res.status(201).json({
      message: "Sales transactions and notifications inserted successfully",
    });
  } catch (error) {
    console.error(
      "Error inserting sales transactions and notifications:",
      error
    );

    if (transaction) {
      await transaction.rollback();
    }
    res.status(500).json({
      message: "Failed to insert sales transactions and notifications",
      error: error.message,
    });
  }
};

const updateExistingOrder = async (req, res) => {
  const transactions = req.body;

  // Check if transactions are provided and are an array
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res
      .status(400)
      .json({ message: "Transaction data is required and must be an array" });
  }

  // Ensure all fields are present in each transaction
  for (const transaction of transactions) {
    const {
      orderid,
      itemname,
      username,
      quantity,
      price,
      category,
      location,
      status,
      itemorderid,
      table,
    } = transaction;

    console.log({
      orderid,
      itemname,
      username,
      quantity,
      price,
      category,
      location,
      status,
      itemorderid,
      table,
    });

    // Check for missing fields
    if (
      !orderid ||
      !itemname ||
      !username ||
      !quantity ||
      !price ||
      !category ||
      !location ||
      !status ||
      !itemorderid ||
      !table
    ) {
      return res.status(400).json({
        message:
          "All fields are required for each transaction, including the table",
      });
    }
  }

  let transaction;

  try {
    transaction = await sequelize.transaction();

    for (const transactionData of transactions) {
      const { orderid, itemname, quantity, status, table } = transactionData;

      // Query for existing items with matching orderid and itemname
      const existingItems = await sequelize.query(
        `SELECT * FROM [MoodLagos].[dbo].[salesTransaction_table] 
         WHERE [orderid] = :orderid AND [itemname] = :itemname`,
        {
          type: QueryTypes.SELECT,
          replacements: {
            orderid,
            itemname,
          },
          transaction,
        }
      );

      // Skip any items with a rejected status
      const rejectedItem = existingItems.find(
        (item) => item.status === "Rejected" || item.status === "REJECTED"
      );

      if (rejectedItem) {
        continue;
      }

      // Calculate total existing quantity of the items
      const totalExistingQuantity = existingItems.reduce(
        (acc, item) => acc + parseInt(item.quantity),
        0
      );

      const newQuantity = quantity - totalExistingQuantity;

      if (newQuantity <= 0) {
        continue;
      }

      // Insert new transaction with updated quantity
      await sequelize.query(
        `INSERT INTO [MoodLagos].[dbo].[salesTransaction_table] 
        ([orderid], [itemname], [username], [quantity], [price], [category], [location], [status], [createdDate], [updated], [itemorderid], [table])
        VALUES (:orderid, :itemname, :username, :quantity, :price, :category, :location, :status, GETDATE(), :updated, :itemorderid, :table)`,
        {
          type: QueryTypes.INSERT,
          replacements: {
            orderid: transactionData.orderid,
            itemname: transactionData.itemname,
            username: transactionData.username,
            quantity: newQuantity,
            price: transactionData.price,
            category: transactionData.category,
            location: transactionData.location,
            status: transactionData.status,
            itemorderid: transactionData.itemorderid,
            updated: true,
            table: transactionData.table, // Ensure table is included
          },
          transaction,
        }
      );

      // Create notification for the updated order
      await sequelize.query(
        `INSERT INTO [MoodLagos].[dbo].[notifications]
        ([username], [location], [notification], [isread])
        VALUES (NULL, :location, :notification, 0)`, // isread is set to false by default (0)
        {
          type: QueryTypes.INSERT,
          replacements: {
            location: transactionData.location,
            notification: `Order ${orderid} (${table}) has been updated.`,
          },
          transaction,
        }
      );
    }

    // Commit the transaction after processing all rows
    await transaction.commit();

    res.status(201).json({
      message:
        "Sales transactions inserted/updated successfully and notifications created",
    });
  } catch (error) {
    console.error("Error inserting/updating sales transactions:", error);

    if (transaction) {
      await transaction.rollback();
    }
    res.status(500).json({
      message: "Failed to insert/update sales transactions",
      error: error.message,
    });
  }
};

const insertIntoCasierPending = async (req, res) => {
  const { orderid } = req.body;

  if (!orderid) {
    return res.status(400).json({ message: "orderid is required in the body" });
  }

  // Decrypt the JWT to get the username
  const token = req.headers.authorization.split(" ")[1];
  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_KEY);
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }

  const actionUsername = decoded.username;
  const currentDate = new Date().toISOString(); // Get current date in ISO format

  try {
    // Search for all items in salesTransaction_table with the same orderid
    const existingTransactions = await sequelize.query(
      `SELECT *
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [orderid] = :orderid`,
      {
        type: QueryTypes.SELECT,
        replacements: { orderid },
      }
    );

    if (!existingTransactions || existingTransactions.length === 0) {
      return res.status(404).json({ message: "Transactions not found" });
    }

    // Insert each transaction found into casierPending table
    for (const transactionData of existingTransactions) {
      console.log(transactionData);

      await sequelize.query(
        `INSERT INTO [MoodLagos].[dbo].[casierPending] 
        (
          [orderid], [itemname], [username], [actionusername], [servedtime], [acceptorrejecttime], [quantity], [price], [table], [updated], 
          [category], [itemorderid], [location], [rejectionreason], [finalstatus], [status], [completedtime], [createdDate], [sentby], [sentdate], [productDiscount],[tablechangeinfo],[mergeorderid],[mergestatus],[mergedby]
        ) 
        VALUES 
        (
          :orderid, :itemname, :username, :actionusername, :servedtime, :acceptorrejecttime, :quantity, :price, :table, :updated, 
          :category, :itemorderid, :location, :rejectionreason, :finalstatus, :status, :completedtime, :createdDate, :sentby, :sentdate, :productDiscount, :tablechangeinfo, :mergeorderid, :mergestatus, :mergedby
        )`,
        {
          type: QueryTypes.INSERT,
          replacements: {
            orderid: transactionData.orderid,
            itemname: transactionData.itemname,
            username: transactionData.username,
            actionusername: actionUsername,
            servedtime: transactionData.servedtime,
            acceptorrejecttime: transactionData.acceptorrejecttime,
            quantity: transactionData.quantity,
            price: transactionData.price,
            table: transactionData.table,
            updated: transactionData.updated,
            category: transactionData.category,
            itemorderid: transactionData.itemorderid,
            location: transactionData.location,
            rejectionreason: transactionData.rejectionreason,
            finalstatus: "completed",
            status: transactionData.status,
            completedtime: currentDate,
            createdDate: transactionData.createdDate,
            sentby: actionUsername,
            sentdate: currentDate,
            productDiscount: transactionData.productDiscount,
            tablechangeinfo: transactionData.tablechangeinfo,
            mergeorderid: transactionData.mergeorderid,
            mergestatus: transactionData.mergestatus,
            mergedby: transactionData.mergedby,
          },
        }
      );
    }

    // Update finalstatus and completedtime to "completed" and current date in salesTransaction_table
    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
       SET finalstatus = 'completed', completedtime = :completedtime
       WHERE orderid = :orderid`,
      {
        type: QueryTypes.UPDATE,
        replacements: { orderid, completedtime: currentDate },
      }
    );

    // Update finalstatus and completedtime to "completed" and current date in casierPending table
    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[casierPending]
       SET finalstatus = 'completed', completedtime = :completedtime
       WHERE orderid = :orderid`,
      {
        type: QueryTypes.UPDATE,
        replacements: { orderid, completedtime: currentDate },
      }
    );

    // Create a notification
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[notifications] (username, location, notification, isread)
       VALUES (NULL, 'cashier', :notification, 0)`,
      {
        type: QueryTypes.INSERT,
        replacements: {
          notification: `${actionUsername} just sent a new order to the cashier from ${existingTransactions[0].table}`, // Use the [table] FROM the first transaction
        },
      }
    );

    return res.status(201).json({
      message:
        "Transactions inserted into casierPending successfully and status updated to 'completed'.",
      count: existingTransactions.length,
    });
  } catch (error) {
    console.error(
      "Error inserting into casierPending or updating status:",
      error
    );
    return res.status(500).json({
      message: "Failed to insert transactions or update status",
      error: error.message,
    });
  }
};

const getCasierPendingData = async (req, res) => {
  const { orderid, username } = req.query; // Optional filters

  try {
    let query = `
      SELECT cp.*, p.*
      FROM [MoodLagos].[dbo].[casierPending] cp
      JOIN [MoodLagos].[dbo].[productCreation_table] p
        ON cp.itemname = p.productName
      WHERE 1=1 and cashierStatus is NULL
    `;

    const replacements = {};

    // Add filters based on query parameters
    if (orderid) {
      query += ` AND cp.orderid = :orderid`;
      replacements.orderid = orderid;
    }

    if (username) {
      query += ` AND cp.username = :username`;
      replacements.username = username;
    }

    // Execute the query
    const casierPendingData = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements,
    });

    // Check if any data is found
    if (casierPendingData.length === 0) {
      return res.status(404).json({ message: "No records found." });
    }

    return res.status(200).json({
      message: "Data retrieved successfully",
      data: casierPendingData,
    });
  } catch (error) {
    console.error("Error fetching data from casierPending:", error);
    return res.status(500).json({
      message: "Failed to retrieve data",
      error: error.message,
    });
  }
};

const getCasierPendingDiscountApproval = async (req, res) => {
  const { orderid, username } = req.query; // Optional filters
  try {
    let query = `
      SELECT cp.*, p.*
      FROM [MoodLagos].[dbo].[casierPending] cp
      JOIN [MoodLagos].[dbo].[productCreation_table] p
        ON cp.itemname = p.productName
      WHERE 1=1 and cashierStatus is NULL and specialdiscountstatus = 'PENDING'
    `;

    const replacements = {};

    // Add filters based on query parameters
    if (orderid) {
      query += ` AND cp.orderid = :orderid`;
      replacements.orderid = orderid;
    }

    if (username) {
      query += ` AND cp.username = :username`;
      replacements.username = username;
    }

    // Execute the query
    const casierPendingData = await sequelize.query(query, {
      type: QueryTypes.SELECT,
      replacements,
    });

    // Check if any data is found
    if (casierPendingData.length === 0) {
      return res.status(404).json({ message: "No records found." });
    }

    return res.status(200).json({
      message: "Data retrieved successfully",
      data: casierPendingData,
    });
  } catch (error) {
    console.error("Error fetching data from casierPending:", error);
    return res.status(500).json({
      message: "Failed to retrieve data",
      error: error.message,
    });
  }
};

const getStaffSalesTransactionsByStatus = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // Assuming 'Bearer token'

  if (!token) {
    return res.status(401).json({ message: "Authorization token is required" });
  }

  try {
    // Decode the token to get the username
    const decoded = jwt.verify(token, process.env.JWT_KEY); // Replace with your actual secret
    const username = decoded.username; // Assuming the token contains 'username'

    // Count queries for each status with username filter and mergestatus = NULL
    const pendingCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Pending' 
       AND (finalstatus <> 'Completed' OR finalstatus IS NULL)
       AND [username] = :username
       AND mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    const inProgressCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'In Progress' 
       AND (finalstatus <> 'Completed' OR finalstatus IS NULL)
       AND [username] = :username
       AND mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    const servedCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Served' 
       AND (finalstatus <> 'Completed' OR finalstatus IS NULL)
       AND [username] = :username
       AND mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    const rejectedCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Rejected' 
       AND (finalstatus <> 'Completed' OR finalstatus IS NULL)
       AND [username] = :username
       AND mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    // Query to get all data filtered by username and mergestatus = NULL
    const allData = await sequelize.query(
      `SELECT st.*, pc.productName, pc.productCategory, pc.productSubcategory, 
              pc.location AS productLocation, pc.productPrice, pc.productImage, pc.discountrate
       FROM [MoodLagos].[dbo].[salesTransaction_table] st
       JOIN [MoodLagos].[dbo].[productCreation_table] pc
       ON st.itemname = pc.productName
       WHERE (st.finalstatus <> 'Completed' OR st.finalstatus IS NULL)
       AND st.username = :username
       AND st.mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    // Return the counts and detailed data
    res.status(200).json({
      pending: pendingCount[0].count,
      inProgress: inProgressCount[0].count,
      served: servedCount[0].count,
      rejected: rejectedCount[0].count,
      allData,
    });
  } catch (error) {
    console.error("Error retrieving sales transaction counts:", error);
    res.status(500).json({
      message: "Failed to retrieve sales transaction counts",
      error: error.message,
    });
  }
};
const getallFloortransactionlog = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // Assuming 'Bearer token'

  if (!token) {
    return res.status(401).json({ message: "Authorization token is required" });
  }

  try {
    // Decode the token to get the username
    const decoded = jwt.verify(token, process.env.JWT_KEY); // Replace with your actual secret
    const username = decoded.username; // Assuming the token contains 'username'

    // Count queries for each status with username filter and mergestatus = NULL
    const pendingCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Pending' 
       AND (finalstatus <> 'Completed' OR finalstatus IS NULL)
      
       AND mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    const inProgressCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'In Progress' 
       AND (finalstatus <> 'Completed' OR finalstatus IS NULL)
     
       AND mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    const servedCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Served' 
       AND (finalstatus <> 'Completed' OR finalstatus IS NULL)
    
       AND mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    const rejectedCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Rejected' 
       AND (finalstatus <> 'Completed' OR finalstatus IS NULL)
       
       AND mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    // Query to get all data filtered by username and mergestatus = NULL
    const allData = await sequelize.query(
      `SELECT st.*, pc.productName, pc.productCategory, pc.productSubcategory, 
              pc.location AS productLocation, pc.productPrice, pc.productImage, pc.discountrate
       FROM [MoodLagos].[dbo].[salesTransaction_table] st
       JOIN [MoodLagos].[dbo].[productCreation_table] pc
       ON st.itemname = pc.productName
       WHERE (st.finalstatus <> 'Completed' OR st.finalstatus IS NULL)
       
       AND st.mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    // Return the counts and detailed data
    res.status(200).json({
      pending: pendingCount[0].count,
      inProgress: inProgressCount[0].count,
      served: servedCount[0].count,
      rejected: rejectedCount[0].count,
      allData,
    });
  } catch (error) {
    console.error("Error retrieving sales transaction counts:", error);
    res.status(500).json({
      message: "Failed to retrieve sales transaction counts",
      error: error.message,
    });
  }
};
const getAllFloorManagerActionTransactionLog = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1]; // Assuming 'Bearer token'

  if (!token) {
    return res.status(401).json({ message: "Authorization token is required" });
  }

  try {
    // Decode the token to get the username
    const decoded = jwt.verify(token, process.env.JWT_KEY); // Replace with your actual secret
    const username = decoded.username; // Assuming the token contains 'username'

    // Count queries for each status with mergestatus = NULL and itemremoval is not null
    const pendingCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Pending' 
       AND (finalstatus <> 'Completed' OR finalstatus IS NULL)
       AND mergestatus IS NULL
       AND itemremoval IS NOT NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const inProgressCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'In Progress' 
       AND (finalstatus <> 'Completed' OR finalstatus IS NULL)
       AND mergestatus IS NULL
       AND itemremoval IS NOT NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const servedCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Served' 
       AND (finalstatus <> 'Completed' OR finalstatus IS NULL)
       AND mergestatus IS NULL
       AND itemremoval IS NOT NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const rejectedCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Rejected' 
       AND (finalstatus <> 'Completed' OR finalstatus IS NULL)
       AND mergestatus IS NULL
       AND itemremoval IS NOT NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    // Query to get all data where itemremoval is not null, filtered by mergestatus = NULL
    const allData = await sequelize.query(
      `SELECT st.*, pc.productName, pc.productCategory, pc.productSubcategory, 
              pc.location AS productLocation, pc.productPrice, pc.productImage, pc.discountrate
       FROM [MoodLagos].[dbo].[salesTransaction_table] st
       JOIN [MoodLagos].[dbo].[productCreation_table] pc
       ON st.itemname = pc.productName
       WHERE (st.finalstatus <> 'Completed' OR st.finalstatus IS NULL)
       AND st.mergestatus IS NULL
       AND st.itemremoval IS NOT NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    // Return the counts and detailed data
    res.status(200).json({
      pending: pendingCount[0].count,
      inProgress: inProgressCount[0].count,
      served: servedCount[0].count,
      rejected: rejectedCount[0].count,
      allData,
    });
  } catch (error) {
    console.error("Error retrieving sales transaction counts:", error);
    res.status(500).json({
      message: "Failed to retrieve sales transaction counts",
      error: error.message,
    });
  }
};

const getAllSpecialDiscountReasons = async (req, res) => {
  try {
    // Query the database to fetch all records from the specialdiscountreasons table
    const reasons = await sequelize.query(
      `SELECT [reason] FROM [MoodLagos].[dbo].[specialdiscountreasons]`,
      {
        type: QueryTypes.SELECT,
      }
    );

    // If no data is found
    if (reasons.length === 0) {
      return res
        .status(404)
        .json({ message: "No special discount reasons found." });
    }

    // Return the data
    return res.status(200).json({
      message: "Special discount reasons retrieved successfully.",
      data: reasons,
    });
  } catch (error) {
    console.error("Error fetching special discount reasons:", error);
    return res.status(500).json({
      message: "Failed to retrieve special discount reasons",
      error: error.message,
    });
  }
};

const getKitchenSalesTransactionsByStatus = async (req, res) => {
  try {
    const pendingCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Pending' AND location = 'kitchen' 
         AND (finalstatus <> 'Completed' OR finalstatus IS NULL)  AND  mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const inProgressCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'In Progress' AND location = 'kitchen' 
         AND (finalstatus <> 'Completed' OR finalstatus IS NULL)  AND  mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const servedCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Served' AND location = 'kitchen' 
         AND (finalstatus <> 'Completed' OR finalstatus IS NULL)  AND  mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const rejectedCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Rejected' AND location = 'kitchen' 
         AND (finalstatus <> 'Completed' OR finalstatus IS NULL)  AND  mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const allData = await sequelize.query(
      `SELECT st.*, pc.productName, pc.productCategory, pc.productSubcategory, 
              pc.location AS productLocation, pc.productPrice, pc.productImage, pc.discountrate, 
              st.itemorderid, st.rejectionreason
       FROM [MoodLagos].[dbo].[salesTransaction_table] st
       JOIN [MoodLagos].[dbo].[productCreation_table] pc
       ON st.itemname = pc.productName
       WHERE st.location = 'kitchen' 
         AND (st.finalstatus <> 'Completed' OR st.finalstatus IS NULL) AND  mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    res.status(200).json({
      pending: pendingCount[0].count,
      inProgress: inProgressCount[0].count,
      served: servedCount[0].count,
      rejected: rejectedCount[0].count,
      allData,
    });
  } catch (error) {
    console.error("Error retrieving sales transaction counts:", error);
    res.status(500).json({
      message: "Failed to retrieve sales transaction counts",
      error: error.message,
    });
  }
};

const getBarSalesTransactionsByStatus = async (req, res) => {
  try {
    const pendingCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Pending' AND location = 'bar' 
         AND (finalstatus <> 'Completed' OR finalstatus IS NULL)  AND  mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const inProgressCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'In Progress' AND location = 'bar' 
         AND (finalstatus <> 'Completed' OR finalstatus IS NULL)  AND  mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const servedCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Served' AND location = 'bar' 
         AND (finalstatus <> 'Completed' OR finalstatus IS NULL)  AND  mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const rejectedCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Rejected' AND location = 'bar' 
         AND (finalstatus <> 'Completed' OR finalstatus IS NULL)  AND  mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const allData = await sequelize.query(
      `SELECT st.*, pc.productName, pc.productCategory, pc.productSubcategory, 
              pc.location AS productLocation, pc.productPrice, pc.productImage, pc.discountrate, 
              st.itemorderid, st.rejectionreason
       FROM [MoodLagos].[dbo].[salesTransaction_table] st
       JOIN [MoodLagos].[dbo].[productCreation_table] pc
       ON st.itemname = pc.productName
       WHERE st.location = 'bar' 
         AND (st.finalstatus <> 'Completed' OR st.finalstatus IS NULL)  AND  mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    res.status(200).json({
      pending: pendingCount[0].count,
      inProgress: inProgressCount[0].count,
      served: servedCount[0].count,
      rejected: rejectedCount[0].count,
      allData,
    });
  } catch (error) {
    console.error("Error retrieving sales transaction counts:", error);
    res.status(500).json({
      message: "Failed to retrieve sales transaction counts",
      error: error.message,
    });
  }
};
const getShishaTransactionsByStatus = async (req, res) => {
  try {
    const pendingCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Pending' AND location = 'shisha' 
         AND (finalstatus <> 'Completed' OR finalstatus IS NULL)`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const inProgressCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'In Progress' AND location = 'shisha' 
         AND (finalstatus <> 'Completed' OR finalstatus IS NULL)  AND  mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const servedCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Served' AND location = 'shisha' 
         AND (finalstatus <> 'Completed' OR finalstatus IS NULL)  AND  mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const rejectedCount = await sequelize.query(
      `SELECT COUNT(*) AS count
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [status] = 'Rejected' AND location = 'shisha' 
         AND (finalstatus <> 'Completed' OR finalstatus IS NULL)  AND  mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    const allData = await sequelize.query(
      `SELECT st.*, pc.productName, pc.productCategory, pc.productSubcategory, 
              pc.location AS productLocation, pc.productPrice, pc.productImage, pc.discountrate, 
              st.itemorderid, st.rejectionreason
       FROM [MoodLagos].[dbo].[salesTransaction_table] st
       JOIN [MoodLagos].[dbo].[productCreation_table] pc
       ON st.itemname = pc.productName
       WHERE st.location = 'shisha' 
         AND (st.finalstatus <> 'Completed' OR st.finalstatus IS NULL)  AND  mergestatus IS NULL`,
      {
        type: QueryTypes.SELECT,
      }
    );

    res.status(200).json({
      pending: pendingCount[0].count,
      inProgress: inProgressCount[0].count,
      served: servedCount[0].count,
      rejected: rejectedCount[0].count,
      allData,
    });
  } catch (error) {
    console.error("Error retrieving sales transaction counts:", error);
    res.status(500).json({
      message: "Failed to retrieve sales transaction counts",
      error: error.message,
    });
  }
};

const cancelOrder = async (req, res) => {
  const { orderIds } = req.body;

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return res
      .status(400)
      .json({ message: "Order IDs are required and must be an array" });
  }

  for (const orderId of orderIds) {
    if (typeof orderId !== "string" || orderId.trim() === "") {
      return res
        .status(400)
        .json({ message: "Each order ID must be a non-empty string" });
    }
  }

  let transaction;

  try {
    transaction = await sequelize.transaction();

    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
       SET [status] = 'CANCELLED'
       WHERE [orderid] IN (:orderIds)`,
      {
        type: QueryTypes.UPDATE,
        replacements: { orderIds },
        transaction,
      }
    );

    await transaction.commit();

    res.status(200).json({ message: "Orders cancelled successfully" });
  } catch (error) {
    console.error("Error cancelling orders:", error);

    if (transaction) {
      await transaction.rollback();
    }

    res.status(500).json({
      message: "Failed to cancel orders",
      error: error.message,
    });
  }
};

// const acceptAllItemsInOrder = async (req, res) => {
//   const { orderid, currentOrderType } = req.body;

//   if (!orderid) {
//     return res.status(400).json({ message: "Order ID is required" });
//   }

//   try {
//     const transaction = await sequelize.transaction();

//     let updatedRows;

//     if (currentOrderType === "Updated-Awaiting response") {
//       [updatedRows] = await sequelize.query(
//         `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
//          SET [updated] = 0
//          WHERE [orderid] = :orderid`,
//         {
//           type: QueryTypes.UPDATE,
//           replacements: { orderid },
//           transaction,
//         }
//       );
//     } else {
//       [updatedRows] = await sequelize.query(
//         `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
//          SET [status] = 'In Progress'
//          WHERE [orderid] = :orderid AND [status] = 'Pending' AND location = 'kitchen'`,
//         {
//           type: QueryTypes.UPDATE,
//           replacements: { orderid },
//           transaction,
//         }
//       );
//     }

//     await transaction.commit();

//     if (updatedRows === 0) {
//       return res.status(404).json({
//         message: "No items found for the given order ID with pending status",
//       });
//     }

//     res.status(200).json({
//       message:
//         currentOrderType === "Updated-Awaiting Response"
//           ? "Order updated flag set to 0"
//           : "Order status updated to 'In Progress'",
//     });
//   } catch (error) {
//     console.error("Error updating order status:", error);

//     if (transaction) {
//       await transaction.rollback();
//     }

//     res.status(500).json({
//       message: "Failed to update order status",
//       error: error.message,
//     });
//   }
// };

const acceptAllItemsInOrder = async (req, res) => {
  const { orderid, currentOrderType } = req.body;

  if (!orderid) {
    return res.status(400).json({ message: "Order ID is required" });
  }

  const token = req.headers.authorization?.split(" ")[1]; // Get the token from the Authorization header
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  let actionusername;
  try {
    const decoded = jwt.verify(token, process.env.JWT_KEY); // Use your JWT secret
    actionusername = decoded.username;
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }

  const currentDate = new Date().toISOString().slice(0, 19).replace("T", " "); // Current date in YYYY-MM-DD HH:mm:ss format

  try {
    const transaction = await sequelize.transaction();

    // Update order status in salesTransaction_table
    const [updatedRows] = await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
       SET [status] = 'In Progress', 
           [updated] = 0, 
           [acceptorrejecttime] = :currentDate, 
           [actionusername] = :actionusername
       WHERE [orderid] = :orderid 
         AND location = 'KITCHEN' 
         AND ([status] = 'Pending' OR :currentOrderType = 'Updated-Awaiting Response')`,
      {
        type: QueryTypes.UPDATE,
        replacements: {
          orderid,
          currentOrderType,
          currentDate,
          actionusername,
        },
        transaction,
      }
    );

    // Check if any rows were updated
    if (updatedRows === 0) {
      await transaction.rollback();
      return res.status(404).json({
        message: "No items found for the given order ID with pending status",
      });
    }

    // Fetch the username and table associated with the order ID
    const [userRecord] = await sequelize.query(
      `SELECT username, [table] FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE orderid = :orderid`,
      {
        type: QueryTypes.SELECT,
        replacements: { orderid },
        transaction,
      }
    );

    if (!userRecord) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ message: "No user or table found for the given order ID" });
    }

    const { username, table } = userRecord;

    // Create notification including the table information
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[notifications] (username, location, notification, isread)
       VALUES (:username, 'order', :notification, 0)`,
      {
        type: QueryTypes.INSERT,
        replacements: {
          username,
          notification: `Order ${orderid} at table ${table} status has been updated to 'In Progress'`,
        },
        transaction,
      }
    );

    // Commit the transaction
    await transaction.commit();

    res.status(200).json({
      message: `Order status updated to 'In Progress' for table ${table} and notification created`,
    });
  } catch (error) {
    console.error("Error updating order status:", error);

    if (transaction) {
      await transaction.rollback();
    }

    res.status(500).json({
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

const acceptAllBarItemsInOrder = async (req, res) => {
  const { orderid, currentOrderType } = req.body;

  if (!orderid) {
    return res.status(400).json({ message: "Order ID is required" });
  }

  const token = req.headers.authorization?.split(" ")[1]; // Get the token from the Authorization header
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  let actionusername;
  try {
    const decoded = jwt.verify(token, process.env.JWT_KEY); // Use your JWT secret
    actionusername = decoded.username;
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }

  const currentDate = new Date().toISOString().slice(0, 19).replace("T", " "); // Current date in YYYY-MM-DD HH:mm:ss format

  try {
    const transaction = await sequelize.transaction();

    // Update order status in salesTransaction_table
    const [updatedRows] = await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
       SET [status] = 'In Progress', 
           [updated] = 0, 
           [acceptorrejecttime] = :currentDate, 
           [actionusername] = :actionusername
       WHERE [orderid] = :orderid 
         AND location = 'BAR' 
         AND ([status] = 'Pending' OR :currentOrderType = 'Updated-Awaiting Response')`,
      {
        type: QueryTypes.UPDATE,
        replacements: {
          orderid,
          currentOrderType,
          currentDate,
          actionusername,
        },
        transaction,
      }
    );

    // Check if any rows were updated
    if (updatedRows === 0) {
      await transaction.rollback();
      return res.status(404).json({
        message: "No items found for the given order ID with pending status",
      });
    }

    // Fetch the username and table associated with the order ID
    const [userRecord] = await sequelize.query(
      `SELECT username, [table] FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE orderid = :orderid`,
      {
        type: QueryTypes.SELECT,
        replacements: { orderid },
        transaction,
      }
    );

    if (!userRecord) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ message: "No user or table found for the given order ID" });
    }

    const { username, table } = userRecord;

    // Create notification including the table information
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[notifications] (username, location, notification, isread)
       VALUES (:username, 'order', :notification, 0)`,
      {
        type: QueryTypes.INSERT,
        replacements: {
          username,
          notification: `Order ${orderid} at table ${table} (BAR) status has been updated to 'In Progress'`,
        },
        transaction,
      }
    );

    // Commit the transaction
    await transaction.commit();

    res.status(200).json({
      message: `Order status updated to 'In Progress' for table ${table} (BAR) and notification created`,
    });
  } catch (error) {
    console.error("Error updating order status:", error);

    if (transaction) {
      await transaction.rollback();
    }

    res.status(500).json({
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

// const updateItemInOrderStatus = async (req, res) => {
//   const {
//     orderId,
//     itemname,
//     status,
//     currentOrderType,
//     rejectionReason,
//     itemorderid,
//   } = req.body;

//   if (!orderId || !itemname || !status || !itemorderid) {
//     return res.status(400).json({
//       message: "Order ID, Item name, Item order ID, and Status are required",
//     });
//   }

//   const validStatuses = ["Rejected", "In Progress"];
//   if (!validStatuses.includes(status)) {
//     return res
//       .status(400)
//       .json({ message: 'Status must be either "Rejected" or "In Progress"' });
//   }

//   const token = req.headers.authorization?.split(" ")[1]; // Get the token from the Authorization header
//   if (!token) {
//     return res.status(401).json({ message: "Unauthorized: No token provided" });
//   }

//   let actionusername;
//   try {
//     const decoded = jwt.verify(token, process.env.JWT_KEY); // Use your JWT secret
//     actionusername = decoded.username; // Adjust according to your token's structure
//   } catch (error) {
//     return res.status(401).json({ message: "Unauthorized: Invalid token" });
//   }

//   const currentDate = new Date().toISOString().slice(0, 19).replace("T", " "); // Current date in YYYY-MM-DD HH:mm:ss format

//   try {
//     let updatedRows;

//     if (currentOrderType === "Updated-Awaiting response") {
//       // First, update `updated = 0` for all items with the given orderId
//       await sequelize.query(
//         `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
//          SET updated = 0
//          WHERE orderid = :orderId`,
//         {
//           type: QueryTypes.UPDATE,
//           replacements: { orderId },
//         }
//       );

//       // Now, update the status (and rejection reason, if applicable) for the specific item
//       if (status === "Rejected" && rejectionReason) {
//         [updatedRows] = await sequelize.query(
//           `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
//            SET status = :status,
//                rejectionreason = :rejectionReason,
//                acceptorrejecttime = :currentDate,
//                actionusername = :actionusername
//            WHERE orderid = :orderId
//              AND itemorderid = :itemorderid
//              AND itemname = :itemname`,
//           {
//             type: QueryTypes.UPDATE,
//             replacements: {
//               orderId,
//               itemorderid,
//               itemname,
//               status,
//               rejectionReason,
//               currentDate,
//               actionusername,
//             },
//           }
//         );
//       } else {
//         [updatedRows] = await sequelize.query(
//           `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
//            SET status = :status,
//                acceptorrejecttime = :currentDate,
//                actionusername = :actionusername
//            WHERE orderid = :orderId
//              AND itemorderid = :itemorderid
//              AND itemname = :itemname`,
//           {
//             type: QueryTypes.UPDATE,
//             replacements: {
//               orderId,
//               itemorderid,
//               itemname,
//               status,
//               currentDate,
//               actionusername,
//             },
//           }
//         );
//       }
//     } else if (status === "Rejected" && rejectionReason) {
//       // If status is "Rejected" and rejection reason is provided (for normal cases)
//       [updatedRows] = await sequelize.query(
//         `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
//          SET status = :status,
//              rejectionreason = :rejectionReason,
//              acceptorrejecttime = :currentDate,
//              actionusername = :actionusername
//          WHERE orderid = :orderId
//            AND itemorderid = :itemorderid
//            AND itemname = :itemname
//            AND status = 'Pending'`,
//         {
//           type: QueryTypes.UPDATE,
//           replacements: {
//             orderId,
//             itemorderid,
//             itemname,
//             status,
//             rejectionReason,
//             currentDate,
//             actionusername,
//           },
//         }
//       );
//     } else {
//       // Regular case: Update status to "In Progress" (for normal cases)
//       [updatedRows] = await sequelize.query(
//         `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
//          SET status = :status,
//              acceptorrejecttime = :currentDate,
//              actionusername = :actionusername
//          WHERE orderid = :orderId
//            AND itemorderid = :itemorderid
//            AND itemname = :itemname
//            AND status = 'Pending'`,
//         {
//           type: QueryTypes.UPDATE,
//           replacements: {
//             orderId,
//             itemorderid,
//             itemname,
//             status,
//             currentDate,
//             actionusername,
//           },
//         }
//       );
//     }

//     // Check if any rows were updated
//     if (updatedRows === 0) {
//       return res.status(404).json({ message: "No matching order/item found" });
//     }

//     // Fetch the username associated with the order ID
//     const [userRecord] = await sequelize.query(
//       `SELECT username FROM [MoodLagos].[dbo].[salesTransaction_table]
//        WHERE orderid = :orderId`,
//       {
//         type: QueryTypes.SELECT,
//         replacements: { orderId },
//       }
//     );

//     if (!userRecord) {
//       return res
//         .status(404)
//         .json({ message: "No user found for the given order ID" });
//     }

//     const username = userRecord.username;

//     // Create notification with item details
//     await sequelize.query(
//       `INSERT INTO [MoodLagos].[dbo].[notifications] (username, location, notification, isread)
//        VALUES (:username, 'order', :notification, 0)`,
//       {
//         type: QueryTypes.INSERT,
//         replacements: {
//           username,
//           notification: `Order ${orderId} item '${itemname}' status has been updated to '${status}'.`,
//         },
//       }
//     );

//     res.status(200).json({
//       message:
//         currentOrderType === "Updated-Awaiting response"
//           ? status === "Rejected"
//             ? `Item rejected with reason: '${rejectionReason}' and all items updated flag set to 0`
//             : "Item status updated and all items' updated flag set to 0"
//           : status === "Rejected"
//           ? `Item rejected with reason: '${rejectionReason}'`
//           : `Item status updated successfully to '${status}'`,
//     });
//   } catch (error) {
//     console.error("Error updating item status:", error);
//     res.status(500).json({
//       message: "An error occurred while updating item status",
//       error: error.message,
//     });
//   }
// };

const updateItemInOrderStatus = async (req, res) => {
  const {
    orderId,
    itemname,
    status,
    currentOrderType,
    rejectionReason,
    itemorderid,
  } = req.body;

  if (!orderId || !itemname || !status || !itemorderid) {
    return res.status(400).json({
      message: "Order ID, Item name, Item order ID, and Status are required",
    });
  }

  const validStatuses = ["Rejected", "In Progress"];
  if (!validStatuses.includes(status)) {
    return res
      .status(400)
      .json({ message: 'Status must be either "Rejected" or "In Progress"' });
  }

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  let actionusername;
  try {
    const decoded = jwt.verify(token, process.env.JWT_KEY);
    actionusername = decoded.username;
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }

  const currentDate = new Date().toISOString().slice(0, 19).replace("T", " ");

  try {
    // Fetch the current status of the item
    const [currentItem] = await sequelize.query(
      `SELECT status FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE orderid = :orderId 
         AND itemorderid = :itemorderid 
         AND itemname = :itemname`,
      {
        type: QueryTypes.SELECT,
        replacements: { orderId, itemorderid, itemname },
      }
    );

    if (!currentItem) {
      return res.status(404).json({ message: "No matching order/item found" });
    }

    // Check if the current status matches the requested status
    if (currentItem.status === status) {
      return res.status(400).json({
        message: `Item already has status '${status}', no update needed`,
      });
    }

    let updatedRows;

    if (currentOrderType === "Updated-Awaiting response") {
      // Reset `updated` flag for all items with the given orderId
      await sequelize.query(
        `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
         SET updated = 0
         WHERE orderid = :orderId`,
        {
          type: QueryTypes.UPDATE,
          replacements: { orderId },
        }
      );
    }

    // Update status and other fields based on whether a rejection reason is provided
    if (status === "Rejected" && rejectionReason) {
      [updatedRows] = await sequelize.query(
        `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
         SET status = :status, 
             rejectionreason = :rejectionReason, 
             acceptorrejecttime = :currentDate, 
             actionusername = :actionusername
         WHERE orderid = :orderId 
           AND itemorderid = :itemorderid 
           AND itemname = :itemname`,
        {
          type: QueryTypes.UPDATE,
          replacements: {
            orderId,
            itemorderid,
            itemname,
            status,
            rejectionReason,
            currentDate,
            actionusername,
          },
        }
      );
    } else {
      [updatedRows] = await sequelize.query(
        `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
         SET status = :status, 
             rejectionreason = NULL, 
             acceptorrejecttime = :currentDate, 
             actionusername = :actionusername
         WHERE orderid = :orderId 
           AND itemorderid = :itemorderid 
           AND itemname = :itemname`,
        {
          type: QueryTypes.UPDATE,
          replacements: {
            orderId,
            itemorderid,
            itemname,
            status,
            currentDate,
            actionusername,
          },
        }
      );
    }

    if (updatedRows === 0) {
      return res
        .status(404)
        .json({ message: "No matching order/item found for update" });
    }

    const [userRecord] = await sequelize.query(
      `SELECT username FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE orderid = :orderId`,
      {
        type: QueryTypes.SELECT,
        replacements: { orderId },
      }
    );

    if (!userRecord) {
      return res
        .status(404)
        .json({ message: "No user found for the given order ID" });
    }

    const username = userRecord.username;

    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[notifications] (username, location, notification, isread)
       VALUES (:username, 'order', :notification, 0)`,
      {
        type: QueryTypes.INSERT,
        replacements: {
          username,
          notification: `Order ${orderId} item '${itemname}' status has been updated to '${status}'.`,
        },
      }
    );

    res.status(200).json({
      message:
        currentOrderType === "Updated-Awaiting response"
          ? status === "Rejected"
            ? `Item rejected with reason: '${rejectionReason}' and all items updated flag set to 0`
            : "Item status updated and all items' updated flag set to 0"
          : status === "Rejected"
          ? `Item rejected with reason: '${rejectionReason}'`
          : `Item status updated successfully to '${status}'`,
    });
  } catch (error) {
    console.error("Error updating item status:", error);
    res.status(500).json({
      message: "An error occurred while updating item status",
      error: error.message,
    });
  }
};

const updateItemQuantity = async (req, res) => {
  const { itemorderid, qty } = req.body;

  // Validate input
  if (!itemorderid || qty === undefined) {
    return res
      .status(400)
      .json({ message: "itemorderid and qty are required" });
  }

  try {
    // Update the quantity of the item
    const [updatedRows] = await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
       SET quantity = :qty
       WHERE itemorderid = :itemorderid`,
      {
        type: QueryTypes.UPDATE,
        replacements: { itemorderid, qty },
      }
    );

    // Check if any rows were updated
    if (updatedRows === 0) {
      return res
        .status(404)
        .json({ message: "No item found with the provided itemorderid" });
    }

    return res
      .status(200)
      .json({ message: "Item quantity updated successfully" });
  } catch (error) {
    console.error("Error updating item quantity:", error);
    return res.status(500).json({
      message: "An error occurred while updating item quantity",
      error: error.message,
    });
  }
};

const deleteItemByOrderId = async (req, res) => {
  const { itemorderid } = req.body;

  // Validate input
  if (!itemorderid) {
    return res.status(400).json({
      message: "Item order ID is required",
    });
  }

  const token = req.headers.authorization?.split(" ")[1]; // Get the token from the Authorization header
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  let actionusername;
  try {
    const decoded = jwt.verify(token, process.env.JWT_KEY); // Use your JWT secret
    actionusername = decoded.username; // Adjust according to your token's structure
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }

  try {
    // Attempt to delete the item
    const [deletedRows] = await sequelize.query(
      `DELETE FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE itemorderid = :itemorderid`,
      {
        type: QueryTypes.DELETE,
        replacements: { itemorderid },
      }
    );

    // Check if any rows were deleted
    if (deletedRows === 0) {
      return res
        .status(404)
        .json({ message: "No item found with the given order ID" });
    }

    // Optionally, you can log this action to a notifications table
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[notifications] (username, location, notification, isread)
       VALUES (:username, 'order', :notification, 0)`,
      {
        type: QueryTypes.INSERT,
        replacements: {
          username: actionusername,
          notification: `Item with order ID '${itemorderid}' has been deleted.`,
        },
      }
    );

    res.status(200).json({
      message: "Item deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({
      message: "An error occurred while deleting the item",
      error: error.message,
    });
  }
};

const acceptAllShishaItemsInOrder = async (req, res) => {
  const { orderid, currentOrderType } = req.body;

  if (!orderid) {
    return res.status(400).json({ message: "Order ID is required" });
  }

  const token = req.headers.authorization?.split(" ")[1]; // Get the token from the Authorization header
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: No token provided" });
  }

  let actionusername;
  try {
    const decoded = jwt.verify(token, process.env.JWT_KEY); // Use your JWT secret
    actionusername = decoded.username;
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized: Invalid token" });
  }

  const currentDate = new Date().toISOString().slice(0, 19).replace("T", " "); // Current date in YYYY-MM-DD HH:mm:ss format

  try {
    const transaction = await sequelize.transaction();

    // Update order status in salesTransaction_table
    const [updatedRows] = await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
       SET [status] = 'In Progress', 
           [updated] = 0, 
           [acceptorrejecttime] = :currentDate, 
           [actionusername] = :actionusername
       WHERE [orderid] = :orderid 
         AND location = 'shisha' 
         AND ([status] = 'Pending' OR :currentOrderType = 'Updated-Awaiting Response')`,
      {
        type: QueryTypes.UPDATE,
        replacements: {
          orderid,
          currentOrderType,
          currentDate,
          actionusername,
        },
        transaction,
      }
    );

    // Check if any rows were updated
    if (updatedRows === 0) {
      await transaction.rollback();
      return res.status(404).json({
        message: "No items found for the given order ID with pending status",
      });
    }

    // Fetch the username and table associated with the order ID
    const [userRecord] = await sequelize.query(
      `SELECT username, [table] FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE orderid = :orderid`,
      {
        type: QueryTypes.SELECT,
        replacements: { orderid },
        transaction,
      }
    );

    if (!userRecord) {
      await transaction.rollback();
      return res
        .status(404)
        .json({ message: "No user or table found for the given order ID" });
    }

    const { username, table } = userRecord;

    // Create notification including the table information
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[notifications] (username, location, notification, isread)
       VALUES (:username, 'order', :notification, 0)`,
      {
        type: QueryTypes.INSERT,
        replacements: {
          username,
          notification: `Order ${orderid} at table ${table} (Shisha) status has been updated to 'In Progress'`,
        },
        transaction,
      }
    );

    // Commit the transaction
    await transaction.commit();

    res.status(200).json({
      message: `Order status updated to 'In Progress' for table ${table} (Shisha) and notification created`,
    });
  } catch (error) {
    console.error("Error updating order status:", error);

    if (transaction) {
      await transaction.rollback();
    }

    res.status(500).json({
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

const serveItemsInOrder = async (req, res) => {
  const { orderid } = req.body;

  if (!orderid) {
    return res.status(400).json({ message: "Order ID is required" });
  }

  const currentDate = new Date().toISOString().slice(0, 19).replace("T", " "); // Current date in YYYY-MM-DD HH:mm:ss format

  let transaction;

  try {
    transaction = await sequelize.transaction();

    // Step 1: Update status and get username and table in a single query
    const [result] = await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
       SET [status] = 'Served', [servedtime] = :currentDate
       OUTPUT INSERTED.username, INSERTED.[table]
       WHERE [orderid] = :orderid AND location = 'KITCHEN' AND [status] = 'In Progress'`,
      {
        replacements: { orderid, currentDate },
        type: QueryTypes.UPDATE,
        transaction,
      }
    );

    if (result.length === 0) {
      return res.status(404).json({
        message:
          "No items found for the given order ID with status 'In Progress'",
      });
    }

    // Step 2: Extract username and table from the result
    const { username, table } = result[0];

    // Step 3: Create a notification
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[notifications]
       ([username], [location], [notification], [isread])
       VALUES
       (:username, 'order', :notification, 0)`,
      {
        replacements: {
          username,
          notification: `Some items in the kitchen have been served for ${table}`,
        },
        type: QueryTypes.INSERT,
      }
    );

    // Commit the transaction after all operations
    await transaction.commit();

    res.status(200).json({
      message: "Order status updated to 'Served' and servedtime set",
    });
  } catch (error) {
    console.error("Error updating order status:", error);

    if (transaction) {
      await transaction.rollback();
    }

    res.status(500).json({
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

const serveAllItemsBarInOrder = async (req, res) => {
  const { orderid } = req.body;

  if (!orderid) {
    return res.status(400).json({ message: "Order ID is required" });
  }

  const currentDate = new Date().toISOString().slice(0, 19).replace("T", " "); // Current date in YYYY-MM-DD HH:mm:ss format

  let transaction;

  try {
    transaction = await sequelize.transaction();

    // Step 1: Update status and get username and table in a single query
    const [result] = await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
       SET [status] = 'Served', [servedtime] = :currentDate
       OUTPUT INSERTED.username, INSERTED.[table]
       WHERE [orderid] = :orderid AND location = 'BAR' AND [status] = 'In Progress'`,
      {
        replacements: { orderid, currentDate },
        type: QueryTypes.UPDATE,
        transaction,
      }
    );

    if (result.length === 0) {
      return res.status(404).json({
        message:
          "No items found for the given order ID with status 'In Progress'",
      });
    }

    // Step 2: Extract username and table from the result
    const { username, table } = result[0];

    // Step 3: Create a notification
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[notifications]
       ([username], [location], [notification], [isread])
       VALUES
       (:username, 'order', :notification, 0)`,
      {
        replacements: {
          username,
          notification: `Some items in bar have been served for: ${table}`,
        },
        type: QueryTypes.INSERT,
      }
    );

    // Commit the transaction after all operations
    await transaction.commit();

    res.status(200).json({
      message: "Order status updated to 'Served' and servedtime set",
    });
  } catch (error) {
    console.error("Error updating order status:", error);

    if (transaction) {
      await transaction.rollback();
    }

    res.status(500).json({
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

const serveBarItemsInOrder = async (req, res) => {
  const { orderid } = req.body;

  if (!orderid) {
    return res.status(400).json({ message: "Order ID is required" });
  }

  const currentDate = new Date().toISOString().slice(0, 19).replace("T", " "); // Current date in YYYY-MM-DD HH:mm:ss format

  let transaction;

  try {
    transaction = await sequelize.transaction();

    let updatedRows;

    // Step 1: Update status of all items with status "In Progress" to "Served" and set the servedtime
    [updatedRows] = await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
       SET [status] = 'Served', [servedtime] = :currentDate
       WHERE [orderid] = :orderid AND location = 'BAR' AND [status] = 'In Progress'`,
      {
        type: QueryTypes.UPDATE,
        replacements: { orderid, currentDate },
        transaction,
      }
    );

    if (updatedRows === 0) {
      return res.status(404).json({
        message:
          "No items found for the given order ID with status 'In Progress'",
      });
    }

    // Step 2: Retrieve username and table using orderid
    const [orderDetails] = await sequelize.query(
      `SELECT username, FROM [MoodLagos].[dbo].[salesTransaction_table] WHERE orderid = :orderid`,
      {
        replacements: { orderid },
        type: QueryTypes.SELECT,
      }
    );

    console.log(orderDetails);

    if (!orderDetails) {
      return res.status(404).json({ message: "Order details not found" });
    }

    const { username } = orderDetails; // Get username and table

    // Step 3: Create a notification
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[notifications]
       ([username], [location], [notification], [isread])
       VALUES 
       (:username, 'order' , :notification, 0)`,
      {
        replacements: {
          username,
          notification: `Some items in bar have been served for: ${orderid}`,
        },
        type: QueryTypes.INSERT,
      }
    );

    // Commit the transaction after all operations
    await transaction.commit();

    res.status(200).json({
      message: "Order status updated to 'Served' and servedtime set",
    });
  } catch (error) {
    console.error("Error updating order status:", error);

    if (transaction) {
      await transaction.rollback();
    }

    res.status(500).json({
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

const serveShishaItemsInOrder = async (req, res) => {
  const { orderid } = req.body;

  if (!orderid) {
    return res.status(400).json({ message: "Order ID is required" });
  }

  const currentDate = new Date().toISOString().slice(0, 19).replace("T", " "); // Current date in YYYY-MM-DD HH:mm:ss format

  let transaction;

  try {
    transaction = await sequelize.transaction();

    // Step 1: Update status and get username and table in a single query
    const [result] = await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
       SET [status] = 'Served', [servedtime] = :currentDate
       OUTPUT INSERTED.username, INSERTED.[table]
       WHERE [orderid] = :orderid AND location = 'shisha' AND [status] = 'In Progress'`,
      {
        replacements: { orderid, currentDate },
        type: QueryTypes.UPDATE,
        transaction,
      }
    );

    if (result.length === 0) {
      return res.status(404).json({
        message:
          "No items found for the given order ID with status 'In Progress'",
      });
    }

    // Step 2: Extract username and table from the result
    const { username, table } = result[0];

    // Step 3: Create a notification
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[notifications]
       ([username], [location], [notification], [isread])
       VALUES
       (:username, 'order', :notification, 0)`,
      {
        replacements: {
          username,
          notification: `Some items in shisha have been served for ${table}`,
        },
        type: QueryTypes.INSERT,
      }
    );

    // Commit the transaction after all operations
    await transaction.commit();

    res.status(200).json({
      message: "Order status updated to 'Served' and servedtime set",
    });
  } catch (error) {
    console.error("Error updating order status:", error);

    if (transaction) {
      await transaction.rollback();
    }

    res.status(500).json({
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

const serveIndividualItem = async (req, res) => {
  const { orderId, itemOrderId } = req.body;

  if (!orderId || !itemOrderId) {
    return res
      .status(400)
      .json({ message: "Order ID and Item Order ID are required" });
  }

  const currentDate = new Date().toISOString().slice(0, 19).replace("T", " ");

  let transaction;

  try {
    transaction = await sequelize.transaction();

    // Step 1: Update status of the individual item and get username and table in one query
    const [result] = await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
       SET status = 'Served', servedtime = :currentDate
       OUTPUT INSERTED.username, INSERTED.[table]
       WHERE orderid = :orderId AND itemorderid = :itemOrderId AND status = 'In Progress'`,
      {
        type: QueryTypes.UPDATE,
        replacements: { orderId, itemOrderId, currentDate },
        transaction,
      }
    );

    if (result.length === 0) {
      return res.status(404).json({
        message: "No matching item found or status is not 'In Progress'",
      });
    }

    const { username, table } = result[0]; // Get username and table from the result

    // Step 2: Create a notification
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[notifications]
       ([username], [location], [notification], [isread])
       VALUES 
       (:username, 'order', :notification, 0)`,
      {
        replacements: {
          username,
          notification: `An item has been served for ${table}`,
        },
        type: QueryTypes.INSERT,
        transaction,
      }
    );

    // Commit the transaction after all operations
    await transaction.commit();

    res.status(200).json({
      message: "Item status updated to 'Served' and servedtime set",
    });
  } catch (error) {
    console.error("Error serving individual item:", error);

    if (transaction) {
      await transaction.rollback();
    }

    res.status(500).json({
      message: "Failed to update item status",
      error: error.message,
    });
  }
};

const fetchOrderRejectionReasons = async (req, res) => {
  try {
    const reasons = await sequelize.query(
      `SELECT TOP (1000) [reason] FROM [MoodLagos].[dbo].[orderRejectionReasons]`,
      { type: QueryTypes.SELECT }
    );

    if (reasons.length === 0) {
      return res.status(404).json({ message: "No rejection reasons found" });
    }

    res.status(200).json({ data: reasons });
  } catch (error) {
    console.error("Error fetching rejection reasons:", error);
    res.status(500).json({
      message: "Failed to fetch rejection reasons",
      error: error.message,
    });
  }
};

const completeSale = async (req, res) => {
  const {
    orderid,
    paymentType,
    subtotal,
    vat,
    orderdiscount,
    total,
    delivery,
  } = req.body;

  try {
    // Step 1: Insert into CompletedSales table
    const currentTime = new Date(); // Get the current date and time

    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[CompletedSales] 
        ([orderid], [paymentType], [subtotal], [vat], [orderdiscount], [total], [date], [delivery]) 
       VALUES 
        (:orderid, :paymentType, :subtotal, :vat, :orderdiscount, :total, :date, :delivery)`,
      {
        replacements: {
          orderid,
          paymentType,
          subtotal,
          vat,
          orderdiscount,
          total,
          date: currentTime,
          delivery,
        },
        type: QueryTypes.INSERT,
      }
    );

    // Step 2: Update the final status in the salesTransaction_table
    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
       SET finalstatus = 'Completed', completedtime = :completedTime
       WHERE orderid = :orderid`,
      {
        replacements: { orderid, completedTime: currentTime },
        type: QueryTypes.UPDATE,
      }
    );

    // Step 3: Update cashierPending table to set cashierStatus to 'Complete'
    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[casierPending]
       SET cashierStatus = 'Complete'
       WHERE orderid = :orderid`,
      {
        replacements: { orderid },
        type: QueryTypes.UPDATE,
      }
    );

    res.status(201).json({
      message:
        "Sale completed successfully, order status updated to 'Completed', and cashier status set to 'Complete'",
    });
  } catch (error) {
    console.error("Error completing sale:", error);
    res.status(500).json({
      message: "Failed to complete sale and update order and cashier status",
      error: error.message,
    });
  }
};
const getCompletedSales = async (req, res) => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ message: "Start date and end date are required" });
  }

  // Split and format startDate to remove unwanted parts
  const [startDateOnly] = startDate.split("T"); // Get only the date part
  const startDateTime = `${startDateOnly} 14:00:00.0000000`; // Start date at 2 PM

  // Calculate next day for end date and construct date-time for 6 AM
  const endDateObj = new Date(endDate);
  endDateObj.setDate(endDateObj.getDate() + 1); // Add one day

  // Format endDate to YYYY-MM-DD
  const year = endDateObj.getFullYear();
  const month = String(endDateObj.getMonth() + 1).padStart(2, "0"); // Months are zero-based
  const day = String(endDateObj.getDate()).padStart(2, "0");

  const endDateTime = `${year}-${month}-${day} 06:00:00.0000000`; // Next day at 6 AM

  try {
    const completedSales = await sequelize.query(
      `SELECT cs.[id], cs.[orderid], cs.[paymentType], cs.[subtotal], 
              cs.[vat], cs.[orderdiscount], cs.[delivery], cs.[total], cs.[date],
              st.[sid], st.[itemname], st.[username], st.[quantity], 
              st.[price], st.[updated], st.[category], 
              st.[itemorderid], st.[location], st.[actionusername], st.[rejectionreason], 
              st.[finalstatus], st.[status], st.[completedtime], 
              st.[createdDate], st.[table]
       FROM [MoodLagos].[dbo].[CompletedSales] cs
       JOIN [MoodLagos].[dbo].[salesTransaction_table] st 
       ON cs.orderid = st.orderid
       WHERE cs.[date] BETWEEN :startDateTime AND :endDateTime`,
      {
        type: QueryTypes.SELECT,
        replacements: { startDateTime, endDateTime },
      }
    );

    res.status(200).json(completedSales);
  } catch (error) {
    console.error("Error retrieving completed sales:", error);
    res.status(500).json({
      message: "Failed to retrieve completed sales",
      error: error.message,
    });
  }
};

const getCompletedSalesForEmployee = async (req, res) => {
  const { startDate, endDate } = req.query; // Expecting dates in query parameters

  const token = req.headers.authorization?.split(" ")[1]; // Assuming 'Bearer token'

  if (!token) {
    return res.status(401).json({ message: "Authorization token is required" });
  }

  try {
    // Decode the token to get the username
    const decoded = jwt.verify(token, process.env.JWT_KEY); // Make sure to replace with your actual secret
    const username = decoded.username; // Assuming the token contains 'username'

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "Start date and end date are required" });
    }

    // Split and format startDate to remove unwanted parts
    const [startDateOnly] = startDate.split("T"); // Get only the date part
    const startDateTime = `${startDateOnly} 14:00:00.0000000`; // Start date at 2 PM

    // Calculate next day for end date and construct date-time for 6 AM
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1); // Add one day

    // Format endDate to YYYY-MM-DD
    const year = endDateObj.getFullYear();
    const month = String(endDateObj.getMonth() + 1).padStart(2, "0"); // Months are zero-based
    const day = String(endDateObj.getDate()).padStart(2, "0");

    const endDateTime = `${year}-${month}-${day} 06:00:00.0000000`; // Next day at 6 AM

    // Query to get completed sales for the logged-in user
    const completedSales = await sequelize.query(
      `SELECT cs.[id], cs.[orderid], cs.[paymentType],cs.[delivery], cs.[subtotal], 
              cs.[vat], cs.[orderdiscount], cs.[total], cs.[date],
              st.[sid], st.[itemname], st.[username], st.[quantity], 
              st.[price], st.[updated], st.[category], 
              st.[itemorderid], st.[location], st.[actionusername], st.[rejectionreason], 
              st.[finalstatus], st.[status], st.[completedtime], 
              st.[createdDate] , st.[table], st.[productDiscount]
       FROM [MoodLagos].[dbo].[CompletedSales] cs
       JOIN [MoodLagos].[dbo].[salesTransaction_table] st 
       ON cs.orderid = st.orderid
       WHERE cs.[date] BETWEEN :startDateTime AND :endDateTime
       AND st.[username] = :username`, // Filter by the username
      {
        type: QueryTypes.SELECT,
        replacements: { startDateTime, endDateTime, username },
      }
    );

    res.status(200).json(completedSales);
  } catch (error) {
    console.error("Error retrieving completed sales:", error);
    res.status(500).json({
      message: "Failed to retrieve completed sales",
      error: error.message,
    });
  }
};

const getCompletedSalesKitchen = async (req, res) => {
  const { startDate, endDate } = req.query; // Expecting dates in query parameters

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ message: "Start date and end date are required" });
  }

  try {
    // Split and format startDate
    const [startDateOnly] = startDate.split("T"); // Get only the date part
    const startDateTime = `${startDateOnly} 14:00:00.0000000`; // Set start date to 2 PM

    // Calculate next day for end date and set it to 6 AM
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1); // Add one day
    const year = endDateObj.getFullYear();
    const month = String(endDateObj.getMonth() + 1).padStart(2, "0"); // Months are zero-based
    const day = String(endDateObj.getDate()).padStart(2, "0");
    const endDateTime = `${year}-${month}-${day} 06:00:00.0000000`; // Next day at 6 AM

    const completedSales = await sequelize.query(
      `SELECT cs.[id], cs.[orderid], cs.[paymentType], cs.[subtotal], 
              cs.[vat], cs.[orderdiscount], cs.[total], cs.[date],
              st.[sid], st.[itemname], st.[username], st.[quantity], 
              st.[price], st.[updated], st.[category], 
              st.[itemorderid], st.[location], st.[actionusername], st.[rejectionreason], 
              st.[finalstatus], st.[status], st.[completedtime], 
              st.[createdDate], st.[table], st.[productDiscount]
       FROM [MoodLagos].[dbo].[CompletedSales] cs
       JOIN [MoodLagos].[dbo].[salesTransaction_table] st 
       ON cs.orderid = st.orderid
       WHERE cs.[date] BETWEEN :startDateTime AND :endDateTime and st.[location] = 'KITCHEN'`,
      {
        type: QueryTypes.SELECT,
        replacements: { startDateTime, endDateTime },
      }
    );

    res.status(200).json(completedSales);
  } catch (error) {
    console.error("Error retrieving completed sales:", error);
    res.status(500).json({
      message: "Failed to retrieve completed sales",
      error: error.message,
    });
  }
};

const getCompletedSalesBar = async (req, res) => {
  const { startDate, endDate } = req.query; // Expecting dates in query parameters

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ message: "Start date and end date are required" });
  }

  try {
    // Split and format startDate
    const [startDateOnly] = startDate.split("T"); // Get only the date part
    const startDateTime = `${startDateOnly} 14:00:00.0000000`; // Set start date to 2 PM

    // Calculate next day for end date and set it to 6 AM
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1); // Add one day
    const year = endDateObj.getFullYear();
    const month = String(endDateObj.getMonth() + 1).padStart(2, "0"); // Months are zero-based
    const day = String(endDateObj.getDate()).padStart(2, "0");
    const endDateTime = `${year}-${month}-${day} 06:00:00.0000000`; // Next day at 6 AM

    const completedSales = await sequelize.query(
      `SELECT cs.[id], cs.[orderid], cs.[paymentType], cs.[subtotal], 
              cs.[vat], cs.[orderdiscount], cs.[total], cs.[date],
              st.[sid], st.[itemname], st.[username], st.[quantity], 
              st.[price], st.[updated], st.[category], 
              st.[itemorderid], st.[location], st.[actionusername], st.[rejectionreason], 
              st.[finalstatus], st.[status], st.[completedtime], 
              st.[createdDate],  st.[table], st.[productDiscount]
       FROM [MoodLagos].[dbo].[CompletedSales] cs
       JOIN [MoodLagos].[dbo].[salesTransaction_table] st 
       ON cs.orderid = st.orderid
       WHERE cs.[date] BETWEEN :startDateTime AND :endDateTime and st.[location] = 'BAR'`,
      {
        type: QueryTypes.SELECT,
        replacements: { startDateTime, endDateTime },
      }
    );

    res.status(200).json(completedSales);
  } catch (error) {
    console.error("Error retrieving completed sales:", error);
    res.status(500).json({
      message: "Failed to retrieve completed sales",
      error: error.message,
    });
  }
};

const getCompletedSalesShisha = async (req, res) => {
  const { startDate, endDate } = req.query; // Expecting dates in query parameters

  if (!startDate || !endDate) {
    return res
      .status(400)
      .json({ message: "Start date and end date are required" });
  }

  try {
    // Split and format startDate
    const [startDateOnly] = startDate.split("T"); // Get only the date part
    const startDateTime = `${startDateOnly} 14:00:00.0000000`; // Set start date to 2 PM

    // Calculate next day for end date and set it to 6 AM
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1); // Add one day
    const year = endDateObj.getFullYear();
    const month = String(endDateObj.getMonth() + 1).padStart(2, "0"); // Months are zero-based
    const day = String(endDateObj.getDate()).padStart(2, "0");
    const endDateTime = `${year}-${month}-${day} 06:00:00.0000000`; // Next day at 6 AM

    const completedSales = await sequelize.query(
      `SELECT cs.[id], cs.[orderid], cs.[paymentType], cs.[subtotal], 
              cs.[vat], cs.[orderdiscount], cs.[total], cs.[date],
              st.[sid], st.[itemname], st.[username], st.[quantity], 
              st.[price], st.[updated], st.[category], 
              st.[itemorderid], st.[location], st.[actionusername], st.[rejectionreason], 
              st.[finalstatus], st.[status], st.[completedtime], 
              st.[createdDate],  st.[table], st.[productDiscount]
       FROM [MoodLagos].[dbo].[CompletedSales] cs
       JOIN [MoodLagos].[dbo].[salesTransaction_table] st 
       ON cs.orderid = st.orderid
       WHERE cs.[date] BETWEEN :startDateTime AND :endDateTime and st.[location] = 'SHISHA'`,
      {
        type: QueryTypes.SELECT,
        replacements: { startDateTime, endDateTime },
      }
    );

    res.status(200).json(completedSales);
  } catch (error) {
    console.error("Error retrieving completed sales:", error);
    res.status(500).json({
      message: "Failed to retrieve completed sales",
      error: error.message,
    });
  }
};

const applySpecialDiscount = async (req, res) => {
  const {
    orderid,
    specialdiscountvalue,
    specialdiscountstatus,
    specialdiscountreason,
  } = req.body;

  if (
    !orderid ||
    specialdiscountvalue === undefined ||
    !specialdiscountstatus ||
    !specialdiscountreason
  ) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    // Step 1: Reset the fields to null and set specialdiscountstatus to 'Pending'
    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[casierPending]
       SET 
         specialdiscountvalue = NULL,
         specialdiscountreason = NULL,
         specialdiscountapprovedby = NULL,
         specialdiscountapplied = NULL,
         specialdiscountstatus = 'Pending'
       WHERE orderid = :orderid`,
      {
        replacements: { orderid },
        type: QueryTypes.UPDATE,
      }
    );

    // Step 2: Apply the special discount with the new values
    const result = await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[casierPending]
      SET 
        specialdiscountvalue = :specialdiscountvalue,
        specialdiscountstatus = :specialdiscountstatus,
        specialdiscountreason = :specialdiscountreason,
        specialdiscountapplied = 'true'
      WHERE orderid = :orderid`,
      {
        replacements: {
          orderid,
          specialdiscountvalue,
          specialdiscountstatus,
          specialdiscountreason,
        },
        type: QueryTypes.UPDATE,
      }
    );

    // Check if the update was successful
    if (result[1] === 0) {
      return res.status(404).json({ message: "Order ID not found." });
    }

    // Step 3: Create a new notification
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[notifications]
       ([username], [location], [notification], [isread])
       VALUES 
       (NULL, 'specialdiscount', 'A new special discount request has been received', 0)`,
      {
        type: QueryTypes.INSERT,
      }
    );

    return res
      .status(200)
      .json({ message: "Special discount applied successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Failed to apply special discount",
      error: error.message,
    });
  }
};

const updateSpecialDiscountStatus = async (req, res) => {
  const { orderid, specialdiscountstatus } = req.body;

  // Ensure the orderid and specialdiscountstatus are provided
  if (!orderid || !specialdiscountstatus) {
    return res.status(400).json({
      message: "Order ID and special discount status are required",
    });
  }

  try {
    const username = req.user.username; // Ensure JWT middleware attaches this to the request object

    // Step 1: Execute raw SQL query to update the discount status and the username who approved the discount
    const [results, metadata] = await sequelize.query(
      `
      UPDATE [MoodLagos].[dbo].[casierPending]
      SET specialdiscountstatus = :specialdiscountstatus,
          specialdiscountapplied = 1, -- Set special discount as applied (true)
          specialdiscountapprovedby = :username -- Update with username from token
      WHERE orderid = :orderid
      `,
      {
        type: QueryTypes.UPDATE,
        replacements: {
          specialdiscountstatus,
          username, // Add username from JWT token to be saved in the specialdiscountapprovedby column
          orderid,
        },
      }
    );

    if (metadata.rowCount === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Step 2: Retrieve username and [table] FROM casierPending using orderid
    const [orderDetails] = await sequelize.query(
      `SELECT username, [table] FROM [MoodLagos].[dbo].[casierPending] WHERE orderid = :orderid`,
      {
        replacements: { orderid },
        type: QueryTypes.SELECT,
      }
    );

    if (!orderDetails) {
      return res.status(404).json({ message: "Order details not found" });
    }

    const notificationUsername = orderDetails.username; // Get the username from the table
    const table = orderDetails.table; // Get the [table] FROM the casierPending table

    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[notifications]
       ([username], [location], [notification], [isread])
       VALUES 
       (:username, 'order' , :notification, 0)`,
      {
        replacements: {
          username: notificationUsername,
          notification: `The status of the special discount for orderid: ${orderid} (${table}) has been updated`,
        },
        type: QueryTypes.INSERT,
      }
    );

    res.status(200).json({
      message: `Special discount status for order ${orderid} was successfully updated to ${specialdiscountstatus} by ${username}`,
    });
  } catch (error) {
    console.error("Error updating special discount status:", error);
    res.status(500).json({
      message: "Failed to update special discount status",
      error: error.message,
    });
  }
};

const getPaymentMethods = async (req, res) => {
  try {
    // Execute raw SQL query to fetch payment methods
    const paymentMethods = await sequelize.query(
      `
      SELECT [name]
      FROM [MoodLagos].[dbo].[paymentMethods]
      `,
      {
        type: QueryTypes.SELECT, // Use SELECT to fetch data
      }
    );

    // Return the fetched payment methods
    res.status(200).json(paymentMethods);
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    res.status(500).json({
      message: "Failed to retrieve payment methods",
      error: error.message,
    });
  }
};

const getPendingSalesForEmployee = async (req, res) => {
  const { startDate, endDate } = req.query; // Expecting dates in query parameters
  const token = req.headers.authorization?.split(" ")[1]; // Assuming 'Bearer token'

  if (!token) {
    return res.status(401).json({ message: "Authorization token is required" });
  }

  try {
    // Decode the token to get the username
    const decoded = jwt.verify(token, process.env.JWT_KEY); // Replace with your actual secret
    const username = decoded.username; // Assuming the token contains 'username'

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "Start date and end date are required" });
    }

    // Query to get pending sales for the logged-in user where cashierStatus is null
    const pendingSales = await sequelize.query(
      `SELECT [sid], [orderid], [itemname], [username], [actionusername], 
              [servedtime], [acceptorrejecttime], [quantity], [price], [table], 
              [updated], [category], [itemorderid], [location], [rejectionreason], 
              [finalstatus], [status], [completedtime], [createdDate], [sentby], 
              [specialdiscountvalue], [specialdiscountstatus], [specialdiscountreason], 
              [specialdiscountapprovedby], [specialdiscountapplied], [sentdate], 
              [cashierStatus], [productDiscount], [tablechangeinfo]
       FROM [MoodLagos].[dbo].[casierPending]
       WHERE [username] = :username
       AND [cashierStatus] IS NULL
       AND [createdDate] BETWEEN :startDate AND :endDate`, // Filter by date range and null cashierStatus
      {
        type: QueryTypes.SELECT,
        replacements: { startDate, endDate, username },
      }
    );

    res.status(200).json(pendingSales);
  } catch (error) {
    console.error("Error retrieving pending sales:", error);
    res.status(500).json({
      message: "Failed to retrieve pending sales",
      error: error.message,
    });
  }
};

const getPendingSalesForLocation = async (req, res) => {
  const { startDate, endDate, location } = req.query; // Expecting dates and location in query parameters

  if (!startDate || !endDate || !location) {
    return res
      .status(400)
      .json({ message: "Start date, end date, and location are required" });
  }

  try {
    // Query to get pending sales for the specified location where cashierStatus is null
    const pendingSales = await sequelize.query(
      `SELECT [sid], [orderid], [itemname], [username], [actionusername], 
              [servedtime], [acceptorrejecttime], [quantity], [price], [table], 
              [updated], [category], [itemorderid], [location], [rejectionreason], 
              [finalstatus], [status], [completedtime], [createdDate], [sentby], 
              [specialdiscountvalue], [specialdiscountstatus], [specialdiscountreason], 
              [specialdiscountapprovedby], [specialdiscountapplied], [sentdate], 
              [cashierStatus], [productDiscount], [tablechangeinfo]
       FROM [MoodLagos].[dbo].[casierPending]
       WHERE [location] = :location
       AND [cashierStatus] IS NULL
       AND [createdDate] BETWEEN :startDate AND :endDate`, // Filter by location and null cashierStatus
      {
        type: QueryTypes.SELECT,
        replacements: { startDate, endDate, location },
      }
    );

    res.status(200).json(pendingSales);
  } catch (error) {
    console.error("Error retrieving pending sales for location:", error);
    res.status(500).json({
      message: "Failed to retrieve pending sales for location",
      error: error.message,
    });
  }
};

const mergeOrders = async (req, res) => {
  const { orderid1, orderid2, newOrderId } = req.body; // old order IDs and new order ID
  const token = req.headers.authorization?.split(" ")[1]; // Assuming 'Bearer token'

  if (!token) {
    return res.status(401).json({ message: "Authorization token is required" });
  }

  try {
    // Decode the token to get the username
    const decoded = jwt.verify(token, process.env.JWT_KEY); // Make sure to replace with your actual secret
    const username = decoded.username; // Assuming the token contains 'username'

    // Check if both orders exist

    const orderCheck = await sequelize.query(
      `SELECT orderid FROM [MoodLagos].[dbo].[salesTransaction_table] 
       WHERE orderid IN (:orderid1, :orderid2)`,
      {
        type: QueryTypes.SELECT,
        replacements: { orderid1, orderid2 },
      }
    );
    if (orderCheck.length < 2) {
      return res.status(404).json({ message: "One or both orders not found" });
    }

    // Replicate items from both orders into the new order
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[salesTransaction_table]
        (orderid, itemname, username, actionusername, servedtime, 
         acceptorrejecttime, quantity, price, [table], updated, category, 
         itemorderid, location, rejectionreason, finalstatus, status, 
         completedtime, createdDate, productDiscount, tablechangeinfo, 
         mergeorderid,  mergedby)
       SELECT :newOrderId, itemname, username, actionusername, servedtime, 
              acceptorrejecttime, quantity, price, [table], updated, category, 
              itemorderid, location, rejectionreason, finalstatus, status, 
              completedtime, createdDate, productDiscount, tablechangeinfo, 
              CONCAT(:orderid1, ',', :orderid2), :username
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE orderid IN (:orderid1, :orderid2)`,
      {
        replacements: { newOrderId, orderid1, orderid2, username },
        type: QueryTypes.INSERT,
      }
    );

    // Update the old orders with 'MERGED' in the mergestatus
    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
       SET mergestatus = 'MERGED'
       WHERE orderid IN (:orderid1, :orderid2)`,
      {
        replacements: { orderid1, orderid2 },
        type: QueryTypes.UPDATE,
      }
    );

    res.status(200).json({ message: "Orders merged successfully", newOrderId });
  } catch (error) {
    console.error("Error merging orders:", error);
    res
      .status(500)
      .json({ message: "Failed to merge orders", error: error.message });
  }
};

const splitMergedOrders = async (req, res) => {
  const { mergedOrderId } = req.body; // mergedOrderId provided by frontend
  const token = req.headers.authorization?.split(" ")[1]; // Extract JWT token

  if (!token) {
    return res.status(401).json({ message: "Authorization token is required" });
  }

  try {
    // Decode token to get the username
    const decoded = jwt.verify(token, process.env.JWT_KEY);
    const username = decoded.username;

    // Fetch the mergeorderid to get the old order ids
    const mergedOrderData = await sequelize.query(
      `SELECT mergeorderid 
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [orderid] = :mergedOrderId`,
      {
        type: QueryTypes.SELECT,
        replacements: { mergedOrderId },
      }
    );

    if (!mergedOrderData.length) {
      return res.status(404).json({ message: "Merged order not found" });
    }

    const { mergeorderid } = mergedOrderData[0];
    const [oldOrderId1, oldOrderId2] = mergeorderid.split(",");

    // Fetch all items for the mergedOrderId
    const mergedItems = await sequelize.query(
      `SELECT * 
       FROM [MoodLagos].[dbo].[salesTransaction_table]
       WHERE [orderid] = :mergedOrderId`,
      {
        type: QueryTypes.SELECT,
        replacements: { mergedOrderId },
      }
    );

    let allItemsFound = true;

    // Iterate over each merged item to split it back
    for (const item of mergedItems) {
      // Check if the itemorderid exists in oldOrderId1
      const oldItem1 = await sequelize.query(
        `SELECT * 
         FROM [MoodLagos].[dbo].[salesTransaction_table]
         WHERE [orderid] = :oldOrderId1 
         AND [itemorderid] = :itemorderid`,
        {
          type: QueryTypes.SELECT,
          replacements: { oldOrderId1, itemorderid: item.itemorderid },
        }
      );

      // Check if the itemorderid exists in oldOrderId2
      const oldItem2 = await sequelize.query(
        `SELECT * 
         FROM [MoodLagos].[dbo].[salesTransaction_table]
         WHERE [orderid] = :oldOrderId2 
         AND [itemorderid] = :itemorderid`,
        {
          type: QueryTypes.SELECT,
          replacements: { oldOrderId2, itemorderid: item.itemorderid },
        }
      );

      if (oldItem1.length > 0 || oldItem2.length > 0) {
        // If the item exists in either old order, reset merge fields in the old order
        await sequelize.query(
          `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
           SET [mergeorderid] = NULL, 
               [mergestatus] = NULL, 
               [mergedby] = NULL
           WHERE [orderid] IN (:oldOrderId1, :oldOrderId2) 
           AND [itemorderid] = :itemorderid`,
          {
            type: QueryTypes.UPDATE,
            replacements: {
              oldOrderId1,
              oldOrderId2,
              itemorderid: item.itemorderid,
            },
          }
        );

        // Also, delete this item from the merged order
        await sequelize.query(
          `DELETE FROM [MoodLagos].[dbo].[salesTransaction_table]
           WHERE [orderid] = :mergedOrderId 
           AND [itemorderid] = :itemorderid`,
          {
            type: QueryTypes.DELETE,
            replacements: { mergedOrderId, itemorderid: item.itemorderid },
          }
        );
      } else {
        // If not found in either old order, keep it in mergedOrderId and reset its merge fields
        await sequelize.query(
          `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
           SET [mergeorderid] = NULL, 
               [mergestatus] = NULL, 
               [mergedby] = NULL
           WHERE [orderid] = :mergedOrderId 
           AND [itemorderid] = :itemorderid`,
          {
            type: QueryTypes.UPDATE,
            replacements: { mergedOrderId, itemorderid: item.itemorderid },
          }
        );

        // Mark as not all items were found
        allItemsFound = false;
      }
    }

    // If all items were successfully moved back, delete the merged order
    if (allItemsFound) {
      await sequelize.query(
        `DELETE FROM [MoodLagos].[dbo].[salesTransaction_table]
         WHERE [orderid] = :mergedOrderId`,
        {
          type: QueryTypes.DELETE,
          replacements: { mergedOrderId },
        }
      );
    }

    res.status(200).json({
      message: allItemsFound
        ? "Merged order split successfully, all items moved back to old orders."
        : "Merged order split, but some items were not found in old orders and remain in the merged order.",
    });
  } catch (error) {
    console.error("Error splitting merged orders:", error);
    res.status(500).json({
      message: "Failed to split merged orders",
      error: error.message,
    });
  }
};

const updateManagerRemoval = async (req, res) => {
  const { itemOrderId, managerRemovalValue } = req.body; // Expecting itemOrderId and managerRemovalValue in the request body

  if (!itemOrderId || typeof managerRemovalValue === "undefined") {
    return res.status(400).json({
      message: "Item order ID and manager removal value are required",
    });
  }

  const transaction = await sequelize.transaction();

  try {
    // Update the managerremoval field for the specified itemOrderId
    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
       SET [itemremoval] = :managerRemovalValue
       WHERE [itemorderid] = :itemOrderId`,
      {
        type: QueryTypes.UPDATE,
        replacements: { itemOrderId, managerRemovalValue },
        transaction,
      }
    );

    // Create notification
    const uniqueLocations = ["orderitemsmanage"]; // The location is set as 'orderitemsmanage'
    const notificationMessage = "A need order modification was requested";

    for (const location of uniqueLocations) {
      if (
        ["kitchen", "shisha", "bar", "orderitemsmanage"].includes(
          location.toLowerCase()
        )
      ) {
        await sequelize.query(
          `INSERT INTO [MoodLagos].[dbo].[notifications] 
          ([username], [location], [notification], [isread])
          VALUES (NULL, :location, :notification, 0)`, // isread is set to false by default (0)
          {
            type: QueryTypes.INSERT,
            replacements: {
              location: location,
              notification: notificationMessage,
            },
            transaction,
          }
        );
      }
    }

    await transaction.commit();
    res.status(200).json({
      message: "Manager removal updated and notification created successfully.",
    });
  } catch (error) {
    await transaction.rollback();
    console.log(error);
    res.status(500).json({
      message: "Failed to update manager removal and create notification",
      error: error.message,
    });
  }
};

const duplicateAndDeleteOrder = async (req, res) => {
  const { orderid, customers } = req.body;

  if (!orderid || !Array.isArray(customers) || customers.length === 0) {
    return res
      .status(400)
      .json({ message: "Order ID and customers data are required." });
  }

  let transaction; // Declare transaction here

  try {
    transaction = await sequelize.transaction();

    // Select original orders from casierPending table
    const originalOrders = await sequelize.query(
      `SELECT TOP (1000) [sid], [orderid], [itemname], [username], [actionusername], [servedtime], 
        [acceptorrejecttime], [quantity], [price], [table], [updated], [category], [itemorderid], 
        [location], [rejectionreason], [finalstatus], [status], [completedtime], [createdDate], 
        [sentby], [specialdiscountvalue], [specialdiscountstatus], [specialdiscountreason], 
        [specialdiscountapprovedby], [specialdiscountapplied], [sentdate], [cashierStatus], 
        [productDiscount], [tablechangeinfo], [mergeorderid], [mergestatus], [mergedby]
      FROM [MoodLagos].[dbo].[casierPending] WHERE orderid = :orderid`,
      {
        type: QueryTypes.SELECT,
        replacements: { orderid },
        transaction, // Add transaction here
      }
    );

    if (originalOrders.length === 0) {
      return res.status(404).json({ message: "Order not found." });
    }

    for (const customer of customers) {
      const { customerSplits } = customer;

      for (const [index, originalOrder] of originalOrders.entries()) {
        const quantity = customerSplits[index] || 0;

        if (quantity > 0) {
          const newOrderId = `${orderid}_customer${index + 1}`;

          await sequelize.query(
            `INSERT INTO [MoodLagos].[dbo].[casierPending] 
            ([orderid], [itemname], [username], [actionusername], [servedtime], 
            [acceptorrejecttime], [quantity], [price], [table], [updated], [category], 
            [itemorderid], [location], [rejectionreason], [finalstatus], [status], 
            [completedtime], [createdDate], [sentby], [specialdiscountvalue], 
            [specialdiscountstatus], [specialdiscountreason], [specialdiscountapprovedby], 
            [specialdiscountapplied], [sentdate], [cashierStatus], 
            [productDiscount], [tablechangeinfo], [mergeorderid], [mergestatus], 
            [mergedby])
            VALUES (:orderid, :itemname, :username, :actionusername, :servedtime, 
            :acceptorrejecttime, :quantity, :price, :table, :updated, :category, 
            :itemorderid, :location, :rejectionreason, :finalstatus, :status, 
            :completedtime, GETDATE(), :sentby, :specialdiscountvalue, 
            :specialdiscountstatus, :specialdiscountreason, :specialdiscountapprovedby, 
            :specialdiscountapplied, :sentdate, :cashierStatus, 
            :productDiscount, :tablechangeinfo, :mergeorderid, :mergestatus, 
            :mergedby)`,
            {
              type: QueryTypes.INSERT,
              replacements: {
                orderid: newOrderId,
                itemname: originalOrder.itemname,
                username: originalOrder.username,
                actionusername: originalOrder.actionusername,
                servedtime: originalOrder.servedtime,
                acceptorrejecttime: originalOrder.acceptorrejecttime,
                quantity,
                price: originalOrder.price,
                table: originalOrder.table,
                updated: originalOrder.updated,
                category: originalOrder.category,
                itemorderid: originalOrder.itemorderid,
                location: originalOrder.location,
                rejectionreason: originalOrder.rejectionreason,
                finalstatus: originalOrder.finalstatus,
                status: originalOrder.status,
                completedtime: originalOrder.completedtime,
                // Assuming these fields are coming from originalOrder or set defaults
                sentby: originalOrder.sentby || null,
                specialdiscountvalue: originalOrder.specialdiscountvalue || 0,
                specialdiscountstatus:
                  originalOrder.specialdiscountstatus || null,
                specialdiscountreason:
                  originalOrder.specialdiscountreason || null,
                specialdiscountapprovedby:
                  originalOrder.specialdiscountapprovedby || null,
                specialdiscountapplied:
                  originalOrder.specialdiscountapplied || false,
                sentdate: originalOrder.sentdate || null,
                cashierStatus: originalOrder.cashierStatus || null,
                productDiscount: originalOrder.productDiscount || 0,
                tablechangeinfo: originalOrder.tablechangeinfo || null,
                mergeorderid: originalOrder.mergeorderid || null,
                mergestatus: originalOrder.mergestatus || null,
                mergedby: originalOrder.mergedby || null,
              },
              transaction,
            }
          );
        }
      }
    }

    await sequelize.query(
      `DELETE FROM [MoodLagos].[dbo].[casierPending] WHERE orderid = :orderid`,
      {
        type: QueryTypes.DELETE,
        replacements: { orderid },
        transaction,
      }
    );

    await transaction.commit();

    res.status(201).json({
      message: "Orders duplicated successfully and old order deleted.",
    });
  } catch (error) {
    console.error("Error duplicating orders and deleting old order:", error);
    if (transaction) {
      await transaction.rollback();
    }
    res.status(500).json({
      message: "Failed to duplicate orders and delete old order",
      error: error.message,
    });
  }
};

const mergeBill = async (req, res) => {
  const { orderid } = req.body;

  if (!orderid) {
    return res.status(400).json({ message: "Order ID is required." });
  }

  // Extract the base order ID by removing the customer suffix
  const baseOrderId = orderid.split("_")[0];

  try {
    // Check for any orders with the base order ID and cashierStatus of "Complete"
    const completedOrders = await sequelize.query(
      `SELECT * FROM [MoodLagos].[dbo].[casierPending] 
       WHERE orderid LIKE :baseOrderId AND cashierStatus = 'Complete'`,
      {
        type: QueryTypes.SELECT,
        replacements: { baseOrderId: `${baseOrderId}%` },
      }
    );

    if (completedOrders.length > 0) {
      return res.status(400).json({
        message:
          "The order can't be merged because one of the split items has been completed.",
      });
    }

    // Proceed to merge by updating the order ID for all split items
    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[casierPending] 
       SET orderid = :baseOrderId 
       WHERE orderid LIKE :orderid`,
      {
        type: QueryTypes.UPDATE,
        replacements: {
          baseOrderId,
          orderid: `${baseOrderId}_customer%`,
        },
      }
    );

    res.status(200).json({
      message: "Orders merged successfully.",
    });
  } catch (error) {
    console.error("Error merging orders:", error);
    res.status(500).json({
      message: "Failed to merge orders.",
      error: error.message,
    });
  }
};

module.exports = {
  getPendingSalesForEmployee,
  getPendingSalesForLocation,
  placeOrder,
  updateExistingOrder,
  getKitchenSalesTransactionsByStatus,
  getStaffSalesTransactionsByStatus,
  cancelOrder,
  acceptAllItemsInOrder,
  acceptAllBarItemsInOrder,
  updateItemInOrderStatus,
  fetchOrderRejectionReasons,
  serveItemsInOrder,
  serveIndividualItem,
  serveBarItemsInOrder,
  getCompletedSales,
  completeSale,
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
  mergeOrders,
  splitMergedOrders,
  getallFloortransactionlog,
  deleteItemByOrderId,
  updateItemQuantity,
  updateManagerRemoval,
  getAllFloorManagerActionTransactionLog,
  duplicateAndDeleteOrder,
  mergeBill,
};
