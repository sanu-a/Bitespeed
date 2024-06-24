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
      return res
        .status(400)
        .json({ error: true, success: false, message: `${err.message}` });
    }
    return res
      .status(400)
      .json({ error: true, success: false, message: "Internal server error!", msg: err.message });
  }
});

module.exports = route;
