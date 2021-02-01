/**
 * name : helper.js
 * author : Aman
 * created-date : 03-sep-2020
 * Description : Solution related helper functionality.
 */

// Dependencies

const programsHelper = require(MODULES_BASE_PATH + "/programs/helper");
const entityTypesHelper = require(MODULES_BASE_PATH + "/entityTypes/helper");
const entitiesHelper = require(MODULES_BASE_PATH + "/entities/helper");
const userRolesHelper = require(MODULES_BASE_PATH + "/user-roles/helper");

/**
    * SolutionsHelper
    * @class
*/
module.exports = class SolutionsHelper {

    /**
   * Solution Data
   * @method
   * @name solutionDocuments
   * @param {Array} [filterQuery = "all"] - solution ids.
   * @param {Array} [fieldsArray = "all"] - projected fields.
   * @param {Array} [skipFields = "none"] - field not to include
   * @returns {Array} List of solutions. 
   */
  
  static solutionDocuments(
    filterQuery = "all", 
    fieldsArray = "all",
    skipFields = "none"
  ) {
    return new Promise(async (resolve, reject) => {
        try {
    
            let queryObject = (filterQuery != "all") ? filterQuery : {};
    
            let projection = {}
    
            if (fieldsArray != "all") {
                fieldsArray.forEach(field => {
                    projection[field] = 1;
                });
            }

            if( skipFields !== "none" ) {
              skipFields.forEach(field=>{
                projection[field] = 0;
              })
            }
    
            let solutionDocuments = 
            await database.models.solutions.find(
              queryObject, 
              projection
            ).lean();
            
            return resolve(solutionDocuments);
            
        } catch (error) {
            return reject(error);
        }
    });
  }

  /**
   * Create solution.
   * @method create
   * @name create
   * @param {Object} data - solution creation data.
   * @returns {JSON} solution creation data. 
   */
  
  static create(data) {
    return new Promise(async (resolve, reject) => {
        try {
    
            let solutionData = 
            await database.models.solutions.create(
              data
            );
            
            return resolve(solutionData);
            
        } catch (error) {
            return reject(error);
        }
    });
  }

     /**
   * Create solution.
   * @method 
   * @name createSolution
   * @param {Object} solutionData - solution creation data.
   * @returns {JSON} solution creation data. 
   */
  
  static createSolution(solutionData) {
    return new Promise(async (resolve, reject) => {
        try {

          let programData = await programsHelper.programDocuments({
            externalId : solutionData.programExternalId
          },["name","description","scope"]);

          if ( !programData.length > 0 ) {
            throw {
              message : constants.apiResponses.PROGRAM_NOT_FOUND
            }
          }
          
          solutionData.programId = programData[0]._id;
          solutionData.programName = programData[0].name;
          solutionData.programDescription = programData[0].description;

          let entityTypeData = 
          await entityTypesHelper.entityTypesDocument({
            name : solutionData.entityType
          },["_id"]);

          if( !entityTypeData.length > 0 ) {
            throw {
              message : constants.apiResponses.ENTITY_TYPES_NOT_FOUND
            }
          }

          solutionData.entityTypeId = entityTypeData[0]._id;

          if( solutionData.entities && solutionData.entities.length > 0 ) {
              
            let entitiesData = 
            await entitiesHelper.entityDocuments({
              _id : { $in : solutionData.entities }
            },["_id"]);

            if( !entitiesData.length > 0 ) {
              throw {
                message : constants.apiResponses.ENTITIES_NOT_FOUND
              }
            }

            entitiesData = entitiesData.map( entity => {
              return entity._id;
            })

            solutionData.entities = entitiesData;
          }

          solutionData.status = constants.common.ACTIVE;
    
          let solutionCreation = 
          await database.models.solutions.create(
            _.omit(solutionData,["scope"])
          );

          if( !solutionCreation._id ) {
            throw {
              message : constants.apiResponses.SOLUTION_NOT_CREATED
            }
          }

          let updateProgram = 
          await database.models.programs.updateOne(
            { 
              _id: solutionData.programId
            }, { 
              $addToSet: { components : solutionCreation._id } 
          });

          if( programData[0].scope ) {
            
            let solutionScope = 
            await this.setScope(
              solutionData.programId,
              solutionCreation._id,
              solutionData.scope ? solutionData.scope : {}
            );

          }

          return resolve({
            message : constants.apiResponses.SOLUTION_CREATED,
            data : {
              _id : solutionCreation._id
            }
          });
            
        } catch (error) {
            return reject(error);
        }
    });
  }

    /**
   * Set scope in solution
   * @method
   * @name setScope
   * @param {String} programId - program id.
   * @param {String} solutionId - solution id.
   * @param {Object} scopeData - scope data.
   * @param {String} scopeData.entityType - scope entity type
   * @param {Array} scopeData.entities - scope entities
   * @param {Array} scopeData.roles - roles in scope 
   * @returns {JSON} - scope in solution.
   */

  static setScope( programId,solutionId,scopeData ) {

    return new Promise(async (resolve, reject) => {

      try {

        let programData = 
        await programsHelper.programDocuments({ _id : programId },["_id","scope"]);
 
        if( !programData.length > 0 ) {
          return resolve({
            status : httpStatusCode.bad_request.status,
            message : constants.apiResponses.PROGRAM_NOT_FOUND
          });
        }

        let solutionData = await this.solutionDocuments({ _id : solutionId },["_id"]);

        if( !solutionData.length > 0 ) {
          return resolve({
            status : httpStatusCode.bad_request.status,
            message : constants.apiResponses.SOLUTION_NOT_FOUND
          });
        }

        if( programData[0].scope ) {
          
          let currentSolutionScope = programData[0].scope;

          if( Object.keys(scopeData).length > 0 ) {

            if( scopeData.entityType ) {
              
              let entityType =  await entityTypesHelper.entityTypesDocument(
                {
                  name : scopeData.entityType
                },
                ["name","_id"]
              );
          
              currentSolutionScope.entityType = entityType[0].name;
              currentSolutionScope.entityTypeId = entityType[0]._id;

            }

            if( scopeData.entities && scopeData.entities.length > 0 ) {
              
              let entities = 
              await entitiesHelper.entityDocuments(
                {
                  _id : { $in : scopeData.entities },
                  entityTypeId : currentSolutionScope.entityTypeId
                },["_id"]
              );
  
              if( !entities.length > 0 ) {
                return resolve({
                  status : httpStatusCode.bad_request.status,
                  message : constants.apiResponses.ENTITIES_NOT_FOUND
                });
              }

              let entityIds = [];

            for( let entity = 0; entity < entities.length; entity ++ ) {
              
              let entityQuery = {
                _id : { $in : currentSolutionScope.entities },
                [`groups.${currentSolutionScope.entityType}`] : entities[entity]._id
              }

              let entityInParent = 
              await entitiesHelper.entityDocuments(entityQuery);

              if( entityInParent.length > 0 ) {
                entityIds.push(ObjectId(entities[entity]._id));
              }
            }

            if( !entityIds.length > 0 ) {
              
              return resolve({
                status : httpStatusCode.bad_request.status,
                message : constants.apiResponses.SCOPE_ENTITY_INVALID
              });

            }

            currentSolutionScope.entities = entityIds;
            }

            if( scopeData.roles.length > 0 ) {
              
              let userRoles = await userRolesHelper.roleDocuments({
                code : { $in : scopeData.roles }
              },["_id","code"]);
  
              if( !userRoles.length > 0 ) {
                return resolve({
                  status : httpStatusCode.bad_request.status,
                  message : constants.apiResponses.INVALID_ROLE_CODE
                });
              }
  
              currentSolutionScope["roles"] = userRoles;

            }
          }

          let updateSolution = 
          await database.models.solutions.findOneAndUpdate(
            {
              _id : solutionId
            },
            { $set : { scope : currentSolutionScope }},{ new: true }
          ).lean();
  
          if( !updateSolution._id ) {
            throw {
              status : constants.apiResponses.SOLUTION_SCOPE_NOT_ADDED
            };
          }
          solutionData = updateSolution;

        }

        return resolve({
          success : true,
          message : constants.apiResponses.SOLUTION_UPDATED
        });

      } catch (error) {
          return resolve({
            success : false
          });
      }

    })
  } 

  /**
   * Update solution.
   * @method 
   * @name update
   * @param {String} solutionId - solution id.
   * @param {Object} solutionData - solution creation data.
   * @returns {JSON} solution creation data. 
   */
  
  static update(solutionId, solutionData, userId) {
    return new Promise(async (resolve, reject) => {
        try {

          let queryObject = {
            _id : solutionId
          };

          let solutionDocument = 
          await this.solutionDocuments(queryObject, ["_id"]);

          if (!solutionDocument) {
            return resolve({
              status: httpStatusCode.bad_request.status,
              message: constants.apiResponses.SOLUTION_NOT_FOUND
            });
          }

          let updateObject = {
            "$set" : {}
          };

          let solutionUpdateData = solutionData;

          Object.keys(_.omit(solutionUpdateData,["scope"])).forEach(updationData=>{
            updateObject["$set"][updationData] = solutionUpdateData[updationData];
          });

          updateObject["$set"]["updatedBy"] = userId;

          let solutionUpdatedData = await database.models.solutions.findOneAndUpdate({
            _id: solutionDocument[0]._id
          }, updateObject,{ new : true }).lean();

          if( !solutionUpdatedData._id ) {
            throw {
              message : constants.apiResponses.SOLUTION_NOT_CREATED
            }
          }
            
          if( solutionData.scope && Object.keys(solutionData.scope).length > 0 ) {

            let solutionScope = 
            await this.setScope(
              solutionUpdatedData.programId,
              solutionUpdatedData._id,
              solutionData.scope
            );

            if( !solutionScope.success ) {
              throw {
                message : constants.apiResponses.COULD_NOT_UPDATE_SCOPE
              }
            }
          }

          return resolve({
            success : true,
            message: constants.apiResponses.SOLUTION_UPDATED,
            data : solutionData
          });
            
        } catch (error) {
            return resolve({
              success : false,
              message : error.message,
              data : {}
            });
        }
    });
  }

  /**
   * List solutions.
   * @method  
   * @name list
   * @param {String} type - solution type.
   * @param {String} subType - solution sub type.
   * @param {Number} pageNo - page no.
   * @param {Number} pageSize - page size.
   * @param {String} searchText - search text.
   * @param {Object} filter - Filtered data.
   * @returns {JSON} List of solutions.
   */
  
  static list(type,subType,filter = {},pageNo,pageSize,searchText,projection) {
    return new Promise(async (resolve, reject) => {
        try {

          let matchQuery = { 
            "isDeleted" : false,
            status : constants.common.ACTIVE 
          };

          if( type !== "" ) {
            matchQuery["type"] = type;
          }

          if( subType !== "" ) {
            matchQuery["subType"] = subType;
          }

          if( Object.keys(filter).length > 0 ) {
            matchQuery = _.merge(matchQuery,filter);
          }

          if ( searchText !== "" ) {

            let searchData = [{ 
              "externalId": new RegExp(searchText, 'i') 
            }, { 
              "description": new RegExp(searchText, 'i') 
            }]

            if( matchQuery["$or"] ) {
              matchQuery["$and"] = [
                { $or : matchQuery.$or },
                { $or : searchData }
              ]

              delete matchQuery.$or;
            } else {
              matchQuery["$or"] = searchData;
            }
          }

          let projection1 = {};

          if ( projection ) {
            projection.forEach(projectedData => {
              projection1[projectedData] = 1;
            })
          } else {
            projection1 = {
              description : 1,
              externalId : 1,
              name : 1
            }
          }

          let facetQuery = {};
          facetQuery["$facet"] = {};
          
          facetQuery["$facet"]["totalCount"] = [{ "$count": "count" }];
          
          facetQuery["$facet"]["data"] = [
            { $skip: pageSize * (pageNo - 1) },
            { $limit: pageSize }
          ];

          let projection2 = {};
          
          projection2["$project"] = {
            "data": 1,
            "count": {
              $arrayElemAt: ["$totalCount.count", 0]
            }
          };

          let solutionDocuments = 
          await database.models.solutions.aggregate([
            { $match : matchQuery },
            { $project : projection1 },
            facetQuery,
            projection2
          ]);

          return resolve({
            success : true,
            message : constants.apiResponses.SOLUTIONS_LIST,
            data : solutionDocuments[0]
          });
            
        } catch (error) {
            return resolve({
              success : false,
              message : error.message,
              data : {}
            });
        }
    });
  }

   /**
   * List of solutions based on role and location.
   * @method
   * @name forUserRoleAndLocation
   * @param {String} bodyData - Requested body data.
   * @param {String} type - solution type.
   * @param {String} subType - solution sub type.
   * @param {String} programId - program Id
   * @param {String} pageSize - Page size.
   * @param {String} pageNo - Page no.
   * @param {String} searchText - search text.
   * @returns {JSON} - List of solutions based on role and location.
   */

  static forUserRoleAndLocation( 
    bodyData,
    type,
    subType = "",
    programId, 
    pageSize, 
    pageNo,
    searchText = "" 
  ) {
    return new Promise(async (resolve, reject) => {
      try {

        let queryData = await this.queryBasedOnRoleAndLocation(
          bodyData,
          type,
          subType,
          programId
        );

        if( !queryData.success ) {
          return resolve(queryData);
        }

        let matchQuery = queryData.data;

        if( type === "" && subType === "" ) {
          
          let targetedTypes = _targetedSolutionTypes();

          matchQuery["$or"] = [];

          targetedTypes.forEach( type => {
            
            let singleType = {
              type : type
            };

            if( type === constants.common.IMPROVEMENT_PROJECT ) {
              singleType["projectTemplateId"] = { $exists : true };
            }

            matchQuery["$or"].push(singleType);
          })
        } else {
          
          if( type !== "" ) {
            matchQuery["type"] = type;
          }
      
          if( subType !== "" ) {
            matchQuery["subType"] = subType;
          }
        }

        if ( programId !== "" ) {
          matchQuery["programId"] = ObjectId(programId);
        }

        let targetedSolutions = await this.list(
          type,
          subType,
          matchQuery,
          pageNo,
          pageSize,
          searchText,
          [
            "name", 
            "description", 
            "programName",
            "programId",
            "externalId",
            "projectTemplateId",
            "type"
          ]  
        );
      
        return resolve({
          success: true,
          message: constants.apiResponses.TARGETED_SOLUTIONS_FETCHED,
          data: targetedSolutions.data
        });

      } catch (error) {

        return resolve({
          success : false,
          message : error.message,
          data : {}
        });

      }

    })
  }

   /**
   * Auto targeted query field.
   * @method
   * @name queryBasedOnRoleAndLocation
   * @param {String} data - Requested body data.
   * @returns {JSON} - Auto targeted solutions query.
   */
  
  static queryBasedOnRoleAndLocation( data ) {
    return new Promise(async (resolve, reject) => {
      try {

        let registryIds = [];
        let entityTypes = [];

        Object.keys(_.omit(data,["filter","role"])).forEach( requestedDataKey => {
          registryIds.push(data[requestedDataKey]);
          entityTypes.push(requestedDataKey);
        })
    
        let entities = await entitiesHelper.entityDocuments({
          "registryDetails.locationId" : { $in : registryIds }
        },["_id"]); 

        if( !entities.length > 0 ) {
          throw {
            message : constants.apiResponses.NO_ENTITY_FOUND_IN_LOCATION
          }
        }

        let entityIds = entities.map(entity => {
          return entity._id;
        });

        let filterQuery = {
          "scope.roles.code" : data.role,
          "scope.entities" : { $in : entityIds },
          "scope.entityType" : { $in : entityTypes },
          isReusable : false,
          "isDeleted" : false,
          status : constants.common.ACTIVE
        };
    
        if( data.filter && Object.keys(data.filter).length > 0 ) {
          
          let solutionsSkipped = [];

          if(  data.filter.skipSolutions ) {
            
            data.filter.skipSolutions.forEach( solution => {
              solutionsSkipped.push(ObjectId(solution.toString()));
            });
  
            data.filter["_id"] = {
              $nin : solutionsSkipped
            }

            delete data.filter.skipSolutions;
          }
    
          filterQuery = _.merge(filterQuery,data.filter);
        }
        
        return resolve({
          success : true,
          data : filterQuery
        });

      } catch(error) {
        return resolve({
          success : false,
          status : error.status ? 
          error.status : httpStatusCode['internal_server_error'].status,
          message : error.message,
          data : {}
        })
      }
    })   
  } 

   /**
   * Details of solution based on role and location.
   * @method
   * @name detailsBasedOnRoleAndLocation
   * @param {String} solutionId - solution Id.
   * @param {Object} bodyData - Requested body data.
   * @returns {JSON} - Details of solution based on role and location.
   */

  static detailsBasedOnRoleAndLocation( solutionId,bodyData ) {

    return new Promise(async (resolve, reject) => {

      try {

        let queryData = await this.queryBasedOnRoleAndLocation(bodyData);

        if( !queryData.success ) {
          return resolve(queryData);
        }

        queryData.data["_id"] = solutionId;

        let targetedSolutionDetails = 
        await this.solutionDocuments(
          queryData.data,
          [
            "name",
            "externalId",
            "description",
            "programId",
            "programName",
            "programDescription",
            "programExternalId",
            "isAPrivateProgram",
            "projectTemplateId",
            "entityType",
            "entityTypeId"
          ]
        );

        if( !targetedSolutionDetails.length > 0 ) {
          throw {
            status : httpStatusCode["bad_request"].status,
            message : constants.apiResponses.SOLUTION_NOT_FOUND
          }
        }
      
        return resolve({
          success: true,
          message: constants.apiResponses.TARGETED_SOLUTIONS_FETCHED,
          data: targetedSolutionDetails[0]
        });

      } catch (error) {

        return resolve({
          success : false,
          message : error.message,
          data : {}
        });

      }

    })
  }

};

 /**
   * Targeted solutions types.
   * @method
   * @name _targetedSolutionTypes
   * @returns {Array} - Targeted solution types
   */

function _targetedSolutionTypes() {
  return [
    constants.common.ASSESSMENT, 
    constants.common.OBSERVATION,
    constants.common.SURVEY,
    constants.common.IMPROVEMENT_PROJECT
  ]
}
