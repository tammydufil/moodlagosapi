const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
const app = express();
const port = process.env.PORT || 3007;
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json());
app.use(cors());

const authenticationRoute = require("./routes/generalRoutes/authenticationRoute");
const productRoute = require("./routes/adminRoutes/productRoute");
const salesRoute = require("./routes/salesRoutes/salesRoute");
const taxroute = require("./routes/taxAndDiscountRoute/taxRoute");
const reportDashboardROute = require("./routes/Reportroute/dashboardRoute");

app.use("/moodlagosapi/api/", authenticationRoute);
app.use("/moodlagosapi/api/", productRoute);
app.use("/moodlagosapi/api/", salesRoute);
app.use("/moodlagosapi/api/", taxroute);
app.use("/moodlagosapi/api/", reportDashboardROute);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
