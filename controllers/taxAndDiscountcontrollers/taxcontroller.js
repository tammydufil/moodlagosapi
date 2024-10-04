const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../models/index");

const addTaxUpdate = async (req, res) => {
  try {
    const lastUpdate = await sequelize.query(
      `SELECT TOP 1 [newrate] FROM [MoodLagos].[dbo].[taxupdates] ORDER BY [date] DESC`,
      { type: QueryTypes.SELECT }
    );

    const oldrate = lastUpdate.length > 0 ? lastUpdate[0].newrate : 0;
    const newrate = req.body.newrate; // Assume newrate is passed in the request body

    if (newrate === undefined) {
      return res.status(400).json({ message: "New rate is required" });
    }

    const date = new Date(); // Current JavaScript date and time

    // Insert the new tax update
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[taxupdates] ([oldrate], [newrate], [date]) 
         VALUES (:oldrate, :newrate, :date)`,
      {
        type: QueryTypes.INSERT,
        replacements: { oldrate, newrate, date },
      }
    );

    res.status(201).json({ message: "Tax update added successfully" });
  } catch (error) {
    console.error("Error adding tax update:", error);
    res.status(500).json({
      message: "Failed to add tax update",
      error: error.message,
    });
  }
};

const getAllTaxUpdates = async (req, res) => {
  try {
    const taxUpdates = await sequelize.query(
      `SELECT [id], [oldrate], [newrate], [date]
       FROM [MoodLagos].[dbo].[taxupdates]`,
      { type: QueryTypes.SELECT }
    );

    res.status(200).json(taxUpdates);
  } catch (error) {
    console.error("Error fetching tax updates:", error);
    res.status(500).json({
      message: "Failed to retrieve tax updates",
      error: error.message,
    });
  }
};

const addProductDiscount = async (req, res) => {
  const { discountrate, productName } = req.body;
  const currentDate = new Date().toISOString();

  try {
    // Step 1: Check for existing discounts
    const [existingDiscount] = await sequelize.query(
      `SELECT * FROM [MoodLagos].[dbo].[productdiscount] 
       WHERE productname = :productName AND discountstatus = 'active'`,
      {
        replacements: { productName },
        type: QueryTypes.SELECT,
      }
    );

    // Step 2: If an existing active discount is found, update its status to inactive
    if (existingDiscount) {
      await sequelize.query(
        `UPDATE [MoodLagos].[dbo].[productdiscount]
         SET discountstatus = 'inactive'
         WHERE id = :id`,
        {
          replacements: { id: existingDiscount.id },
          type: QueryTypes.UPDATE,
        }
      );
    }

    // Step 3: Insert the new discount into the productdiscount table
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[productdiscount] 
        (discountrate, productname, date, discountstatus) 
       VALUES 
        (:discountrate, :productName, :currentDate, 'active')`,
      {
        replacements: {
          discountrate,
          productName,
          currentDate,
        },
        type: QueryTypes.INSERT,
      }
    );

    // Step 4: Update the discount rate in the productCreation_table
    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[productCreation_table]
       SET discountrate = :discountrate
       WHERE productName = :productName`,
      {
        replacements: {
          discountrate,
          productName,
        },
        type: QueryTypes.UPDATE,
      }
    );

    res.status(201).json({
      message: "Product discount added and product updated successfully",
    });
  } catch (error) {
    console.error("Error adding product discount or updating product:", error);
    res.status(500).json({
      message: "Failed to add product discount and update product",
      error: error.message,
    });
  }
};

const getAllProductDiscounts = async (req, res) => {
  try {
    const discounts = await sequelize.query(
      `SELECT TOP (1000) [id], [discountrate], [productname], [date], [discountstatus]
       FROM [MoodLagos].[dbo].[productdiscount]`,
      {
        type: QueryTypes.SELECT,
      }
    );

    // Send the data as JSON response
    res.status(200).json({ discounts });
  } catch (error) {
    console.error("Error fetching product discounts:", error);
    res.status(500).json({ message: "Failed to fetch product discounts" });
  }
};

const deactivateProductDiscount = async (req, res) => {
  const { productName } = req.body;

  try {
    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[productdiscount]
       SET discountstatus = 'inactive'
       WHERE productname = :productName AND discountstatus = 'active'`,
      {
        replacements: { productName },
        type: QueryTypes.UPDATE,
      }
    );

    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[productCreation_table]
       SET discountrate = NULL
       WHERE productName = :productName`,
      {
        replacements: { productName },
        type: QueryTypes.UPDATE,
      }
    );

    res.status(200).json({
      message: "Product discount deactivated successfully.",
    });
  } catch (error) {
    console.error("Error deactivating product discount:", error);
    res.status(500).json({
      message: "Failed to deactivate product discount.",
      error: error.message,
    });
  }
};

const addOrderDiscount = async (req, res) => {
  try {
    const lastUpdate = await sequelize.query(
      `SELECT TOP 1 [newrate] FROM [MoodLagos].[dbo].[orderDiscount] ORDER BY [date] DESC`,
      { type: QueryTypes.SELECT }
    );

    const oldrate = lastUpdate.length > 0 ? lastUpdate[0].newrate : 0;
    const newrate = req.body.newrate; // Assume newrate is passed in the request body

    if (newrate === undefined) {
      return res.status(400).json({ message: "New rate is required" });
    }

    const date = new Date(); // Current JavaScript date and time

    // Insert the new order discount
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[orderDiscount] ([oldrate], [newrate], [date]) 
         VALUES (:oldrate, :newrate, :date)`,
      {
        type: QueryTypes.INSERT,
        replacements: { oldrate, newrate, date },
      }
    );

    res.status(201).json({ message: "Order discount added successfully" });
  } catch (error) {
    console.error("Error adding order discount:", error);
    res.status(500).json({
      message: "Failed to add order discount",
      error: error.message,
    });
  }
};

const getAllOrderDiscounts = async (req, res) => {
  try {
    const orderDiscounts = await sequelize.query(
      `SELECT [id], [oldrate], [newrate], [date]
       FROM [MoodLagos].[dbo].[orderDiscount]`,
      { type: QueryTypes.SELECT }
    );

    res.status(200).json(orderDiscounts);
  } catch (error) {
    console.error("Error fetching order discounts:", error);
    res.status(500).json({
      message: "Failed to retrieve order discounts",
      error: error.message,
    });
  }
};



module.exports = {
  addTaxUpdate,
  getAllTaxUpdates,
  addProductDiscount,
  getAllProductDiscounts,
  deactivateProductDiscount,
  addOrderDiscount,
  getAllOrderDiscounts,
  
};
