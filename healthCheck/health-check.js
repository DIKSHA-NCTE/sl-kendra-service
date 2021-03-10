/**
 * name : healthCheckService.js.
 * author : Aman Karki.
 * created-date : 02-Feb-2021.
 * Description : Health check service helper functionality.
*/

// Dependencies

const { v1 : uuidv1 } = require('uuid');
const assessmentHealthCheck = require("./assessments");
const sunbirdHealthCheck = require("./sunbird");
const mongodbHealthCheck = require("./mongodb");
const kafkaHealthCheck = require("./kafka");
const elasticSearchHealthCheck = require("./elastic-search");
const gotenbergHealthCheck = require("./gotenberg");

const obj = {
    MONGO_DB: {
        NAME: 'Mongo.db',
        FAILED_CODE: 'MONGODB_HEALTH_FAILED',
        FAILED_MESSAGE: 'Mongo db is not connected'
    },
    KAFKA: {
        NAME: 'kafka',
        FAILED_CODE: 'KAFKA_HEALTH_FAILED',
        FAILED_MESSAGE: 'Kafka is not connected'
    },
    ASSESSMENT_SERVICE: {
      NAME: 'assessmentservice.api',
      FAILED_CODE: 'ASSESSMENT_SERVICE_HEALTH_FAILED',
      FAILED_MESSAGE: 'ASSessment service is not healthy'
    },
    SUNBIRD_SERVICE: {
        NAME: 'sunbirdservice.api',
        FAILED_CODE: 'SUNBIRD_SERVICE_HEALTH_FAILED',
        FAILED_MESSAGE: 'sunbird service is not healthy'
    },
    ELASTIC_SEARCH : {
        NAME: 'ElasticSearch.db',
        FAILED_CODE: 'ELASTIC_SEARCH_HEALTH_FAILED',
        FAILED_MESSAGE: 'Elastic search is not connected'
    },
    GOTENBERG : {
        NAME: 'Gotenberg',
        FAILED_CODE: 'GOTENBERG_HEALTH_FAILED',
        FAILED_MESSAGE: 'Gotenberg service is not healthy'
    },
    NAME: 'KendraServiceHealthCheck',
    API_VERSION: '1.0'
}

let health_check = async function(req,res) {

    let checks = [];
    let mongodbConnection = await mongodbHealthCheck.health_check();
    let kafkaConnection = await kafkaHealthCheck.health_check();
    let assessmentServiceStatus = await assessmentHealthCheck.health_check();
    let sunbirdServiceStatus = await sunbirdHealthCheck.health_check();
    let elasticSearchConnection = await elasticSearchHealthCheck.health_check();
    let gotenbergStatus = await gotenbergHealthCheck.health_check();

    checks.push(checkResult("KAFKA",kafkaConnection));
    checks.push(checkResult("MONGO_DB",mongodbConnection));
    checks.push(checkResult("ASSESSMENT_SERVICE",assessmentServiceStatus));
    checks.push(checkResult("SUNBIRD_SERVICE",sunbirdServiceStatus));
    checks.push(checkResult("ELASTIC_SEARCH",elasticSearchConnection));
    checks.push(checkResult("GOTENBERG",gotenbergStatus));

    let checkServices = checks.filter( check => check.healthy === false);

    let result = {
        name : obj.NAME,
        version : obj.API_VERSION,
        healthy : checkServices.length > 0 ? false : true,
        checks : checks
    };

    let responseData = response(req,result);
    res.status(200).json(responseData);
}

let checkResult = function( serviceName,isHealthy ) {
    return {
        name : obj[serviceName].NAME,
        healthy : isHealthy,
        err : !isHealthy ?  obj[serviceName].FAILED_CODE : "",
        errMsg : !isHealthy ? obj[serviceName].FAILED_MESSAGE : ""
    }
}

let healthCheckStatus = function(req,res) {
    let responseData = response(req);
    res.status(200).json(responseData);
}

let response = function ( req,result = {} ) {
    return {
        "id" : "kendraService.Health.API",
        "ver" : "1.0",
        "ts" : new Date(),
        "params" : {
            "resmsgid" : uuidv1(),
            "msgid" : req.headers['msgid'] || req.headers.msgid || uuidv1(),
            "status" : "successful",
            "err" : "null",
            "errMsg" : "null"
        },
        "status" : 200,
        result : result
    }
}

module.exports = {
    healthCheckStatus : healthCheckStatus,
    health_check : health_check
}