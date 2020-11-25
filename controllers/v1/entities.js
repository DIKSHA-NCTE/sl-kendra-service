/**
 * name : entities.js
 * author : Aman Jung Karki
 * created-date : 19-Dec-2019
 * Description : All entities related information.
 */


/**
 * dependencies
 */

const entitiesHelper = require(MODULES_BASE_PATH + "/entities/helper.js");

/**
    * Entities
    * @class
*/

module.exports = class Entities extends Abstract {

    constructor() {
        super(schemas["entities"]);
    }

    /**
     * @apiDefine errorBody
     * @apiError {String} status 4XX,5XX
     * @apiError {String} message Error
     */

    /**
     * @apiDefine successBody
     *  @apiSuccess {String} status 200
     * @apiSuccess {String} result Data
     */


    static get name() {
        return "entities";
    }

    /**
     * @api {get} /kendra/api/v1/entities/listByEntityType/:entityType 
     * List of entities based on its type
     * @apiVersion 1.0.0
     * @apiGroup Entities
     * @apiHeader {String} X-authenticated-user-token Authenticity token
     * @apiSampleRequest /kendra/api/v1/entities/listByEntityType/state
     * @apiUse successBody
     * @apiUse errorBody
     * @apiParamExample {json} Response:
     * {
     * "message": "List of entities fetched successfully",
     * "status": 200,
     * "result": [
     *  {
            "externalId": "AP",
            "name": "Andhra Pradesh",
            "_id": "5e26c2b0d007227fb039d993"
        },
        {
            "externalId": "WB",
            "name": "West Bengal",
            "_id": "5e26c2b0d007227fb039d9a8"
        },
        {
            "externalId": "DL",
            "name": "Delhi",
            "_id": "5db173598a8e070bedca6ba1"
        }
    ]
  }

    */

    /**
      * List of entities based on its type.
      * @method
      * @name listByEntityType
      * @param  {Request} req request body.
      * @returns {JSON} Returns list of entities
     */

    listByEntityType(req) {
        
      return new Promise(async (resolve, reject) => {
    
          try {

            let entityDocuments = await entitiesHelper.listByEntityType(
              req.params._id,
              req.pageSize,
              req.pageNo
            );

            return resolve(entityDocuments);
    
          } catch (error) {
    
            return reject({
              status: error.status || httpStatusCode.internal_server_error.status,
              message: error.message || httpStatusCode.internal_server_error.message,
              errorObject: error
            })
    
          }
    
    
        })
    }


    /**
     * @api {post} /kendra/api/v1/entities/subEntityList/:entityId?type=:type&search=:search&page=:page&limit=:limit
     * Get sub entity list for the given entity. 
     * @apiVersion 1.0.0
     * @apiGroup Entities
     * @apiHeader {String} X-authenticated-user-token Authenticity token
     * @apiSampleRequest /kendra/api/v1/entities/subEntityList/5db173598a8e070bedca6ba1?type=school&search=r&page=1&limit=1
     * @apiUse successBody
     * @apiUse errorBody
     * @apiParamExample {json} Response:
     * {
     "message": "List of entities fetched successfully",
     "status": 200,
     "result": {
        "data": [
            {
                "_id": "5db1dd3e8a8e070bedca6bef",
                "entityType": "school",
                "name": "Sachdeva Convent School, Street No.-5 Sangam Vihar (Wazirabad - Jagatpur Road), Delhi",
                "externalId": "1207229",
                "addressLine1": "Street No.-5 Sangam Vihar (Wazirabad - Jagatpur Road)",
                "label": "Sachdeva Convent School, Street No.-5 Sangam Vihar (Wazirabad - Jagatpur Road), Delhi",
                "value": "5db1dd3e8a8e070bedca6bef"
            }
        ],
        "count": 6005
    }
  }
  }

    /**
      * Get the immediate entities .
      * @method
      * @name subEntityList
      * @param  {Request} req request body.
      * @returns {JSON} Returns list of immediate entities
     */

    subEntityList(req) {
        
      return new Promise(async (resolve, reject) => {

        if( !(req.params._id || req.body.entities) ) {
          return resolve({
            status :  httpStatusCode.bad_request.status,
            message : constants.apiResponses.ENTITY_ID_NOT_FOUND
          })
        }
    
          try {
            
            let entityDocuments = await entitiesHelper.subEntityList(
              req.body.entities ? req.body.entities : "",
              req.params._id ? req.params._id : "",
              req.query.type ? req.query.type : "",
              req.searchText,
              req.pageSize,
              req.pageNo
            );
            
            if(entityDocuments.result && entityDocuments.result.data && Array.isArray(entityDocuments.result.data) && entityDocuments.result.data.length > 0) {
              for (let pointerToEntitiesArray = 0; pointerToEntitiesArray < entityDocuments.result.data.length; pointerToEntitiesArray++) {
                if(entityDocuments.result.data[pointerToEntitiesArray].entityType == "school") {
                  entityDocuments.result.data[pointerToEntitiesArray].label += " - " + entityDocuments.result.data[pointerToEntitiesArray].externalId;
                }
              }
            }

            return resolve(entityDocuments);
    
          } catch (error) {
    
            return reject({
              status: error.status || httpStatusCode.internal_server_error.status,
              message: error.message || httpStatusCode.internal_server_error.message,
              errorObject: error
            })
    
          }
    
    
        })
    }

     /**
     * @api {get} /kendra/api/v1/entities/details/:entityId
     * Get entities details information
     * @apiVersion 1.0.0
     * @apiGroup Entities
     * @apiHeader {String} X-authenticated-user-token Authenticity token
     * @apiSampleRequest /kendra/api/v1/entities/details/5db173598a8e070bedca6ba1
     * @apiUse successBody
     * @apiUse errorBody
     * @apiParamExample {json} Response:
     * {
     * "message": "Entity information fetched successfully",
     * "status": 200,
     * "result": {
        "_id": "5db173598a8e070bedca6ba1",
        "entityTypeId": "5d7a290e6371783ceb11064c",
        "entityType": "state",
        "metaInformation": {
            "externalId": "DL",
            "name": "Delhi",
            "region": "NORTH",
            "capital": "NEW DELHI"
        },
        "updatedBy": "2be2fd94-f25e-4402-8e36-20907b45c650",
        "createdBy": "2be2fd94-f25e-4402-8e36-20907b45c650",
        "updatedAt": "2019-10-24T10:16:44.833Z",
        "createdAt": "2019-10-24T09:48:09.005Z"
      }
    }

     /**
      * Entity details.
      * @method
      * @name details
      * @param {Object} req - requested entity information.
      * @param {String} req.params._id - entity id
      * @returns {JSON} - Entity details information.
    */

    details(req) {
      
      return new Promise(async (resolve, reject) => {
        
        try {
          
          let result = await entitiesHelper.details(
            req.params._id
          );
          
          return resolve(result);
        
        } catch (error) {
          
          return reject({
            status: error.status || httpStatusCode.internal_server_error.status,
            message: error.message || httpStatusCode.internal_server_error.message,
            errorObject: error
          })
        }
      })
    }

     /**
  * @api {get} /kendra/api/v1/entities/listByEntityIds
  * List entities.
  * @apiVersion 1.0.0
  * @apiName List entities
  * @apiGroup Entities
  * @apiSampleRequest /kendra/api/v1/entities/listByEntityIds
  * @param {json} Request-Body:
  * {
  * "entities" : ["5beaa888af0065f0e0a10515"],
    "fields" : ["entityType"]
    }
  * @apiUse successBody
  * @apiUse errorBody
  * @apiParamExample {json} Response:
  * {
    "message" : "List of entities fetched successfully",
    "status" : 200,
    "result" : [
        {
            "_id" : "5beaa888af0065f0e0a10515",
            "entityType": "school"
        }
    ]
  }
  */

    /**
   * List of entities.
   * @method
   * @name find
   * @param {Object} req - requested data.
   * @param {String} req.params._id - requested entity type.         
   * @returns {JSON} - Array of entities.
   */

  listByEntityIds(req) {
    return new Promise(async (resolve, reject) => {

      try {

        const entities = await entitiesHelper.listByEntityIds(req.body);
        return resolve(entities);

      } catch (error) {

        return reject({
          status : error.status || httpStatusCode.internal_server_error.status,
          message : error.message || httpStatusCode.internal_server_error.message,
          errorObject : error
        })

      }


    })
  }

    /**
    * @api {get} /kendra/api/v1/entities/subEntitiesRoles/:entityId
    * Get roles based on entity type.
    * @apiVersion 1.0.0
    * @apiGroup Entities
    * @apiHeader {String} X-authenticated-user-token Authenticity token
    * @apiSampleRequest /kendra/api/v1/entities/subEntitiesRoles/5da829874c67d63cca1bd9d0
    * @apiUse successBody
    * @apiUse errorBody
    * @apiParamExample {json} Response:
    * {
    "message": "Successfully fetched user roles",
    "status": 200,
    "result": [
        {
            "_id": "5d6e521066a9a45df3aa891e",
            "code": "HM",
            "title": "Headmaster"
        },
        {
            "_id": "5d6e521066a9a45df3aa891f",
            "code": "CRP",
            "title": "Cluster Resource Person"
        },
        {
            "_id": "5d6e521066a9a45df3aa8920",
            "code": "BEO",
            "title": "Block Education Officer"
        },
        {
            "_id": "5d6e521066a9a45df3aa8921",
            "code": "DEO",
            "title": "District Education Officer"
        }
    ]
    }
    */

   subEntitiesRoles(req) {
    return new Promise(async (resolve, reject) => {

      try {

        const subEntityRoles = await entitiesHelper.subEntitiesRoles(req.params._id);
       
        resolve(subEntityRoles);

      } catch (error) {

        return reject({
          status:
            error.status ||
            httpStatusCode["internal_server_error"].status,

          message:
            error.message ||
            httpStatusCode["internal_server_error"].message
        });
      }
    });
  }

        /**
    * @api {get} /kendra/api/v1/entities/childHierarchyPath/:entityId
    * Get entities child hierarchy path.
    * @apiVersion 1.0.0
    * @apiGroup Entities
    * @apiHeader {String} X-authenticated-user-token Authenticity token
    * @apiSampleRequest /kendra/api/v1/entities/childHierarchyPath/5da829874c67d63cca1bd9d0
    * @apiUse successBody
    * @apiUse errorBody
    * @apiParamExample {json} Response:
    * {
    "message": "Entities child hierarchy path fetched successfully",
    "status": 200,
    "result": [
        "district",
        "block",
        "cluster",
        "school"
    ]
  }
    */

   childHierarchyPath(req) {
    return new Promise(async (resolve, reject) => {

      try {

        const childHierarchyData = await entitiesHelper.childHierarchyPath(req.params._id);
       
        resolve(childHierarchyData);

      } catch (error) {

        return reject({
          status:
            error.status ||
            httpStatusCode["internal_server_error"].status,

          message:
            error.message ||
            httpStatusCode["internal_server_error"].message
        });
      }
    });
  }
  
};

