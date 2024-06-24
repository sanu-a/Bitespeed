const route = require("express").Router();

const { identifyContact } = require("../helpers/identify");

function MyError(message) {
  this.message = message;
}

MyError.prototype = new Error();

route.post("/identify", async (req, res) => {
  try {
    const result = await identifyContact(req.body, MyError);
    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof MyError) {
      return res.status(400).json({ message: `${err.message}` });
    }
    return res.status(400).json({ message: "failed" });
  }
});

module.exports = route;
