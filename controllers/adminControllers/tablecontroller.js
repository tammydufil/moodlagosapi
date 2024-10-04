const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../models/index");
const jwt = require("jsonwebtoken");

const addTable = async (req, res) => {
  const { tablename, status } = req.body; // Expecting tablename and status from the request body

  try {
    // Step 1: Check if the table already exists in the Tables table
    const existingTable = await sequelize.query(
      `SELECT * FROM [MoodLagos].[dbo].[Tables] 
        WHERE tablename = :tablename`,
      {
        replacements: { tablename },
        type: QueryTypes.SELECT,
      }
    );

    if (existingTable.length > 0) {
      return res.status(400).json({
        message: "Table with the same name already exists",
      });
    }

    // Step 2: Insert new table into the Tables table
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[Tables] 
          ([tablename], [status]) 
         VALUES 
          (:tablename, :status)`,
      {
        replacements: {
          tablename,
          status,
        },
        type: QueryTypes.INSERT,
      }
    );

    res.status(201).json({
      message: "Table added successfully",
    });
  } catch (error) {
    console.error("Error adding table:", error);
    res.status(500).json({
      message: "Failed to add table",
      error: error.message,
    });
  }
};

const getAllTables = async (req, res) => {
  try {
    const tables = await sequelize.query(
      `SELECT [sid], [tablename], [status] 
         FROM [MoodLagos].[dbo].[Tables]`,
      {
        type: QueryTypes.SELECT,
      }
    );

    res.status(200).json({
      message: "Tables fetched successfully",
      data: tables,
    });
  } catch (error) {
    console.error("Error fetching tables:", error);
    res.status(500).json({
      message: "Failed to fetch tables",
      error: error.message,
    });
  }
};
const getAllActiveTables = async (req, res) => {
  try {
    const tables = await sequelize.query(
      `SELECT [sid], [tablename], [status] 
         FROM [MoodLagos].[dbo].[Tables] where status = 'Active' `,
      {
        type: QueryTypes.SELECT,
      }
    );

    res.status(200).json({
      message: "Tables fetched successfully",
      data: tables,
    });
  } catch (error) {
    console.error("Error fetching tables:", error);
    res.status(500).json({
      message: "Failed to fetch tables",
      error: error.message,
    });
  }
};

const updateTableStatus = async (req, res) => {
  const { tablename, status } = req.body;

  try {
    const existingTable = await sequelize.query(
      `SELECT * FROM [MoodLagos].[dbo].[Tables] 
        WHERE tablename = :tablename`,
      {
        replacements: { tablename },
        type: QueryTypes.SELECT,
      }
    );

    if (existingTable.length === 0) {
      return res.status(404).json({
        message: "Table not found",
      });
    }

    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[Tables] 
          SET [status] = :status 
        WHERE [tablename] = :tablename`,
      {
        replacements: { status, tablename },
        type: QueryTypes.UPDATE,
      }
    );

    res.status(200).json({
      message: `Table status updated to ${status}`,
    });
  } catch (error) {
    console.error("Error updating table status:", error);
    res.status(500).json({
      message: "Failed to update table status",
      error: error.message,
    });
  }
};

const deleteTable = async (req, res) => {
  const { tablename } = req.body;

  try {
    const existingTable = await sequelize.query(
      `SELECT * FROM [MoodLagos].[dbo].[Tables] 
        WHERE tablename = :tablename`,
      {
        replacements: { tablename },
        type: QueryTypes.SELECT,
      }
    );

    if (existingTable.length === 0) {
      return res.status(404).json({
        message: "Table not found",
      });
    }

    await sequelize.query(
      `DELETE FROM [MoodLagos].[dbo].[Tables] 
        WHERE [tablename] = :tablename`,
      {
        replacements: { tablename },
        type: QueryTypes.DELETE,
      }
    );

    res.status(200).json({
      message: "Table deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting table:", error);
    res.status(500).json({
      message: "Failed to delete table",
      error: error.message,
    });
  }
};

const updateTableChange = async (req, res) => {
  const { orderid, newTable } = req.body; // Order ID and new table number from the request body
  const token = req.headers["authorization"]; // Assuming the JWT token is passed in the Authorization header

  if (!orderid || !newTable || !token) {
    return res.status(400).json({
      message: "Order ID, new table, and authorization token are required.",
    });
  }

  try {
    // Verify the token and extract the username
    const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_KEY); // Adjust secret as per your setup
    const username = decoded.username;

    // Find the current record by orderid
    const result = await sequelize.query(
      `SELECT [table], [tablechangeinfo] 
       FROM [MoodLagos].[dbo].[salesTransaction_table] 
       WHERE [orderid] = :orderid`,
      {
        type: QueryTypes.SELECT,
        replacements: { orderid },
      }
    );

    if (result.length === 0) {
      return res.status(404).json({ message: "Order not found." });
    }

    const currentTable = result[0].table;
    let tableChangeInfo = result[0].tablechangeinfo
      ? JSON.parse(result[0].tablechangeinfo)
      : [];

    // Check if the table has actually changed
    if (currentTable === newTable) {
      return res.status(400).json({ message: "The table has not changed." });
    }

    // Prepare the new change record
    const newChangeRecord = `${username} changed from ${currentTable} to ${newTable}`;

    // Append the new change record to the tablechangeinfo array
    tableChangeInfo.push(newChangeRecord);

    // Update the table and tablechangeinfo in the database
    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[salesTransaction_table]
       SET [table] = :newTable, 
           [tablechangeinfo] = :tableChangeInfo 
       WHERE [orderid] = :orderid`,
      {
        type: QueryTypes.UPDATE,
        replacements: {
          newTable,
          tableChangeInfo: JSON.stringify(tableChangeInfo), // Convert array to JSON string
          orderid,
        },
      }
    );

    return res
      .status(200)
      .json({ message: "Table updated successfully", tableChangeInfo });
  } catch (error) {
    console.error("Error updating table:", error);
    return res.status(500).json({
      message: "An error occurred while updating the table.",
      error: error.message,
    });
  }
};

module.exports = {
  addTable,
  getAllTables,
  deleteTable,
  updateTableStatus,
  getAllActiveTables,
  updateTableChange,
};
