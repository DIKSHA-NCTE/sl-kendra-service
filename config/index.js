/**
 * Project          : Shikshalokam-Kendra
 * Module           : Configuration
 * Source filename  : index.js
 * Description      : Environment related configuration variables
 */

/**
  * Database configuration.
  * @function
  * @name db_connect
  * @param {Object} configData  - database configuration.
*/

let db_connect = function (configData) {
  global.database = require(process.env.PATH_TO_DB_CONFIG)(
    configData.db.connection.mongodb
  );
  global.ObjectId = database.ObjectId;
  global.Abstract = require(process.env.PATH_TO_ABSTRACT_FILE);
};

/**
  * Cassandra Database configuration.
  * @function
  * @name db_connect
  * @param {Object} cassandraConfigurationData  - configuration data for cassandra.
*/

let cassandra_connect = function (cassandraConfigurationData) {
  global.cassandraDatabase = require("./db/cassandra")(cassandraConfigurationData);
  if( !global.Abstract ){
    global.Abstract = require(process.env.PATH_TO_ABSTRACT_FILE);
  }
};

/**
  * kafka configuration.
  * @function
  * @name kafka_connect
  * @param {Object} configData  - kafka configuration.
*/

let kafka_connect = function (configData) {
  global.kafkaConnectionObject = require(process.env.PATH_TO_KAFKA_CONFIG)(
    configData.kafkaConfig
  );
};

/**
  * Elastic search configuration.
  * @function
  * @name elasticsearch_connect
  * @param {Object} configData  - elastic search configuration.
*/

let elasticsearch_connect = function (configData) {
  global.elasticsearch = require(process.env.PATH_TO_ELASTIC_SEARCH_CONFIG)(
    configData.elasticSearchConfig
  );
};

/**
  * Smtp configuration.
  * @function
  * @name smtp_connect
  * @param {Object} smtpConfigdata  - smtp configuration.
*/

let smtp_connect = function (smtpConfigdata) {
  global.smtpServer = require(process.env.PATH_TO_SMTP_CONFIG)(
    smtpConfigdata
  );
};

const configuration = {
  root: require("path").normalize(__dirname + "/.."),
  app: {
    name: process.env.appName
  },
  host: process.env.HOST || process.env.DEFAULT_HOST,
  port: process.env.PORT || process.env.DEFAULT_PORT,
  log: process.env.LOG || process.env.DEFAULT_LOG,
  db: {
    connection: {
      mongodb: {
        host: process.env.MONGODB_URL || process.env.DEFAULT_MONGODB_HOST,
        user: "",
        pass: "",
        database: process.env.DB || process.env.DEFAULT_MONGODB_DATABASE,
        options: {
          useNewUrlParser: true
        }
      }, 
      cassandra: {
        host: process.env.CASSANDRA_HOST,
        port:process.env.CASSANDRA_PORT,
        keyspace: process.env.CASSANDRA_DB,
      }
 
    },
    plugins: {
      timestamps: true,
      elasticSearch: false,
      softDelete: true,
      autoPopulate: false,
      timestamps_fields: {
        createdAt: "createdAt",
        updatedAt: "updatedAt"
      }
    }
  },
  kafkaConfig: {
    host: process.env.KAFKA_URL,
    topics: {
      notificationsTopic: 
      process.env.NOTIFICATIONS_TOPIC || 
      process.env.DEFAULT_NOTIFICATION_TOPIC,

      languagesTopic: 
      process.env.LANGUAGE_TOPIC || 
      process.env.DEFAULT_LANGUAGES_TOPIC,

      emailTopic: 
      process.env.EMAIL_TOPIC || 
      process.env.DEFAULT_EMAIL_TOPIC,

      appConfigTopic: 
      process.env.APPLICATION_CONFIG_TOPIC || 
      process.env.DEFAULT_APPLICATION_CONFIG_TOPIC

    }
  },
  elasticSearchConfig: {
    host: 
    process.env.ELASTICSEARCH_HOST_URL || 
    process.env.DEFAULT_ELASTIC_SEARCH_HOST
  },
  smtpConfig: {
    host: process.env.SMTP_SERVICE_HOST,
    port: process.env.SMTP_SERVICE_PORT,
    secure: process.env.SMTP_SERVICE_SECURE,
    user: process.env.SMTP_USER_NAME,
    password: process.env.SMTP_USER_PASSWORD,
  },
  version: process.env.VERSION,
  URLPrefix: process.env.URL_PREFIX,
  webUrl: process.env.WEB_URL
};

db_connect(configuration);
// cassandra_connect(configuration.db.connection.cassandra);

kafka_connect(configuration);

// elasticsearch_connect(configuration);

smtp_connect(configuration.smtpConfig);

module.exports = configuration;
