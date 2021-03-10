/**
 * name : app.js
 * author : Aman Jung Karki
 * created-date : 09-Dec-2019
 * Description : Root file.
 */

require("dotenv").config();

//express
const express = require("express");
let app = express();

// Health check
require("./healthCheck")(app);

global.config = require("./config");
require("./config/globals")();
require("./generics/scheduler");

let router = require("./routes");

//required modules
const fileUpload = require("express-fileupload");
const bodyParser = require("body-parser");
const cors = require("cors");
var fs = require("fs");
var path = require("path");
var expressValidator = require('express-validator');

//To enable cors
app.use(cors());
app.use(expressValidator())

//health check
app.get(process.env.HEALTH_CHECK_URL, (req, res) => {
  res.send("pong!");
});

app.use(fileUpload());
app.use(bodyParser.json({ limit: process.env.BODY_PARSER_LIMIT }));
app.use(bodyParser.urlencoded({ 
  limit: process.env.BODY_PARSER_LIMIT, 
  extended: false 
}));
app.use(express.static("public"));

fs.existsSync(process.env.LOGGER_DIRECTORY) || 
fs.mkdirSync(process.env.LOGGER_DIRECTORY);

const serviceBaseUrl = process.env.APPLICATION_BASE_URL || 
process.env.DEFAULT_APPLICATION_BASE_URL;

const observationSubmissionHtmlPath = 
process.env.OBSERVATION_SUBMISSIONS_HTML_PATH ? 
process.env.OBSERVATION_SUBMISSIONS_HTML_PATH : 
process.env.DEFAULT_OBSERVATION_SUBMISSIONS_HTML_PATH;

const observationSubmissionUrl = 
serviceBaseUrl + observationSubmissionHtmlPath + "/*"

app.use(express.static(observationSubmissionHtmlPath));

app.get(observationSubmissionUrl, (req, res) => {
  let urlArray = req.path.split("/")
  urlArray.splice(0, 3)

  const filePath = 
  "/public/" + observationSubmissionHtmlPath + "/" + urlArray.join("/");

  res.sendFile(path.join(__dirname, filePath));
});

//API documentation (apidoc)
if (process.env.NODE_ENV == "development" || process.env.NODE_ENV == "local") {
  app.use(express.static("apidoc"));
  if (process.env.NODE_ENV == "local") {
    app.get(process.env.DEFAULT_APIDOC_URL, (req, res) => {
      let apidocPath =  process.env.APIDOC_PATH + "/index.html";

      res.sendFile(path.join(__dirname, apidocPath));
    });
  } else {
    app.get(process.env.APIDOC_URL, (req, res) => {
      let urlArray = req.path.split("/");
      urlArray.splice(0, 3);
      let apidocPath = process.env.APIDOC_PATH + urlArray.join("/");

      res.sendFile(path.join(__dirname, apidocPath));
    });
  }
}

app.all(process.env.ALL_ROUTES, (req, res, next) => {
  if(ENABLE_DEBUG_LOGGING === "ON") {
    logger.info("Requests:", {
      method: req.method,
      url: req.url,
      headers: req.headers,
      body: req.body
    })
  }

  next();
});

//add routing
router(app);

//listen to given port
app.listen(config.port, () => {

  logger.info("Environment: " +
    (process.env.NODE_ENV ? process.env.NODE_ENV : process.env.DEFAULT_NODE_ENV));

  logger.info("Application is running on the port:" + config.port);

});

module.exports = app;