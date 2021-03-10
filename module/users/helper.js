/**
 * name : users/helper.js
 * author : Aman Jung Karki
 * created-date : 03-Dc-2019
 * Description : All User related information including sys_admin.
 */


// Dependencies
const programsHelper = require(MODULES_BASE_PATH + "/programs/helper");
const solutionsHelper = require(MODULES_BASE_PATH + "/solutions/helper");
const sunbirdService = require(ROOT_PATH + "/generics/services/sunbird");
const userRolesHelper = require(MODULES_BASE_PATH + "/user-roles/helper");
const entitiesHelper = require(MODULES_BASE_PATH + "/entities/helper");

/**
    * UsersHelper
    * @class
*/

module.exports = class UsersHelper {

    /**
     * create user.
     * @method
     * @name create
     * @param {Object} userData user data.
     * @param {String} userData.email email id of the user.
     * @param {String} userData.userName  name of the user.
     * @param {String} userData.role  role of the user.
     * @returns {Promise} returns a promise.
    */

    static create(userData) {
        return new Promise(async (resolve, reject) => {
            try {

                let checkUserExistence =
                    await database.models.users.findOne({
                        email: userData.email
                    }).lean();

                if (checkUserExistence) {
                    throw {
                        message: "User already exists"
                    }
                }

                let createUser =
                    await database.models.users.create(userData)

                let response = {
                    success: true,
                    message: "User created successfully"
                }

                if (!createUser) {
                    response["success"] = false;
                    response["message"] = "User could not be created";
                }

                return resolve(response);

            } catch (error) {
                return reject(error);
            }
        })
    }

    /**
      * check if the provided email is sys admin or not.
      * @method
      * @name isSystemAdmin
      * @param {String} userEmail user email address.
      * @returns {Promise} returns a promise.
     */

    static isSystemAdmin(userEmail) {
        return new Promise(async (resolve, reject) => {
            try {

                let userDocument =
                    await database.models.users.findOne({
                        email: userEmail,
                        role: "SYS_ADMIN"
                    }).lean();

                let response = {
                    success: true
                }

                if (!userDocument) {
                    response["success"] = false;
                }

                return resolve(response);

            } catch (error) {
                return reject(error);
            }
        })
    }

    /**
  * List of all private programs created by user
  * @method
  * @name privatePrograms
  * @param {string} userId - logged in user Id.
  * @returns {Array} - List of all private programs created by user.
  */

    static privatePrograms(userId) {
        return new Promise(async (resolve, reject) => {
            try {

                let userPrivatePrograms =
                    await programsHelper.userPrivatePrograms(
                        userId
                    );

                return resolve({
                    message: constants.apiResponses.PRIVATE_PROGRAMS_LIST,
                    result: userPrivatePrograms
                })

            } catch (error) {
                return reject(error);
            }
        })
    }

    /**
    * Create user program and solution
    * @method
    * @name createProgramAndSolution
    * @param {string} userId - logged in user Id.
    * @param {object} programData - data needed for creation of program.
    * @param {object} solutionData - data needed for creation of solution.
    * @returns {Array} - Created user program and solution.
    */

    static createProgramAndSolution(userId, data, userToken) {
        return new Promise(async (resolve, reject) => {
            try {

                let userPrivateProgram = {};
                let dateFormat = gen.utils.epochTime();

                const organisationAndRootOrganisations =
                    await this.getUserOrganisationsAndRootOrganisations(userId, userToken);

                if (data.programId && data.programId !== "") {

                    userPrivateProgram = await programsHelper.programDocuments(
                        {
                            _id: data.programId,
                            createdBy: userId
                        }
                    );

                    if (!userPrivateProgram.length > 0) {
                        return resolve({
                            status: httpStatusCode['bad_request'].status,
                            message: constants.apiResponses.PROGRAM_NOT_FOUND,
                            result: {}
                        })
                    }

                    userPrivateProgram = userPrivateProgram[0];

                } else {

                    let programData = {
                        name: data.programName,
                        isAPrivateProgram: true,
                        status: constants.common.ACTIVE_STATUS,
                        externalId:
                            data.programExternalId ?
                                data.programExternalId :
                                data.programName + "-" + dateFormat,
                        description:
                            data.programDescription ?
                                data.programDescription :
                                data.programName,
                        userId: userId
                    }

                    programData.createdFor = organisationAndRootOrganisations.result.createdFor;
                    programData.rootOrganisations = organisationAndRootOrganisations.result.rootOrganisations;

                    userPrivateProgram =
                        await programsHelper.create(
                            programData
                        );
                }

                let solutionDataToBeUpdated = {
                    programId: userPrivateProgram._id,
                    programExternalId: userPrivateProgram.externalId,
                    programName: userPrivateProgram.name,
                    programDescription: userPrivateProgram.description,
                    isAPrivateProgram: userPrivateProgram.isAPrivateProgram
                };

                if (data.entities && data.entities.length > 0) {

                    let entityData = await entitiesHelper.entityDocuments(
                        {
                            _id: { $in: data.entities }
                        }, ["entityType", "entityTypeId"]
                    );

                    if (!entityData.length > 0) {
                        return resolve({
                            status: httpStatusCode['bad_request'].status,
                            message: constants.apiResponses.ENTITY_NOT_FOUND,
                            result: {}
                        })
                    }

                    solutionDataToBeUpdated["entities"] = entityData.map(entity => entity._id);
                    solutionDataToBeUpdated["entityType"] = entityData[0].entityType;
                    solutionDataToBeUpdated["entityTypeId"] = entityData[0].entityTypeId;
                }

                let solution = ""

                if (data.solutionId && data.solutionId !== "") {

                    let solutionData =
                        await solutionsHelper.solutionDocuments({
                            _id: data.solutionId,
                            isReusable: false
                        }, ["_id"]);

                    if (!solutionData.length > 0) {

                        return resolve({
                            status: httpStatusCode['bad_request'].status,
                            message: constants.apiResponses.SOLUTION_NOT_FOUND,
                            result: {}
                        })
                    }

                    solution =
                        await database.models.solutions.findOneAndUpdate({
                            _id: solutionData[0]._id
                        }, {
                            $set: solutionDataToBeUpdated
                        }, {
                            new: true
                        });


                } else {

                    solutionDataToBeUpdated["type"] =
                        data.type ? data.type : constants.common.ASSESSMENT;
                    solutionDataToBeUpdated["subType"] =
                        data.subType ? data.subType : constants.common.INSTITUTIONAL;

                    solutionDataToBeUpdated["isReusable"] = false;

                    if (data.solutionName) {
                        solutionDataToBeUpdated["name"] = data.solutionName;
                        solutionDataToBeUpdated["externalId"] =
                            data.solutionExternalId ?
                                data.solutionExternalId : data.solutionName + "-" + dateFormat;
                        solutionDataToBeUpdated["description"] =
                            data.solutionDescription ? data.solutionDescription : data.solutionName;
                    } else {
                        solutionDataToBeUpdated["name"] = userPrivateProgram.programName,
                            solutionDataToBeUpdated["externalId"] = userId + "-" + dateFormat;
                        solutionDataToBeUpdated["description"] = userPrivateProgram.programDescription;
                    }

                    solutionDataToBeUpdated.createdFor = organisationAndRootOrganisations.result.createdFor;
                    solutionDataToBeUpdated.rootOrganisations = organisationAndRootOrganisations.result.rootOrganisations;
                    solutionDataToBeUpdated.updatedBy = userId;

                    solution = await solutionsHelper.create(solutionDataToBeUpdated);
                }

                if (solution._id) {

                    await database.models.programs.findOneAndUpdate(
                        {
                            _id: userPrivateProgram._id
                        }, {
                        $addToSet: { components: ObjectId(solution._id) }
                    });
                }

                return resolve({
                    message: constants.apiResponses.USER_PROGRAM_AND_SOLUTION_CREATED,
                    result: {
                        program: userPrivateProgram,
                        solution: solution
                    }
                });

            } catch (error) {
                console.log(error);
                return reject(error);
            }
        })
    }

    /**
    * Get user organisations and root organisations.
    * @method
    * @name getUserOrganisationsAndRootOrganisations
    * @param {string} userId - logged in user Id.
    * @param {object} userToken - Logged in user token.
    * @returns {Array} - Get user organisations and root organisations.
    */

    static getUserOrganisationsAndRootOrganisations(userId, userToken) {
        return new Promise(async (resolve, reject) => {
            try {

                const userProfileData =
                    await sunbirdService.userProfile(userId, userToken);

                const createdFor =
                    userProfileData.organisations.map(
                        organisation => {
                            return organisation.organisationId
                        }
                    );

                const rootOrganisations = [userProfileData.rootOrgId];

                return resolve({
                    message: constants.apiResponses.USER_ORGANISATIONS_FETCHED,
                    result: {
                        createdFor: createdFor,
                        rootOrganisations: rootOrganisations
                    }
                });

            } catch (error) {
                return reject(error);
            }
        })
    }

    /**
      * Entities mapping form data.
      * @method
      * @name entitiesMappingForm
      * @param {String} stateId - state id.
      * @param {String} roleId - role id.
      * @returns {Object} returns a list of entitiesMappingForm.
     */

    static entitiesMappingForm(stateId, roleId) {
        return new Promise(async (resolve, reject) => {
            try {

                const rolesData = await userRolesHelper.roleDocuments({
                    _id: roleId
                }, ["entityTypes.entityType"]);

                if (!rolesData.length > 0) {
                    return resolve({
                        message: constants.apiResponses.USER_ROLES_NOT_FOUND,
                        result: []
                    })
                }

                const entitiesData = await entitiesHelper.entityDocuments(
                    {
                        _id: stateId,
                    }, ["childHierarchyPath"]
                );

                if (!entitiesData.length > 0) {
                    return resolve({
                        message: constants.apiResponses.ENTITY_NOT_FOUND,
                        result: []
                    })
                }

                let roleEntityType = "";

                rolesData[0].entityTypes.forEach(roleData => {
                    if (entitiesData[0].childHierarchyPath.includes(roleData.entityType)) {
                        roleEntityType = roleData.entityType;
                    }
                })

                let entityTypeIndex =
                entitiesData[0].childHierarchyPath.findIndex(path => path === roleEntityType);

                let form = {
                    "field": "",
                    "label": "",
                    "value": "",
                    "visible": true,
                    "editable": true,
                    "input": "text",
                    "validation": {
                        "required": false
                    }
                };

                let forms = [];

                for (
                    let pointerToChildHierarchy = 0;
                    pointerToChildHierarchy < entityTypeIndex + 1;
                    pointerToChildHierarchy++
                ) {
                    let cloneForm = JSON.parse(JSON.stringify(form));
                    let entityType = entitiesData[0].childHierarchyPath[pointerToChildHierarchy];
                    cloneForm["field"] = entityType;
                    cloneForm["label"] = `Select ${gen.utils.camelCaseToTitleCase(entityType)}`;

                    if (roleEntityType === entityType) {
                        cloneForm.validation.required = true;
                    }

                    forms.push(cloneForm);
                }

                return resolve({
                    message: constants.apiResponses.ENTITIES_MAPPING_FORM_FETCHED,
                    result: forms
                });

            } catch (error) {
                return reject(error);
            }
        })
    }

    /**
      * To search the users
      * @method
      * @name isSystemAdmin
      * @param {String} searchText search text
      * @param {String} token user access token
      * @returns {Object} returns a user details.
     */

    static search(searchText, token) {
        return new Promise(async (resolve, reject) => {
            try {

                let searchFields = ['userName', 'email', 'phone'];
                let userInfo;
                for (let index = 0; index < searchFields.length; index++) {
                    let userFilters = {};
                    userFilters[searchFields[index]] = searchText;
                    let userSearchResult =
                        await sunbirdService.userSearch(userFilters, token);
                    if (userSearchResult
                        && userSearchResult.result
                        && userSearchResult.result.count
                        && userSearchResult.result.count > 0) {
                        userInfo = userSearchResult.result.content;
                        break;
                    }
                }
                if (userInfo) {

                    let userData = {
                        lastName:userInfo[0].lastName,
                        maskedPhone:userInfo[0].maskedPhone,
                        email:userInfo[0].email,
                        identifier:userInfo[0].identifier,
                        userName:userInfo[0].userName
                    }
                    
                    return resolve({
                        result: userData,
                        message: constants.apiResponses.USER_EXTENSION_FETCHED
                    });
                } else {
                    return resolve({
                        result: {},
                        message: constants.apiResponses.USER_NOT_FOUND
                    });
                }
            } catch (error) {
                return reject(error);
            }
        })
    }

      /**
      * User targeted solutions.
      * @method
      * @name solutions
      * @param {String} programId - program id.
      * @param {Object} requestedData requested data.
      * @param {String} pageSize page size.
      * @param {String} pageNo page no.
      * @param {String} search search text.
      * @returns {Object} targeted user solutions.
     */

    static solutions( programId,requestedData,pageSize,pageNo,search ) {
        return new Promise(async (resolve, reject) => {
            try {
                
                let autoTargetedSolutions = 
                await solutionsHelper.forUserRoleAndLocation(
                    requestedData,
                    "",
                    "",
                    programId,
                    pageSize,
                    pageNo,
                    search
                );

                if( autoTargetedSolutions.data.data && autoTargetedSolutions.data.data.length > 0 ) {
                    autoTargetedSolutions.data["programName"] = autoTargetedSolutions.data.data[0].programName;
                    autoTargetedSolutions.data["programId"] = autoTargetedSolutions.data.data[0].programId;

                    autoTargetedSolutions.data.data = 
                    autoTargetedSolutions.data.data.map( targetedData => {
                        delete targetedData.programId;
                        delete targetedData.programName;
                        return targetedData;
                    });
                }

                autoTargetedSolutions.data["description"] = constants.common.TARGETED_SOLUTION_TEXT;

                return resolve({
                    message : constants.apiResponses.PROGRAM_SOLUTIONS_FETCHED,
                    success : true,
                    data : autoTargetedSolutions.data
                })
            } catch (error) {
                return resolve({
                    success : false,
                    data : {
                        description : constants.common.TARGETED_SOLUTION_TEXT,
                        data : [],
                        count : 0
                    }
                })
            }
        })
    }

    /**
    * User targeted programs.
    * @method
    * @name programs
    * @param {Object} bodyData - request body data.
    * @param {String} pageNo - Page number.
    * @param {String} pageSize - Page size.
    * @param {String} searchText - Search text.
    * @returns {Array} - Get user targeted programs.
    */

   static programs(bodyData, pageNo, pageSize,searchText) {
       return new Promise(async (resolve, reject) => {
            try {

                let targetedProgrms = await programsHelper.forUserRoleAndLocation(
                    bodyData,
                    pageSize,
                    pageNo,
                    searchText
                );

                if (!targetedProgrms.success) {
                    throw {
                        message : constants.apiResponses.PROGRAM_NOT_FOUND
                    }
                }
                    
                targetedProgrms.data["description"] = constants.apiResponses.PROGRAM_DESCRIPTION;

                return resolve({
                    success: true,
                    message: constants.apiResponses.USER_TARGETED_PROGRAMS_FETCHED,
                    data : targetedProgrms.data
                });

            } catch (error) {
                return resolve({
                    success: false,
                    message: error.message,
                    data : {
                        description : constants.common.TARGETED_SOLUTION_TEXT,
                        data : [],
                        count : 0
                    }
                });
            }
        })
    }

      /**
      * List of entity types by location and role.
      * @method
      * @name entityTypesByLocationAndRole
      * @param {String} stateLocationId - state location id.
      * @param {String} role - role.
      * @returns {Object} returns a list of entity type by location and role.
     */

    static entityTypesByLocationAndRole(stateLocationId, role) {
        return new Promise(async (resolve, reject) => {
            try {

                const entitiesData = await entitiesHelper.entityDocuments({
                    "registryDetails.locationId" : stateLocationId
                }, ["_id"]);

                if (!entitiesData.length > 0) {
                    throw {
                        message: constants.apiResponses.ENTITIES_NOT_EXIST_IN_LOCATION
                    }
                }

                const rolesDocument = await userRolesHelper.roleDocuments({
                    code : role.toUpperCase()
                },["_id","entityTypes.entityType"]);

                if (!rolesDocument.length > 0) {
                    throw {
                        message: constants.apiResponses.USER_ROLES_NOT_FOUND
                    }
                }

                let entityTypes = [];
                let stateEntityExists = false;

                rolesDocument[0].entityTypes.forEach( roleDocument => {
                    if( roleDocument.entityType === constants.common.STATE_ENTITY_TYPE ) {
                        stateEntityExists = true;
                    }
                });

                if( stateEntityExists ) {
                    entityTypes = [constants.common.STATE_ENTITY_TYPE]
                } else {
                    
                    let entitiesMappingForm = 
                    await this.entitiesMappingForm(
                        entitiesData[0]._id,
                        rolesDocument[0]._id
                    );

                    entitiesMappingForm.result.forEach( entitiesMappingData => {
                        entityTypes.push(entitiesMappingData.field)
                    });
                }

                return resolve({
                    success : true,
                    message : constants.apiResponses.ENTITY_TYPES_FETCHED,
                    data : entityTypes
                });

            } catch (error) {
                return resolve({
                    success : false,
                    message : error.message
                });
            }
        })
    }

};