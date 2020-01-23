/**
 * name : module/notifications/in-app/helper.js
 * author : Aman Jung Karki
 * Date : 15-Nov-2019
 * Description : In-app helper.
 */

//dependencies
const elasticSearchHelper = require(ROOT_PATH + "/generics/helpers/elastic-search");
const kafkaCommunication = require(ROOT_PATH + "/generics/helpers/kafka-communications");
const moment = require("moment-timezone");
let currentDate = moment(new Date());
const slackClient = require(ROOT_PATH + "/generics/helpers/slack-communications");
const userExtensionHelper = require(MODULES_BASE_PATH + "/user-extension/helper");
const pushNotificationsHelper = require(MODULES_BASE_PATH + "/notifications/push/helper");
// const FCM_HELPER = require(MODULES_BASE_PATH + "/notifications/fcm/helper");

/**
    * InAppNotificationsHelper
    * @class
*/

module.exports = class InAppNotificationsHelper {

      /**
      * List of notifications data
      * @method
      * @name list
      * @param {String} userDetails - Logged in user id.
      * @param {Number} pageSize - Total page size.
      * @param {Number} pageNo - Total page no.
      * @param {String} [appName = ""] - Name of the app
      * @param {String} [headers = ""] - app headers       
      * @returns {Promise} returns a promise.
     */

    static list(userDetails, pageSize, pageNo, appName = "", headers = "") {
        return new Promise(async (resolve, reject) => {
            try {

                await elasticSearchHelper.pushAppVersionToLoggedInUser(
                    userDetails, headers, appName
                );

                let getNotificationDocument = 
                await elasticSearchHelper.getNotificationData(
                    userDetails, appName
                );

                if (getNotificationDocument.statusCode !== httpStatusCode["ok"].status) {
                    return resolve({
                        data: [],
                        count: 0
                    })
                }

                let notificationInDescendingOrder = 
                getNotificationDocument.body._source.notifications.reverse();

                let skippedValue = pageSize * (pageNo - 1);
                let limitingValue = pageSize;

                let paginatedData = 
                notificationInDescendingOrder.splice(skippedValue, limitingValue);

                return resolve({
                    data: paginatedData,
                    count: getNotificationDocument.body._source.notificationCount
                });

            } catch (error) {
                return reject(error);
            }
        })
    }

     /**
      * mark is_read- true to a specific notification.
      * @method
      * @name markAsRead
      * @param {String} userDetails - Logged in user id.
      * @param {String} [appName = ""] - Name of the app
      * @param {String} notificatonNumber - id of notification       
      * @returns {Promise} returns a promise.
     */
  
    static markAsRead(userDetails, notificatonNumber, appName = "") {
        return new Promise(async (resolve, reject) => {
            try {

                let updateNotificationDocument = 
                await elasticSearchHelper.updateNotificationData(
                    userDetails, 
                    Number(notificatonNumber), 
                    { is_read: true }, 
                    appName
                );

                return resolve(updateNotificationDocument);
            } catch (error) {
                return reject(error);
            }
        })
    }

    /**
      * unread notification 
      * @method
      * @name unReadCount
      * @param {String} userDetails - Logged in user id.
      * @param {String} [appName = ""] - Name of the app
      * @param {Object} headers - app headers
      * @param {String} headers.platform - device platform.
      * @param {String} headers.appName - name of the app.                    
      * @returns {Promise} returns a promise.
     */

    static unReadCount(userDetails, appName = "", headers) {
        return new Promise(async (resolve, reject) => {
            try {

                let response = {
                    count: 0,
                    data: []
                };

                if (headers.platform && headers.appname) {
                    await elasticSearchHelper.pushAppVersionToLoggedInUser(
                        userDetails, 
                        headers, 
                        appName
                    );

                    let getNotificationDocument = 
                    await elasticSearchHelper.getNotificationData(
                        userDetails, 
                        appName
                    );

                    if (getNotificationDocument.statusCode === httpStatusCode["ok"].status) {

                        response["count"] = 
                        getNotificationDocument.body._source.notificationUnreadCount;

                        let data = 
                        getNotificationDocument.body._source.notifications.filter(
                            item => item.payload.type === "appUpdate" && 
                            item.is_read === false && 
                            item.payload.platform === headers.platform);

                        if (data.length > 0) {
                            response["data"] = data;
                        }

                    }
                }

                return resolve(response);

            } catch (error) {
                return reject(error);
            }
        })
    }

    /**
      * search notifications
      * @method 
      * @name search                   
      * @returns {Promise} returns a promise.
     */

    static search() {
        return new Promise(async (resolve, reject) => {
            try {
                const USER_NOTIFICATION_DOCUMENT = await elasticsearch.client.search({
                    index: "samiksha",
                    type: "user-notification",
                    size: 1000
                });

                let notifications = USER_NOTIFICATION_DOCUMENT.body.hits.hits;
                return resolve(notifications);
            }
            catch (error) {
                return reject(error);
            }
        })
    }

      /**
      * Pending assessments or pending observations. 
      * @method
      * @name pendingAssessmentsOrObservations
      * @param {Object} assessmentOrObservationData - Logged in user id.
      * @param {String} [observation = false] - check if it is for pending observation. If true pending observation functionality is run otherwise pending assessments.                  
      * @returns {Promise} returns a promise.
     */


    static pendingAssessmentsOrObservations(assessmentOrObservationData, observation = false) {
        return new Promise(async (resolve, reject) => {
            try {

                let pendingData = assessmentOrObservationData.filter(singleData => {
                    let pendingCreatedDate = moment(singleData.createdAt);
                    let dateDifferenceWithPendingAssessment = 
                    currentDate.diff(pendingCreatedDate, 'days');

                    if (dateDifferenceWithPendingAssessment >= 14) {
                        return singleData;
                    }
                })

                if (pendingData.length > 0) {

                    let result = {
                        is_read: false,
                        action: "pending",
                        internal: false,
                        type: "Information",
                        created_at: new Date(),
                        payload: {
                            type: "institutional"
                        },
                        title: "Pending Assessment!",
                        text: "You have a Pending Assessment",
                        appName: "samiksha"
                    };

                    if (observation) {
                        result.payload["type"] = "observation";
                        result.title = "Pending Observation!";
                        result.text = "You have a Pending Observation"
                    }

                    for (let pointerToPendingData = 0; 
                        pointerToPendingData < pendingData.length; 
                        pointerToPendingData++) {

                          result.payload["solution_id"] = 
                          pendingData[pointerToPendingData].solutionId;

                          result.payload["submission_id"] = 
                          pendingData[pointerToPendingData]._id;

                          result.payload["entity_id"] = 
                          pendingData[pointerToPendingData].entityId;

                          result.payload["entity_name"] = 
                          pendingData[pointerToPendingData].entityName;
                          
                          result["user_id"] = 
                          pendingData[pointerToPendingData].userId;

                          if (observation) {
                            result.payload["observation_id"] = 
                            pendingData[pointerToPendingData].observationId;
                        } else {
                            result.payload["program_id"] = 
                            pendingData[pointerToPendingData].programId;
                        }

                        let pushAssessmentsOrObservationsToKafka = 
                        await kafkaCommunication.pushNotificationsDataToKafka(result);

                        if (pushAssessmentsOrObservationsToKafka && pushAssessmentsOrObservationsToKafka.status && pushAssessmentsOrObservationsToKafka.status != "success") {
                            let errorObject = {
                                userId: result.user_id,
                                message: `Failed to push ${result.title} to kafka`,
                                payload: result.payload,
                                slackErrorName: gen.utils.checkIfEnvDataExistsOrNot("SLACK_ERROR_NAME"),
                                color: gen.utils.checkIfEnvDataExistsOrNot("SLACK_ERROR_MESSAGE_COLOR")
                            };
                            slackClient.sendMessageToSlack(errorObject);
                            return;
                        }
                    }
                }
            }
            catch (error) {
                return reject(error);
            }
        })
    }

       /**
      * Completed assessments or pending observations functionality. 
      * @method
      * @name completedAssessmentsOrObservations
      * @param {Object} assessmentOrObservationData - Logged in user id.
      * @param {String} [observation = false] - check if it is for completed observation. If true completed observation functionality is run otherwise completed assessments.                  
      * @returns {Promise} returns a promise.
     */


    static completedAssessmentsOrObservations(assessmentOrObservationData, observation = false) {
        return new Promise(async (resolve, reject) => {
            try {

                let userCompletionData = {};

                for (let indexToAssessmentOrObservationData = 0; 
                    indexToAssessmentOrObservationData < assessmentOrObservationData.length; 
                    indexToAssessmentOrObservationData++) {
                      
                      let createdAtDate = 
                      moment(assessmentOrObservationData[indexToAssessmentOrObservationData].createdAt)
                      .format("YYYY-MM-DD");

                      let checkDate = moment(currentDate).isSame(createdAtDate, 'month');

                       if (checkDate) {

                        if (
                            !userCompletionData[assessmentOrObservationData[indexToAssessmentOrObservationData].userId]
                        ) {
                            userCompletionData[assessmentOrObservationData[indexToAssessmentOrObservationData].userId] = {};
                            userCompletionData[assessmentOrObservationData[indexToAssessmentOrObservationData].userId]["count"] = 0;
                        }

                        userCompletionData[assessmentOrObservationData[indexToAssessmentOrObservationData].userId]["count"] += 1;
                    }
                }

                let allUserCompletionData = Object.keys(userCompletionData);

                if (allUserCompletionData.length > 0) {

                    let result = {
                        is_read: false,
                        payload: {
                            type: "institutional"
                        },
                        action: "view_only",
                        internal: false,
                        title: "Congratulations!",
                        type: "Information",
                        "created_at": new Date(),
                        appName: "samiksha"
                    };

                    if (observation) {
                        result.payload.type = "observation";
                    }

                    for (let pointerToUserData = 0; 
                        pointerToUserData < allUserCompletionData.length; 
                        pointerToUserData++) {

                          result.user_id = allUserCompletionData[pointerToUserData];
                          result.text = observation ? `You have Completed ${userCompletionData[allUserCompletionData[pointerToUserData]].count} Observations this month!` : `You have Completed ${userCompletionData[allUserCompletionData[pointerToUserData]].count} Assessments this month!`;
                          let pushCompletedAssessmentsOrObservationsToKafka = await kafkaCommunication.pushNotificationsDataToKafka(result);

                          if (pushCompletedAssessmentsOrObservationsToKafka.status && pushCompletedAssessmentsOrObservationsToKafka.status != "success") {
                             let errorObject = {
                                slackErrorName: gen.utils.checkIfEnvDataExistsOrNot("SLACK_ERROR_NAME"),
                                color: gen.utils.checkIfEnvDataExistsOrNot("SLACK_ERROR_MESSAGE_COLOR"),
                                message: observations ? 
                                `Failed to push completed observations to kafka` : 
                                `Failed to push completed assessments to kafka`,
                                payload: result.payload
                            };

                            slackClient.sendMessageToSlack(errorObject);
                            return;
                        }
                    }
                }

                return resolve();

            }
            catch (error) {
                return reject(error);
            }
        })
    }

      /**
      * Create notification.
      * @method
      * @name create
      * @param {String} userId - Logged in user id.
      * @param {Object} data - Notification data to be created.
      * @returns {Promise} returns a promise.
     */

    static create(userId, data) {
        return new Promise(async (resolve, reject) => {
            try {
                const createdDocument = 
                await elasticSearchHelper.pushNotificationData(userId, data);

                return resolve({
                    status: httpStatusCode["ok"].status,
                    result: "Success"
                });
            }
            catch (error) {
                return reject(error);
            }
        })
    }

    /**
      * Push notifications data pushed to the particular logged in user.
      * @method
      * @name pushNotificationMessageToDevice
      * @param {String} userId - Logged in user id.
      * @param {Object} notificationMessage - 
      * @param {String} notificationMessage.title - title of notification.
      * @param {String} notificationMessage.text - text of notification.
      * @param {String} notificationMessage.id - id of notification.
      * @param {String} notificationMessage.is_read - is_read property of notification.
      * @param {Object} notificationMessage.payload - payload of notification. 
      * @param {String} notificationMessage.action - action of notification.
      * @param {String} notificationMessage.internal - internal of notification.
      * @param {String} notificationMessage.created_at - created_at date of notification.
      * @param {String} notificationMessage.type - type date of notification.         
      * @returns {Promise} returns a promise.
     */

    static pushNotificationMessageToDevice(userId, notificationMessage) {
        return new Promise(async (resolve, reject) => {
            try {

                let getAllDevices = 
                await userExtensionHelper.userExtensionDocument({
                    userId: userId,
                    status: "active",
                    isDeleted: false
                }, { devices: 1 });

                if (!getAllDevices.devices.length > 0) {
                    throw "No devices found";
                }

                let getSpecificAppData = 
                getAllDevices.devices.filter(eachDeviceName => eachDeviceName.app === notificationMessage.appName
                    && eachDeviceName.status === "active"
                );

                for (let pointerToDevices = 0; 
                    pointerToDevices < getSpecificAppData.length; 
                    pointerToDevices++) {

                      let notificationDataToBeSent = {
                        deviceId: getSpecificAppData[pointerToDevices].deviceId,
                        title: notificationMessage.title,
                        data: {
                            "title": notificationMessage.title,
                            "text": notificationMessage.text,
                            id: JSON.stringify(notificationMessage.id),
                            is_read: JSON.stringify(notificationMessage.is_read),
                            payload: JSON.stringify(notificationMessage.payload),
                            action: notificationMessage.action,
                            internal: JSON.stringify(notificationMessage.internal),
                            created_at: notificationMessage.created_at,
                            type: notificationMessage.type
                        },
                        text: notificationMessage.text
                    };

                    let pushedData = 
                    await pushNotificationsHelper.createNotificationInAndroid(notificationDataToBeSent);

                    if ( !pushedData.status ) {

                        let errorObject = {
                            slackErrorName: gen.utils.checkIfEnvDataExistsOrNot("SLACK_ERROR_NAME"),
                            color: gen.utils.checkIfEnvDataExistsOrNot("SLACK_ERROR_MESSAGE_COLOR"),
                            message: `Cannot sent push notifications to ${getAllDevices.devices[pointerToDevices].deviceId}`
                        };

                        slackClient.sendMessageToSlack(errorObject);
                    }
                }

                return resolve();

            } catch (error) {
                return reject(error);
            }
        })
    }

      /**
      * Send app update status as notification.
      * @method
      * @name updateAppVersion
      * @param {Object} updateAppData - app update data.
      * @param {String} updateAppData.appName - app name of notification. 
      * @param {String} updateAppData.title - title of notification.
      * @param {String} updateAppData.text - text of notification.
      * @param {String} updateAppData.version - version of the app.
      * @param {String} updateAppData.status - status of the update notification.
      * @param {String} updateAppData.platform - device platform.  
      * @returns {Promise} returns a promise.
     */

    static updateAppVersion(updateAppData) {
        return new Promise(async (resolve, reject) => {
            try {


                for (let pointerToUpdateAppData = 0; 
                    pointerToUpdateAppData < updateAppData.length; 
                    pointerToUpdateAppData++) {

                      let result = {};

                      result["is_read"] = false;
                      result["internal"] = true;
                      result["action"] = "versionUpdate";
                      result["appName"] = updateAppData[pointerToUpdateAppData].appName;
                      result["created_at"] = new Date();
                      result["text"] = updateAppData[pointerToUpdateAppData].text;
                      result["title"] = updateAppData[pointerToUpdateAppData].title;
                      result["type"] = "Information";
                      result["payload"] = {};
                      result["payload"]["appVersion"] = updateAppData[pointerToUpdateAppData].version;
                      result["payload"]["updateType"] = updateAppData[pointerToUpdateAppData].status;
                      result["payload"]["type"] = "appUpdate";
                      result["payload"]["platform"] = updateAppData[pointerToUpdateAppData].platform;

                    await kafkaCommunication.pushNotificationsDataToKafka(result);
                }

                return resolve();

            } catch (error) {
                return reject(error);
            }
        })
    }

};