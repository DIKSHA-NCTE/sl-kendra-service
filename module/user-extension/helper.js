/**
 * name : module/notifications/user-extension/helper.js
 * author : Aman Jung Karki
 * Date : 15-Nov-2019
 * Description : User extension helper.
 */


/**
    * UserExtensionHelper
    * @class
*/

const entityTypesHelper = require(MODULES_BASE_PATH+"/entityTypes/helper");
const entitiesHelper = require(MODULES_BASE_PATH+"/entities/helper");
const userRolesHelper = require(MODULES_BASE_PATH+"/user-roles/helper");

module.exports = class UserExtensionHelper {

       /**
      * Get userExtension document based on userid.
      * @method
      * @name userExtensionDocument
      * @name userExtensionDocument
      * @param {Object} filterQueryObject - filter query data.
      * @param {Object} [projection = {}] - projected data.
      * @returns {Promise} returns a promise.
     */

    static userExtensionDocument(filterQueryObject, projection = {}) {
        return new Promise(async (resolve, reject) => {
            try {

                let userExtensionData = await database.models.userExtension.findOne(filterQueryObject, projection).lean();

                return resolve(userExtensionData);

            } catch (error) {
                return reject(error);
            }
        })


    }

     /**
      * Create or update the userExtension document.
      * @method
      * @name createOrUpdate
      * @name createOrUpdate 
      * @param {Object} deviceData - device data.
      * @param {Object} userDetails - User details.
      * @param {String} userDetails.userId - Logged in user id.
      * @param {String} userDetails.userName - Logged in user name.        
      * @returns {Promise} returns a promise.
     */

    static createOrUpdate(deviceData, userDetails) {

        return new Promise(async (resolve, reject) => {
            try {

                let userExtensionData = await this.userExtensionDocument({
                    userId: userDetails.userId,
                    status: "active",
                    isDeleted: false
                }, { devices: 1 });

                let response = {};

                if (userExtensionData) {

                    let deviceNotFound = false;

                    if (userExtensionData.devices && userExtensionData.devices.length > 0) {

                        let matchingDeviceData = 
                        userExtensionData.devices.find(
                            eachDevice => eachDevice.deviceId === deviceData.deviceId
                        );

                        if (!matchingDeviceData) {

                            deviceNotFound = true;
                        }

                    } else {
                        deviceNotFound = true;
                    }

                    if (deviceNotFound) {

                        let updatedData = await database.models.userExtension.findOneAndUpdate({
                            userId: userDetails.userId,
                        }, { $addToSet: { devices: deviceData } }).lean();

                        if (updatedData) {
                            response["success"] = true;
                            response["message"] = 
                            `Added Successfully device id ${deviceData.deviceId} for user ${userDetails.email}`;
                        } else {
                            throw `Could not add device id ${deviceData.deviceId} for user ${userDetails.email}`;
                        }
                    }

                } else {

                    let createUserExtension = await database.models.userExtension.create(
                        {
                            "userId": userDetails.userId,
                            "externalId": userDetails.userName,
                            "devices": [deviceData],
                            "createdBy": "SYSTEM",
                            "updatedBy": "SYSTEM"
                        }
                    );

                    if (createUserExtension) {
                        response["success"] = true;
                        response["message"] = 
                        `Successfully created user ${userDetails.userId} in userExtension`;
                    } else {
                        throw `Could not create user ${userDetails.userId} in userExtension`;
                    }

                }

                return resolve(response);

            } catch (error) {
                return reject(error);
            }
        })
    }

     /**
      * Update device status in userExtension document.
      * @method
      * @name updateDeviceStatus
      * @name updateDeviceStatus  
      * @param {Object} deviceData - device data.
      * @param {String} deviceData.title - title of device.
      * @param {Object[]} deviceArray - device array.      * 
      * @param {String} userId - Logged in user id.      
      * @returns {Promise} returns a promise.
     */

    static updateDeviceStatus(deviceId,deviceArray, userId) {

        return new Promise(async (resolve, reject) => {

            try {
                deviceArray.forEach(async devices => {

                    delete devices['message'];
                    delete devices['title'];

                    if (devices.deviceId == deviceId) {
                        devices.status = "inactive";
                        devices.deactivatedAt = new Date();
                    }
                });

                let updateDevice = await database.models.userExtension.findOneAndUpdate(
                    { userId: userId },
                    { $set: { "devices": deviceArray } }
                ).lean();

                if (!updateDevice) {
                    throw "Could not update device.";
                }

                return resolve({
                    success: true,
                    message: "successfuly updated the status to inactive"
                });

            } catch (error) {
                return reject(error);
            }

        })
    }

     /**
   * Get profile with entity details
   * @method
   * @name profileWithEntityDetails
   * @param {Object} filterQueryObject - filtered data.
   * @returns {Object} 
   */

  static profileWithEntityDetails( filterQueryObject, appName ) {
    return new Promise(async (resolve, reject) => {
        try {

            const entityTypesArray = await entityTypesHelper.list({}, {
                name: 1,
                immediateChildrenEntityType: 1
            });

            let enityTypeToImmediateChildrenEntityMap = {};

            if (entityTypesArray.length > 0) {  
                entityTypesArray.forEach(entityType => {
                    enityTypeToImmediateChildrenEntityMap[entityType.name] = (entityType.immediateChildrenEntityType && entityType.immediateChildrenEntityType.length > 0) ? entityType.immediateChildrenEntityType : [];
                })
            }

            let queryObject = [
                {
                    $match: filterQueryObject
                },
                {
                    $lookup: {
                        "from": "entities",
                        "localField": "roles.entities",
                        "foreignField": "_id",
                        "as": "entityDocuments"
                    }
                },
                {
                    $lookup: {
                        "from": "userRoles",
                        "localField": "roles.roleId",
                        "foreignField": "_id",
                        "as": "roleDocuments"
                    }
                },
                {
                    $project: {
                        "externalId": 1,
                        "roles": 1,
                        "roleDocuments._id": 1,
                        "roleDocuments.code": 1,
                        "roleDocuments.title": 1,
                        "entityDocuments._id": 1,
                        "entityDocuments.metaInformation.externalId": 1,
                        "entityDocuments.metaInformation.name": 1,
                        "entityDocuments.groups": 1,
                        "entityDocuments.entityType": 1,
                        "entityDocuments.entityTypeId": 1
                    }
                }
            ];

            let userExtensionData = 
            await database.models.userExtension.aggregate(queryObject);
            let relatedEntities = [];

            if (userExtensionData[0]) {

                let roleMap = {};

                if( userExtensionData[0].entityDocuments && userExtensionData[0].entityDocuments.length >0 ) {
                    
                    let projection = [
                        "metaInformation.externalId", 
                        "metaInformation.name", 
                        "metaInformation.addressLine1",
                        "metaInformation.addressLine2",
                        "metaInformation.administration",
                        "metaInformation.city",
                        "metaInformation.country",
                        "entityTypeId",
                        "entityType"
                    ];
                    
                    relatedEntities = 
                    await entitiesHelper.relatedEntities(
                        userExtensionData[0].entityDocuments[0]._id, 
                        userExtensionData[0].entityDocuments[0].entityTypeId, 
                        userExtensionData[0].entityDocuments[0].entityType, 
                        projection
                    );
                    
                }

                // <- Dirty fix. Profile update for only Goa state. 
                // In future can be removed if required for all state.

                let goaStateExists = false;
                let goaState = constants.common.GOA_STATE.toUpperCase();

                if( relatedEntities.length > 0 ) {
                    
                    let checkGoaStateExistsOrNot = relatedEntities.some(
                        entity => entity.metaInformation.name.toUpperCase() === goaState
                    );

                    if( 
                        checkGoaStateExistsOrNot && 
                        appName === constants.common.UNNATI_APP_NAME 
                    ) {
                        goaStateExists = true;
                    } 
                    
                }

                if ( userExtensionData[0].roleDocuments && userExtensionData[0].roleDocuments.length > 0 ) {

                    userExtensionData[0].roleDocuments.forEach(role => {
                        roleMap[role._id.toString()] = role;
                    })
                    let entityMap = {};

                    if( userExtensionData[0].entityDocuments && userExtensionData[0].entityDocuments.length > 0 ) {
                        
                        userExtensionData[0].entityDocuments.forEach(entity => {
                            entity.metaInformation.childrenCount = 0;
                            entity.metaInformation.entityType = entity.entityType;
                            entity.metaInformation.entityTypeId = entity.entityTypeId;
                            entity.metaInformation.subEntityGroups = new Array;
    
                            Array.isArray(enityTypeToImmediateChildrenEntityMap[entity.entityType]) && enityTypeToImmediateChildrenEntityMap[entity.entityType].forEach(immediateChildrenEntityType => {
                                if (entity.groups && entity.groups[immediateChildrenEntityType]) {
                                    entity.metaInformation.immediateSubEntityType = immediateChildrenEntityType;
                                    entity.metaInformation.childrenCount = entity.groups[immediateChildrenEntityType].length;
                                }
                            })
    
                            entity.groups && Array.isArray(Object.keys(entity.groups)) && Object.keys(entity.groups).forEach(subEntityType => {
                                entity.metaInformation.subEntityGroups.push(subEntityType);
                            })
    
                            // <- Dirty fix. Profile update for only Goa state. 
                            // In future can be removed if required for all state.
                            
                            if( 
                                appName === constants.common.UNNATI_APP_NAME && 
                                entity.metaInformation.name.toUpperCase() === goaState
                            ) {
                                goaStateExists = true;
                            }
    
                            entityMap[entity._id.toString()] = entity;
                        })   
                    }

                    for (let userExtensionRoleCounter = 0; userExtensionRoleCounter < userExtensionData[0].roles.length; userExtensionRoleCounter++) {
                        for (let userExtenionRoleEntityCounter = 0; userExtenionRoleEntityCounter < userExtensionData[0].roles[userExtensionRoleCounter].entities.length; userExtenionRoleEntityCounter++) {
                            userExtensionData[0].roles[userExtensionRoleCounter].entities[userExtenionRoleEntityCounter] = {
                                _id: entityMap[userExtensionData[0].roles[userExtensionRoleCounter].entities[userExtenionRoleEntityCounter].toString()]._id,
                                ...entityMap[userExtensionData[0].roles[userExtensionRoleCounter].entities[userExtenionRoleEntityCounter].toString()].metaInformation
                            };
                        }
                        roleMap[userExtensionData[0].roles[userExtensionRoleCounter].roleId.toString()].immediateSubEntityType = (userExtensionData[0].roles[userExtensionRoleCounter].entities[0] && userExtensionData[0].roles[userExtensionRoleCounter].entities[0].entityType) ? userExtensionData[0].roles[userExtensionRoleCounter].entities[0].entityType : "";
                        roleMap[userExtensionData[0].roles[userExtensionRoleCounter].roleId.toString()].entities = userExtensionData[0].roles[userExtensionRoleCounter].entities;
                    }
                }

                let showPopupForm = false;
                let userProfile = await database.models.userProfile.findOne(
                    {
                        userId : filterQueryObject.userId,
                        status : { 
                            $in : [
                                constants.common.USER_PROFILE_VERIFIED_STATUS,
                                constants.common.USER_PROFILE_PENDING_STATUS
                            ]
                        }
                    },{ _id : 1,status:1 }).lean();

                if( userProfile == null ) {
                    showPopupForm = true
                }

                return resolve(
                    _.merge(_.omit(
                        userExtensionData[0], 
                        ["roles","entityDocuments","roleDocuments"]
                        ), 
                    { roles: _.isEmpty(roleMap) ? [] : Object.values(roleMap) },
                    { relatedEntities : relatedEntities },
                    {
                        allowProfileUpdateForm : goaStateExists
                    },{
                        showPopupForm : goaStateExists && showPopupForm ? true : false
                    }
                    )
                );
            } else {
                return resolve({
                    status : httpStatusCode['bad_request'].status,
                    message : constants.apiResponses.USER_EXTENSION_NOT_FOUND
                });
            }
        } catch (error) {
            return reject(error);
        }
    })
}

    /**
   * Update profile roles
   * @method
   * @name updateProfileRoles
   * @param {Object} requestedData - requested data.
   * @param {String} userId - Logged in user id.
   * @param {String} userName - Logged in user name.
   * @returns {Object} 
   */

  static updateProfileRoles( requestedData,userId,userName ) {
    return new Promise(async (resolve, reject) => {
        try {

            const userExtensionData = await this.userExtensionDocument({
                userId : userId
            },{
                "roles" : 1,
                "createdBy" : 1,
                "externalId" : 1
            });

            if( 
                userExtensionData &&
                userExtensionData.roles &&  userExtensionData.roles.length > 0
            ) {
                return resolve({
                    message : constants.apiResponses.USER_DATA_EXISTS,
                    result : []
                })
            }

            const entityData = await entitiesHelper.entityDocuments({
                _id : requestedData.stateId
            },["_id","metaInformation.name"]);

            if( !entityData.length > 0 ) {
                return resolve({
                    message : constants.apiResponses.STATE_NOT_FOUND,
                    result : []
                })
            }

            requestedData["state"] = {
                _id : ObjectId(requestedData.stateId),
                name : entityData[0].metaInformation.name
            }

            for ( 
                let pointerToRole = 0 ; 
                pointerToRole < requestedData.roles.length;
                pointerToRole ++
            ) {

                const rolesData = 
                await userRolesHelper.roleDocuments(
                    {
                        _id : requestedData.roles[pointerToRole]._id
                    },[
                        "code",
                        "entityTypes"
                    ]
                );

                if( !rolesData.length > 0  ) {
                    return resolve({
                        message : constants.apiResponses.USER_ROLES_NOT_FOUND,
                        result : []
                    });
                }

                let entityTypes = rolesData[0].entityTypes.map(roleData => {
                    return roleData.entityType;
                })

                const entitiesData = await entitiesHelper.entityDocuments({
                    _id : { $in : requestedData.roles[pointerToRole].entities},
                    entityType : { $in : entityTypes }
                },["_id"]);

                let entities = [];

                if( entitiesData.length > 0 ) {
                    
                    entities = entitiesData.map(entity => {
                        return entity._id
                    });
                }

                requestedData.roles[pointerToRole].roleId = rolesData[0]._id;
                requestedData.roles[pointerToRole].code = rolesData[0].code;
                requestedData.roles[pointerToRole].entities = entities;

                delete requestedData.roles[pointerToRole]._id;
            }

            if( !userExtensionData ) {
                requestedData.userId = requestedData.updatedBy = userId;
                
                requestedData.createdBy = 
                userExtensionData && userExtensionData.createdBy ? 
                userExtensionData.createdBy : userId;  
                
                requestedData.status = constants.common.ACTIVE;
                requestedData.externalId = 
                userExtensionData && userExtensionData.externalId ? 
                userExtensionData.externalId : userName;
                
                requestedData.isDeleted = false;
            }

            delete requestedData.stateId;
            
            await database.models.userExtension.findOneAndUpdate({
                userId : userId
            },{
                $set : requestedData
            },{
                upsert : true,
                new : true
            });

            const responseData = await this.profileWithEntityDetailsV2({
                userId : userId,
                status: constants.common.ACTIVE,
                isDeleted: false
            });

            resolve({
                message : constants.apiResponses.USER_EXTENSION_UPDATED,
                result : responseData.result
            });

        } catch (error) {
            return reject(error);
        }
    })
  }

    /**
   * Get profile with entity details
   * @method
   * @name profileWithEntityDetails
   * @param {Object} filterQueryObject - filtered data.
   * @returns {Object} 
   */

  static profileWithEntityDetailsV2( filterQueryObject ) {
    return new Promise(async (resolve, reject) => {
        try {

            const entityTypesArray = await entityTypesHelper.list({}, {
                name: 1,
                immediateChildrenEntityType: 1
            });

            let enityTypeToImmediateChildrenEntityMap = {};

            if (entityTypesArray.length > 0) {  
                entityTypesArray.forEach(entityType => {
                    enityTypeToImmediateChildrenEntityMap[entityType.name] = (entityType.immediateChildrenEntityType && entityType.immediateChildrenEntityType.length > 0) ? entityType.immediateChildrenEntityType : [];
                })
            }

            let queryObject = [
                {
                    $match: filterQueryObject
                },
                {
                    $lookup: {
                        "from": "entities",
                        "localField": "roles.entities",
                        "foreignField": "_id",
                        "as": "entityDocuments"
                    }
                },
                {
                    $lookup: {
                        "from": "userRoles",
                        "localField": "roles.roleId",
                        "foreignField": "_id",
                        "as": "roleDocuments"
                    }
                },
                {
                    $project: {
                        "externalId": 1,
                        "roles": 1,
                        "roleDocuments._id": 1,
                        "roleDocuments.code": 1,
                        "roleDocuments.title": 1,
                        "entityDocuments._id": 1,
                        "entityDocuments.metaInformation.externalId": 1,
                        "entityDocuments.metaInformation.name": 1,
                        "entityDocuments.groups": 1,
                        "entityDocuments.entityType": 1,
                        "entityDocuments.entityTypeId": 1,
                        "state" : 1
                    }
                }
            ];

            let userExtensionData = 
            await database.models.userExtension.aggregate(queryObject);

            if( ! userExtensionData.length > 0 ) {
                return resolve({
                    message : constants.apiResponses.USER_EXTENSION_NOT_FOUND,
                    result : {
                        "_id" : "",
                        "externalId" : "",
                        "roles" : []
                    }
                });
            }

            let roleMap = {};
            let entityMapToRelatedEntities = {};

            if( userExtensionData[0].entityDocuments && userExtensionData[0].entityDocuments.length >0 ) {
                
                let projection = [
                    "metaInformation.externalId", 
                    "metaInformation.name", 
                    "metaInformation.addressLine1",
                    "metaInformation.addressLine2",
                    "metaInformation.administration",
                    "metaInformation.city",
                    "metaInformation.country",
                    "entityTypeId",
                    "entityType"
                ];

                for ( 
                    let pointerToUser = 0; 
                    pointerToUser < userExtensionData[0].entityDocuments.length ;
                    pointerToUser ++ 
                ) {
                    let currentEntities = 
                    userExtensionData[0].entityDocuments[pointerToUser];

                    const relatedEntities = 
                    await entitiesHelper.relatedEntities(
                        currentEntities._id, 
                        currentEntities.entityTypeId, 
                        currentEntities.entityType, 
                        projection
                    );

                    if( relatedEntities.length > 0 ) {
                        entityMapToRelatedEntities[currentEntities._id.toString()] = relatedEntities;
                    }
                }
            }

            if ( userExtensionData[0].roleDocuments && userExtensionData[0].roleDocuments.length > 0 ) {

                userExtensionData[0].roleDocuments.forEach(role => {
                    roleMap[role._id.toString()] = role;
                })
                let entityMap = {};
                
                userExtensionData[0].entityDocuments.forEach(entity => {
                    entity.metaInformation.childrenCount = 0;
                    entity.metaInformation.entityType = entity.entityType;
                    entity.metaInformation.entityTypeId = entity.entityTypeId;
                    entity.metaInformation.subEntityGroups = new Array;

                    Array.isArray(enityTypeToImmediateChildrenEntityMap[entity.entityType]) && enityTypeToImmediateChildrenEntityMap[entity.entityType].forEach(immediateChildrenEntityType => {
                        if (entity.groups && entity.groups[immediateChildrenEntityType]) {
                            entity.metaInformation.immediateSubEntityType = immediateChildrenEntityType;
                            entity.metaInformation.childrenCount = entity.groups[immediateChildrenEntityType].length;
                        }
                    })

                    entity.groups && Array.isArray(Object.keys(entity.groups)) && Object.keys(entity.groups).forEach(subEntityType => {
                        entity.metaInformation.subEntityGroups.push(subEntityType);
                    })

                    entity.metaInformation["relatedEntities"] = [];

                    if( entityMapToRelatedEntities[entity._id.toString()] ) {
                        entity.metaInformation["relatedEntities"] = 
                        entityMapToRelatedEntities[entity._id.toString()];
                    }

                    entityMap[entity._id.toString()] = entity;
                })

                for (let userExtensionRoleCounter = 0; userExtensionRoleCounter < userExtensionData[0].roles.length; userExtensionRoleCounter++) {
                    for (let userExtenionRoleEntityCounter = 0; userExtenionRoleEntityCounter < userExtensionData[0].roles[userExtensionRoleCounter].entities.length; userExtenionRoleEntityCounter++) {
                        userExtensionData[0].roles[userExtensionRoleCounter].entities[userExtenionRoleEntityCounter] = {
                            _id: entityMap[userExtensionData[0].roles[userExtensionRoleCounter].entities[userExtenionRoleEntityCounter].toString()]._id,
                            ...entityMap[userExtensionData[0].roles[userExtensionRoleCounter].entities[userExtenionRoleEntityCounter].toString()].metaInformation
                        };
                    }
                    roleMap[userExtensionData[0].roles[userExtensionRoleCounter].roleId.toString()].immediateSubEntityType = (userExtensionData[0].roles[userExtensionRoleCounter].entities[0] && userExtensionData[0].roles[userExtensionRoleCounter].entities[0].entityType) ? userExtensionData[0].roles[userExtensionRoleCounter].entities[0].entityType : "";
                    roleMap[userExtensionData[0].roles[userExtensionRoleCounter].roleId.toString()].entities = userExtensionData[0].roles[userExtensionRoleCounter].entities;
                }
            }

            return resolve({
                message : constants.apiResponses.USER_EXTENSION_FETCHED,
                result :  
                _.merge(_.omit(userExtensionData[0], ["roles","entityDocuments","roleDocuments"]), 
                { roles: _.isEmpty(roleMap) ? [] : Object.values(roleMap) }) 
            });
            
        } catch (error) {
            return reject(error);
        }
    })
}

};




