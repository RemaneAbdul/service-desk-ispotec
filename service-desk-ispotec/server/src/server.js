const app = require("./app");
const fs = require("fs");
const path = require("path");
const port = Number(process.env.PORT || 3000);
fs.mkdirSync(path.join(__dirname, "../uploads"), { recursive: true });
app.listen(port, () => console.log(`Service Desk ISPOTEC: http://localhost:${port}`));
