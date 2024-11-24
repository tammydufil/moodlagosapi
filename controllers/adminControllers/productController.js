const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../models/index");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_KEY;

const getAllProductCategories = async (req, res) => {
  try {
    const categories = await sequelize.query(
      `SELECT TOP (1000) 
          [sid],
          [categoryid],
          [categoryName],
          [createdDate],
          [deviceused],
          [ipused],
          [companyId]
        FROM [MoodLagos].[dbo].[productCategory_table]`,
      { type: QueryTypes.SELECT }
    );

    if (categories.length === 0) {
      return res.status(404).json({ message: "No categories found" });
    }

    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching product categories:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch categories", error: error.message });
  }
};

const getAllSubProductCategories = async (req, res) => {
  try {
    const subCategories = await sequelize.query(
      `SELECT TOP (1000) 
          [sid],
          [categoryID],
          [subCategoryId],
          [subCategory],
          [createdDate],
          [deviceused],
          [ipused],
          [companyId]
        FROM [MoodLagos].[dbo].[subProductCategory_table]`,
      { type: QueryTypes.SELECT }
    );

    if (subCategories.length === 0) {
      return res
        .status(404)
        .json({ message: "No sub-product categories found" });
    }

    res.status(200).json(subCategories);
  } catch (error) {
    console.error("Error fetching sub-product categories:", error);
    res.status(500).json({
      message: "Failed to fetch sub-product categories",
      error: error.message,
    });
  }
};

const createProduct = async (req, res) => {
  const {
    productName,
    productCategory,
    productSubcategory,
    productPrice,
    productImage,
    deviceused,
    ipused,
    companyId,
    location,
  } = req.body;

  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const createdby = decoded.username;

    if (!productName)
      return res.status(400).json({ message: "Product name is required" });
    if (!productCategory)
      return res.status(400).json({ message: "Product category is required" });
    if (!productSubcategory)
      return res
        .status(400)
        .json({ message: "Product subcategory is required" });
    if (!productPrice)
      return res.status(400).json({ message: "Product price is required" });
    if (!companyId)
      return res.status(400).json({ message: "Company ID is required" });
    if (!createdby)
      return res.status(400).json({ message: "Created by is required" });

    const createdDate = new Date(); // Get current date and time

    const result = await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[productCreation_table] 
          (productName, productCategory, productSubcategory, productPrice, productImage, createdDate, createdby, deviceused, ipused, companyId, location, availabilityStatus)
          VALUES (:productName, :productCategory, :productSubcategory, :productPrice, :productImage, :createdDate, :createdby, :deviceused, :ipused, :companyId, :location. :availabilityStatus)`,
      {
        replacements: {
          productName,
          productCategory,
          productSubcategory,
          productPrice,
          productImage,
          createdDate,
          createdby,
          deviceused,
          ipused,
          companyId,
          location,
          availabilityStatus:"Available"
        },
        type: QueryTypes.INSERT,
      }
    );

    res.status(201).json({
      message: "Product created successfully",
      productId: result[0],
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res
      .status(500)
      .json({ message: "Product creation failed", error: error.message });
  }
};

const getAllProducts = async (req, res) => {
  try {
    const products = await sequelize.query(
      `SELECT 
           sid,
           productName, 
           productCategory, 
           productSubcategory, 
           productPrice, 
           productImage, 
           createdDate, 
           createdby, 
           deviceused, 
           ipused, 
           companyId, 
           location,
           discountrate
         FROM [MoodLagos].[dbo].[productCreation_table] where availabilitystatus = 'Available'`,
      {
        type: QueryTypes.SELECT,
      }
    );

    if (products.length === 0) {
      return res.status(404).json({ message: "No products found" });
    }

    res.status(200).json({ products });
  } catch (error) {
    console.error("Error fetching products:", error);
    res
      .status(500)
      .json({ message: "Failed to retrieve products", error: error.message });
  }
};
const getAllGeneraProducts = async (req, res) => {
  try {
    const products = await sequelize.query(
      `SELECT 
           sid,
           productName, 
           productCategory, 
           productSubcategory, 
           productPrice, 
           productImage, 
           createdDate, 
           createdby, 
           deviceused, 
           ipused, 
           companyId, 
           location,
           discountrate
         FROM [MoodLagos].[dbo].[productCreation_table]`,
      {
        type: QueryTypes.SELECT,
      }
    );

    if (products.length === 0) {
      return res.status(404).json({ message: "No products found" });
    }

    res.status(200).json({ products });
  } catch (error) {
    console.error("Error fetching products:", error);
    res
      .status(500)
      .json({ message: "Failed to retrieve products", error: error.message });
  }
};

const updateProduct = async (req, res) => {
  const {
    sid,
    productName,
    productCategory,
    productSubcategory,
    location,
    productPrice,
    productImage,
  } = req.body;

  if (!sid) return res.status(400).json({ message: "sid is required" });

  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Authorization token is required" });
  }

  let username;
  try {
    const decodedToken = jwt.verify(token, process.env.JWT_KEY);
    username = decodedToken.username;
  } catch (error) {
    return res.status(401).json({ message: "Invalid token" });
  }

  try {
    const [existingProduct] = await sequelize.query(
      "SELECT * FROM [MoodLagos].[dbo].[productCreation_table] WHERE sid = :sid",
      {
        type: QueryTypes.SELECT,
        replacements: { sid },
      }
    );

    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    let updateFields;
    if (productImage) {
      updateFields = {
        productName,
        productCategory,
        productSubcategory,
        location,
        productPrice,
        productImage,
      };
    } else {
      updateFields = {
        productName,
        productCategory,
        productSubcategory,
        location,
        productPrice,
      };
    }

    const updateQuery = Object.keys(updateFields)
      .filter((key) => updateFields[key] !== undefined)
      .map((key) => `[${key}] = :${key}`)
      .join(", ");

    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[productCreation_table]
         SET ${updateQuery}
         WHERE sid = :sid`,
      {
        replacements: { ...updateFields, sid },
        type: QueryTypes.UPDATE,
      }
    );

    if (productPrice !== existingProduct.productPrice) {
      await sequelize.query(
        `INSERT INTO [MoodLagos].[dbo].[priceChange_table] 
           (productId, productName, productCategory, changeId, unitPrice, changeValue, companyId, username)
           VALUES (:sid, :productName, :productCategory, NEWID(), :productPrice, :changeValue, :companyId, :username)`,
        {
          replacements: {
            sid,
            productName: existingProduct.productName,
            productCategory: existingProduct.productCategory,
            productPrice,
            changeValue: productPrice - existingProduct.productPrice,
            companyId: "MDLAG001",
            username, // Insert the username from the token
          },
          type: QueryTypes.INSERT,
        }
      );
    }

    res.status(200).json({ message: "Product updated successfully" });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: "Update failed", error: error.message });
  }
};

const getPriceChanges = async (req, res) => {
  try {
    const priceChanges = await sequelize.query(
      `SELECT * FROM [MoodLagos].[dbo].[priceChange_table]`,
      {
        type: QueryTypes.SELECT,
      }
    );

    // Respond with the data
    res.status(200).json(priceChanges);
  } catch (error) {
    console.error("Error fetching price changes:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch price changes", error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  const { productName, productId } = req.body; // Assuming the productName or productId is provided

  if (!productName && !productId) {
    return res.status(400).json({ message: "Product name or ID is required" });
  }

  try {
    const productExists = await sequelize.query(
      `SELECT * FROM [MoodLagos].[dbo].[productCreation_table] WHERE productName = :productName OR sid = :productId`,
      {
        type: QueryTypes.SELECT,
        replacements: { productName, productId },
      }
    );

    if (productExists.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    // const transactionCheck = await sequelize.query(
    //   `SELECT TOP (1) [sid] FROM [MoodLagos].[dbo].[salesTransaction_table] WHERE productName = :productName OR productId = :productId`,
    //   {
    //     type: QueryTypes.SELECT,
    //     replacements: { productName, productId },
    //   }
    // );

    // if (transactionCheck.length > 0) {
    //   return res.status(400).json({
    //     message:
    //       "Product cannot be deleted because it is involved in sales transactions",
    //   });
    // }

    await sequelize.query(
      `DELETE FROM [MoodLagos].[dbo].[productCreation_table] WHERE productName = :productName OR sid = :productId`,
      {
        type: QueryTypes.DELETE,
        replacements: { productName, productId },
      }
    );

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res
      .status(500)
      .json({ message: "Failed to delete product", error: error.message });
  }
};

const getAllKitchenItems = async (req, res) => {
  try {
    const kitchenItems = await sequelize.query(
      `SELECT TOP (1000) [sid]
          ,[productName]
          ,[productCategory]
          ,[productSubcategory]
          ,[location]
          ,[productPrice]
          ,[productImage]
          ,[createdDate]
          ,[discountrate]
          ,[createdby]
          ,[availabilityStatus]
          ,[deviceused]
          ,[ipused]
          ,[companyId]
      FROM [MoodLagos].[dbo].[productCreation_table]
      WHERE location = :location`,
      {
        type: QueryTypes.SELECT,
        replacements: { location: "kitchen" },
      }
    );

    if (kitchenItems.length === 0) {
      return res
        .status(404)
        .json({ message: "No items found for location 'kitchen'" });
    }

    res.status(200).json(kitchenItems);
  } catch (error) {
    console.error("Error fetching kitchen items:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch kitchen items", error: error.message });
  }
};
const getAllBarItems = async (req, res) => {
  try {
    const kitchenItems = await sequelize.query(
      `SELECT TOP (1000) [sid]
          ,[productName]
          ,[productCategory]
          ,[productSubcategory]
          ,[location]
          ,[productPrice]
          ,[productImage]
          ,[createdDate]
          ,[discountrate]
          ,[createdby]
          ,[availabilityStatus]
          ,[deviceused]
          ,[ipused]
          ,[companyId]
      FROM [MoodLagos].[dbo].[productCreation_table]
      WHERE location = :location`,
      {
        type: QueryTypes.SELECT,
        replacements: { location: "bar" },
      }
    );

    if (kitchenItems.length === 0) {
      return res
        .status(404)
        .json({ message: "No items found for location 'bar'" });
    }

    res.status(200).json(kitchenItems);
  } catch (error) {
    console.error("Error fetching bar items:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch bar items", error: error.message });
  }
};
const getAllShishaItems = async (req, res) => {
  try {
    const kitchenItems = await sequelize.query(
      `SELECT TOP (1000) [sid]
          ,[productName]
          ,[productCategory]
          ,[productSubcategory]
          ,[location]
          ,[productPrice]
          ,[productImage]
          ,[createdDate]
          ,[discountrate]
          ,[createdby]
          ,[availabilityStatus]
          ,[deviceused]
          ,[ipused]
          ,[companyId]
      FROM [MoodLagos].[dbo].[productCreation_table]
      WHERE location = :location`,
      {
        type: QueryTypes.SELECT,
        replacements: { location: "shisha" },
      }
    );

    if (kitchenItems.length === 0) {
      return res
        .status(404)
        .json({ message: "No items found for location 'bar'" });
    }

    res.status(200).json(kitchenItems);
  } catch (error) {
    console.error("Error fetching bar items:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch bar items", error: error.message });
  }
};
const getAllItems = async (req, res) => {
  try {
    const kitchenItems = await sequelize.query(
      `SELECT TOP (1000) [sid]
          ,[productName]
          ,[productCategory]
          ,[productSubcategory]
          ,[location]
          ,[productPrice]
          ,[productImage]
          ,[createdDate]
          ,[discountrate]
          ,[createdby]
          ,[availabilityStatus]
          ,[deviceused]
          ,[ipused]
          ,[companyId]
      FROM [MoodLagos].[dbo].[productCreation_table]`,
      {
        type: QueryTypes.SELECT,
        replacements: { location: "shisha" },
      }
    );

    if (kitchenItems.length === 0) {
      return res
        .status(404)
        .json({ message: "No items found for location 'bar'" });
    }

    res.status(200).json(kitchenItems);
  } catch (error) {
    console.error("Error fetching all items:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch all items", error: error.message });
  }
};

const makeItemAvailable = async (req, res) => {
  const { productName } = req.body;

  if (!productName) {
    return res.status(400).json({ message: "Product name is required" });
  }

  try {
    const [updatedRows] = await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[productCreation_table]
       SET availabilityStatus = 'Available'
       WHERE productName = :productName`,
      {
        type: QueryTypes.UPDATE,
        replacements: { productName },
      }
    );

    if (updatedRows === 0) {
      return res.status(404).json({ message: "No matching product found" });
    }

    res.status(200).json({ message: "Product made available successfully" });
  } catch (error) {
    console.error("Error updating product availability:", error);
    res.status(500).json({
      message: "Failed to update product availability",
      error: error.message,
    });
  }
};
const makeItemUnavailable = async (req, res) => {
  const { productName } = req.body;

  if (!productName) {
    return res.status(400).json({ message: "Product name is required" });
  }

  try {
    const [updatedRows] = await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[productCreation_table]
       SET availabilityStatus = 'Unavailable'
       WHERE productName = :productName`,
      {
        type: QueryTypes.UPDATE,
        replacements: { productName },
      }
    );

    if (updatedRows === 0) {
      return res.status(404).json({ message: "No matching product found" });
    }

    res.status(200).json({ message: "Product made unavailable successfully" });
  } catch (error) {
    console.error("Error updating product availability:", error);
    res.status(500).json({
      message: "Failed to update product availability",
      error: error.message,
    });
  }
};

module.exports = {
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
  getAllGeneraProducts
};

// https://github.com/tammydufil/moodlagos.git
