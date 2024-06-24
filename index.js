const express = require('express');
const app = express();
const port = process.env.PORT || 9003;

app.use(express.json());

app.use(require("./routes/indentify"));

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});