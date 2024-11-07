const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const { QueryTypes } = require("sequelize");
const { sequelize } = require("../../models/index");

const JWT_SECRET = process.env.JWT_KEY;

const register = async (req, res) => {
  const {
    username,
    firstname,
    lastname,
    usercode,
    userpassword,
    userrole,
    companyId,
    image,
    selectedModules,
    deviceused,
    ipused,
  } = req.body;

  // Destructure selectedModules to include all manage fields
  const {
    orderManage,
    BarManage,
    Kitchenmanage,
    reportmanage,
    auditManage,
    Shishamanage,
    cashiermanage,
    viewordersmanage,
    specialdiscountmanage,
    tablemanage,
    discountmanage,
    productmanage,
    accountmanage,
    taxmanage,
    manageuserorders,
  } = selectedModules;

  // Validate required fields
  if (!firstname)
    return res.status(400).json({ message: "Firstname is required" });
  if (!lastname)
    return res.status(400).json({ message: "Lastname is required" });
  if (!username)
    return res.status(400).json({ message: "Employee Id is required" });
  if (!userpassword)
    return res.status(400).json({ message: "Password is required" });
  if (!userrole)
    return res.status(400).json({ message: "User role is required" });
  if (!companyId)
    return res.status(400).json({ message: "Company ID is required" });

  try {
    const userExists = await sequelize.query(
      "SELECT * FROM [MoodLagos].[dbo].[userCreation_table] WHERE username = :username",
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    if (userExists.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(userpassword, 10);

    // Get the current date from the server
    const currentDate = new Date();

    // Insert the user into the database
    await sequelize.query(
      `INSERT INTO [MoodLagos].[dbo].[userCreation_table] 
               (username, usercode, userpassword, userrole, firstname, lastname, BarManage, orderManage, auditManage, 
               Kitchenmanage, reportmanage, cashiermanage, viewordersmanage, specialdiscountmanage, tablemanage, 
               discountmanage, productmanage, accountmanage, datecreated, usercreated, companyId, image, 
               deviceused, ipused, status, Shishamanage, taxmanage, manageuserorders) 
               VALUES (:username, :usercode, :userpassword, :userrole, :firstname, :lastname, :BarManage, :orderManage, 
               :auditManage, :Kitchenmanage, :reportmanage, :cashiermanage, :viewordersmanage, :specialdiscountmanage, 
               :tablemanage, :discountmanage, :productmanage, :accountmanage, :datecreated, :usercreated, :companyId, 
               :image, :deviceused, :ipused, :status, :Shishamanage, :taxmanage, :manageuserorders)`,
      {
        replacements: {
          username,
          usercode,
          userpassword: hashedPassword,
          userrole,
          firstname,
          lastname,
          BarManage,
          orderManage,
          auditManage,
          Kitchenmanage,
          reportmanage,
          cashiermanage,
          viewordersmanage,
          specialdiscountmanage,
          tablemanage,
          discountmanage,
          productmanage,
          accountmanage,
          datecreated: currentDate,
          usercreated: currentDate,
          companyId,
          image,
          deviceused,
          ipused,
          status: "Active",
          Shishamanage,
          taxmanage,
          manageuserorders,
        },
        type: QueryTypes.INSERT,
      }
    );

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ message: "Registration failed", error: error.message });
  }
};

const login = async (req, res) => {
  const { username, userpassword } = req.body;

  if (!username)
    return res.status(400).json({ message: "Username is required" });
  if (!userpassword)
    return res.status(400).json({ message: "Password is required" });

  try {
    const user = await sequelize.query(
      `SELECT * FROM [MoodLagos].[dbo].[userCreation_table] 
         WHERE username = :username`,
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    if (user.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordValid = await bcrypt.compare(
      userpassword,
      user[0].userpassword
    );

    console.log(isPasswordValid);

    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (user[0].status !== "Active") {
      return res
        .status(400)
        .json({ message: "Account disabled, contact Admin" });
    }

    const token = jwt.sign(
      {
        sid: user[0].sid,
        username: user[0].username,
        userrole: user[0].userrole,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res
      .status(200)
      .json({ message: "Login successful", token, userDetails: user[0] });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

const updateUser = async (req, res) => {
  const {
    username,
    firstname,
    lastname,
    usercode,
    userpassword,
    userrole,
    companyId,
    image,
    selectedModules,
    deviceused,
    ipused,
    status,
  } = req.body;

  // Destructure all manage fields from selectedModules
  const {
    orderManage,
    BarManage,
    Kitchenmanage,
    reportmanage,
    auditManage,
    Shishamanage,
    cashiermanage,
    viewordersmanage,
    specialdiscountmanage,
    tablemanage,
    discountmanage,
    productmanage,
    accountmanage,
    taxmanage,
    manageuserorders,
  } = selectedModules;

  if (!username)
    return res.status(400).json({ message: "Username is required" });
  if (!usercode)
    return res.status(400).json({ message: "User code is required" });
  if (!firstname)
    return res.status(400).json({ message: "Firstname is required" });
  if (!lastname)
    return res.status(400).json({ message: "Lastname is required" });
  if (!userrole)
    return res.status(400).json({ message: "User role is required" });
  if (!companyId)
    return res.status(400).json({ message: "Company ID is required" });

  try {
    // Ensure the user exists
    const userExists = await sequelize.query(
      "SELECT * FROM [MoodLagos].[dbo].[userCreation_table] WHERE username = :username AND usercode = :usercode",
      {
        type: QueryTypes.SELECT,
        replacements: { username, usercode },
      }
    );

    if (userExists.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Prepare the fields to update
    const updateFields = {
      firstname,
      lastname,
      userrole,
      companyId,
      image,
      deviceused,
      ipused,
      orderManage,
      BarManage,
      Kitchenmanage,
      reportmanage,
      auditManage,
      status,
      Shishamanage,
      cashiermanage,
      viewordersmanage,
      specialdiscountmanage,
      tablemanage,
      discountmanage,
      productmanage,
      accountmanage,
      taxmanage,
      manageuserorders,
    };

    // Hash password if provided
    if (userpassword) {
      const hashedPassword = await bcrypt.hash(userpassword, 10);
      updateFields.userpassword = hashedPassword;
    }

    const updateQuery = Object.keys(updateFields)
      .filter((key) => updateFields[key] !== undefined) // Ignore fields with undefined values
      .map((key) => `[${key}] = :${key}`)
      .join(", ");

    await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[userCreation_table]
         SET ${updateQuery}
         WHERE username = :username AND usercode = :usercode`,
      {
        replacements: { ...updateFields, username, usercode },
        type: QueryTypes.UPDATE,
      }
    );

    res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({ message: "Update failed", error: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await sequelize.query(
      "SELECT * FROM [MoodLagos].[dbo].[userCreation_table]",
      {
        type: QueryTypes.SELECT,
      }
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }

    res.status(200).json({ users });
  } catch (error) {
    console.log("Get all users error:", error);
    res
      .status(403)
      .json({ message: "Failed to retrieve users", error: error.message });
  }
};

const deleteUser = async (req, res) => {
  const { username, usercode } = req.body;

  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }

  try {
    const userExists = await sequelize.query(
      `SELECT * FROM [MoodLagos].[dbo].[userCreation_table] WHERE username = :username`,
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    if (userExists.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userId = userExists[0].username;

    const transactionCheck = await sequelize.query(
      `SELECT TOP (1) [sid] FROM [MoodLagos].[dbo].[salesTransaction_table] WHERE username = :username`,
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    if (transactionCheck.length > 0) {
      return res.status(400).json({
        message:
          "User cannot be deleted because they are involved in sales transactions",
      });
    }

    await sequelize.query(
      `DELETE FROM [MoodLagos].[dbo].[userCreation_table] WHERE username = :userId`,
      {
        type: QueryTypes.DELETE,
        replacements: { userId },
      }
    );

    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res
      .status(500)
      .json({ message: "Failed to delete user", error: error.message });
  }
};

const getActiveModules = async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }

  try {
    // Query to get the user with active modules
    const user = await sequelize.query(
      `SELECT 
          orderManage,
          BarManage,
          Kitchenmanage,
          Shishamanage,
          reportmanage,
          cashiermanage,
          viewordersmanage,
          specialdiscountmanage,
          tablemanage,
          discountmanage,
          productmanage,
          accountmanage,
          auditManage,
          taxmanage,
          manageuserorders
      FROM [MoodLagos].[dbo].[userCreation_table]
      WHERE username = :username`,
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filter only the modules that are active (equal to "1" or true)
    const activeModules = Object.keys(user[0]).filter(
      (key) => user[0][key] === "1" || user[0][key] === true
    );

    if (activeModules.length === 0) {
      return res
        .status(200)
        .json({ message: "No active modules found for this user." });
    }

    res.status(200).json({
      message: `Active modules for user ${username}`,
      activeModules,
    });
  } catch (error) {
    console.error("Error fetching active modules:", error);
    res
      .status(500)
      .json({ message: "Error fetching active modules", error: error.message });
  }
};

const getUnreadNotifications = async (req, res) => {
  try {
    // Extract the token from the Authorization header
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) { 
      return res.status(401).json({ message: "No token provided" });
    }

    // Decode the token to get the username
    const decoded = jwt.verify(token, process.env.JWT_KEY);
    const { username } = decoded;

    if (!username) {
      return res.status(401).json({ message: "Invalid token" });
    }

    // Query the user table to get the user's roles
    const user = await sequelize.query(
      `SELECT cashiermanage, specialdiscountmanage, BarManage, Kitchenmanage, Shishamanage, orderManage,  manageuserorders 
      FROM [MoodLagos].[dbo].[userCreation_table]
      WHERE username = :username`,
      {
        type: QueryTypes.SELECT,
        replacements: { username },
      }
    );

    if (user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const {
      cashiermanage,
      specialdiscountmanage,
      BarManage,
      Kitchenmanage,
      Shishamanage,
      orderManage,
      manageuserorders,
    } = user[0];

    let queryConditions = [];
    let replacements = { username }; // Replacements for the query

    // Build query conditions based on the user's roles
    if (cashiermanage === "1") {
      queryConditions.push("location = 'cashier' AND isread = 0");
    }
    if (specialdiscountmanage === "1") {
      queryConditions.push("location = 'specialdiscount' AND isread = 0");
    }
    if (BarManage === "1") {
      queryConditions.push("location = 'bar' AND isread = 0");
    }
    if (Kitchenmanage === "1") {
      queryConditions.push("location = 'kitchen' AND isread = 0");
    }
    if (Shishamanage === "1") {
      queryConditions.push("location = 'SHISHA' AND isread = 0");
    }
    if (manageuserorders === "1") {
      queryConditions.push("location = 'orderitemsmanage' AND isread = 0");
    }
    if (orderManage === "1") {
      queryConditions.push(
        "location = 'order' AND username = :username AND isread = 0"
      );
    }

    // If no roles matched, return an empty response
    if (queryConditions.length === 0) {
      return res.status(403).json({ message: "No management permissions" });
    }

    // Combine all query conditions with OR
    const whereClause = queryConditions.join(" OR ");

    // Fetch unread notifications based on the user's roles
    const notifications = await sequelize.query(
      `SELECT * FROM [MoodLagos].[dbo].[notifications] WHERE ${whereClause}`,
      {
        type: QueryTypes.SELECT,
        replacements,
      }
    );

    return res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching unread notifications:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const markNotificationAsRead = async (req, res) => {
  const { notificationId } = req.body;

  if (!notificationId) {
    return res.status(400).json({ message: "Notification ID is required" });
  }

  try {
    const [results, metadata] = await sequelize.query(
      `UPDATE [MoodLagos].[dbo].[notifications]
      SET isread = 1
      WHERE sid = :notificationId`,
      {
        replacements: { notificationId },
      }
    );

    if (results[0] === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.status(200).json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  const { sids } = req.body;

  // Check if sids is provided and is an array
  if (!Array.isArray(sids) || sids.length === 0) {
    return res
      .status(400)
      .json({ message: "An array of notification IDs is required" });
  }

  try {
    // Use Promise.all to execute updates in parallel
    const updatePromises = sids.map(async (sid) => {
      return await sequelize.query(
        `UPDATE [MoodLagos].[dbo].[notifications]
        SET isread = 1
        WHERE sid = :sid`,
        {
          replacements: { sid },
        }
      );
    });

    // Await all promises to complete
    const results = await Promise.all(updatePromises);

    // Count how many notifications were updated
    const updatedCount = results.length;

    return res
      .status(200)
      .json({ message: `${updatedCount} notifications marked as read` });
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  login,
  register,
  updateUser,
  getAllUsers,
  deleteUser,
  getActiveModules,
  getUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};
