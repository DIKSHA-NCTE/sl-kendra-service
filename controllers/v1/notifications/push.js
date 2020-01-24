/**
 * name : push.js
 * author : Aman Jung Karki
 * created-date : 25-Nov-2019
 * Description :  Push notifications.
 */

// dependencies

const csv = require('csvtojson');
const userExtensionHelper = require(MODULES_BASE_PATH + "/user-extension/helper");
const pushNotificationsHelper = require(MODULES_BASE_PATH + "/notifications/push/helper");
const csvFileStream = require(ROOT_PATH + "/generics/file-stream");

/**
    * Push Notifications
    * @class
*/

module.exports = class PushNotifications {

    /**
     * @apiDefine errorBody
     * @apiError {String} status 4XX,5XX
     * @apiError {String} message Error
     */

    /**
     * @apiDefine successBody
     * @apiSuccess {String} status 200
     * @apiSuccess {String} result Data
     */

    constructor() {}

    static get name() {
        return "push";
    }

    /**
     * @api {post} /kendra/api/v1/notifications/push/registerDevice  
     * Register device for push notifications
     * @apiVersion 1.0.0
     * @apiGroup pushNotifications
     * @apiHeader {String} X-authenticated-user-token Authenticity token
     * @apiParam {File} userData Mandatory userData file of type csv.
     * @apiSampleRequest /kendra/api/v1/notifications/push/registerDevice
     * @apiUse successBody
     * @apiUse errorBody
     */

      /**
      * Register device id for the particular logged in user.
      * @method
      * @name registerDevice
      * @param  {Request}  req  request body.
      * @returns {JSON} Response consists of status and result.Result is an object consists of key-value pairs.
     */

    async registerDevice(req) {
        return new Promise(async (resolve, reject) => {
            try {

                let deviceData = {
                    deviceId: req.body.deviceId,
                    app: req.headers.app,
                    os: req.headers.os,
                    status: "active",
                    activatedAt: new Date()
                };

                let result = await userExtensionHelper.createOrUpdate(deviceData, _.pick(req.userDetails, ["userId", "email", "userName"]));

                let response = {};

                if (result && result.success) {

                    response["result"] = {};

                    let topicArray = [ 
                        deviceData.app.trim()+"-"+ process.env.NODE_ENV +"-allUsers",
                        deviceData.app.trim()+"-"+ process.env.NODE_ENV + "-android"+"-allUsers",
                        deviceData.app.trim()+"-"+ process.env.NODE_ENV + "-ios"+"-allUsers"
                    ];

                    await Promise.all(topicArray.map(async topicName => {

                        deviceData.topic = topicName;
                        let subscribeResult = await pushNotificationsHelper.subscribeToTopic(_.pick(deviceData, ["deviceId", "topic"]));

                        response["result"][topicName] = subscribeResult.success ? "Subscribed" : "Could not subscribee";

                    }));
                } else {
                    response["status"] = httpStatusCode.ok.status;
                }

                return resolve(response);

            } catch (error) {

                return reject({
                    status: error.status || httpStatusCode["internal_server_error"].status,
                    message: error.message || httpStatusCode["internal_server_error"].message,
                    errorObject: error
                });

            }
        })

    }

    /**
     * @api {post} /kendra/api/v1/notifications/push/pushToUsers  
     * Push Notifications To Users
     * @apiVersion 1.0.0
     * @apiGroup pushNotifications
     * @apiHeader {String} X-authenticated-user-token Authenticity token
     * @apiParam {File} userData Mandatory userData file of type csv.
     * @apiSampleRequest /kendra/api/v1/notifications/push/pushToUsers
     * @apiUse successBody
     * @apiUse errorBody
     */

    /**
      * Push sample data to the particular device id.
      * Send notification users is done via by uploading csv.
      * @method
      * @name pushToUsers
      * @param  {Request}  req  request body.
      * @returns {csv} Response consists of exactly 
      * the same csv that we upload with extra column status.
     */


    async pushToUsers(req) {

        return new Promise(async (resolve, reject) => {

            try {

                if (!req.files || !req.files.userData) {
                    throw { message: "Missing file of type userData" }
                }

                let userData = 
                await csv().fromString(req.files.userData.data.toString());

                const fileName = `push-to-device`;
                let fileStream = new csvFileStream(fileName);
                let input = fileStream.initStream();

                (async function () {
                    await fileStream.getProcessorPromise();
                    return resolve({
                        isResponseAStream: true,
                        fileNameWithPath: fileStream.fileNameWithPath()
                    });
                })();

                await Promise.all(userData.map(async element => {

                    let userProfile = 
                    await userExtensionHelper.userExtensionDocument({
                        userId: element.userId,
                        status: "active",
                        isDeleted: false
                    }, {
                            devices: 1
                    });

                    if (userProfile && userProfile.devices.length > 0) {

                        let deviceArray = userProfile.devices;

                        await Promise.all(deviceArray.map(async device => {

                            if (device.app == element.appName 
                                && device.status !== "inactive") {

                                let notificationResult;

                                device.message = element.message;
                                device.title = element.title;

                                if (element.message && element.title) {
                                    notificationResult = 
                                    await pushNotificationsHelper.createNotificationInAndroid(device);

                                    if (notificationResult !== undefined 
                                        && notificationResult.success) {

                                        let updateStatus = 
                                        await userExtensionHelper.updateDeviceStatus(
                                            device, deviceArray, element.userId);

                                        //unsubscribe the deviceId from the topic
                                        let topicArray = [
                                            device.app.trim()+"-"+ process.env.NODE_ENV +"-allUsers",
                                            device.app.trim()+"-"+ process.env.NODE_ENV + "-android"+"-allUsers",
                                            device.app.trim()+"-"+ process.env.NODE_ENV + "-ios"+"-allUsers"
                                        ];

                                        await Promise.all(topicArray.map(async topicName => {

                                            device.topic = topicName;
                                            let unsubscribeResult = 
                                            await pushNotificationsHelper.unsubscribeFromTopic(device);
                                        }))

                                        element.status = "Success";

                                    }
                                    else {

                                        element.status = "Fail";
                                    }

                                }
                                else {
                                    element.status = 
                                    "Message or title is not present in csv";
                                }

                            } else {
                                element.status = 
                                "App name could not be found or status is inactive";
                            }

                        }));

                    } else {
                        element.status = "No devices found.";
                    }


                    input.push(element);

                }));

                input.push(null);

            } catch (error) {

                return reject({
                    status: error.status || 500,
                    message: error.message || "Oops! something went wrong.",
                    errorObject: error
                });

            }
        })

    }

    /**
    * @api {post} /kendra/api/v1/notifications/push/pushToTopic 
    * Push Notification to topic
    * @apiVersion 1.0.0
    * @apiGroup pushNotifications
    * @apiSampleRequest /kendra/api/v1/notifications/push/pushToTopic
    * @apiParam {File} pushToTopic Mandatory pushToTopic file of type csv.    
    * @apiUse successBody
    * @apiUse errorBody
    */

     /**
      * Push sample data to the topic given.
      * @method
      * @name pushToTopic
      * @param  {Request}  req  request body.It consists of csv to push data to particular topic.
      * @returns {csv} Response consists of exactly the same csv that we upload with extra column status.
     */

    async pushToTopic(req) {
        return new Promise(async (resolve, reject) => {

            try {

                if (!req.files || !req.files.pushToTopic) {
                    throw { message: "Missing file of type pushToTopic" };
                }

                let topicData = 
                await csv().fromString(req.files.pushToTopic.data.toString());

                const fileName = `push-to-topic`;
                let fileStream = new csvFileStream(fileName);
                let input = fileStream.initStream();

                (async function () {
                    await fileStream.getProcessorPromise();
                    return resolve({
                        isResponseAStream: true,
                        fileNameWithPath: fileStream.fileNameWithPath()
                    });
                })();

                await Promise.all(topicData.map(async singleTopicData => {

                    let topicCsvData = 
                    await pushNotificationsHelper.pushData(singleTopicData);

                    input.push(topicCsvData);

                }))

                input.push(null);

            } catch (error) {

                return reject({
                    status: error.status || 500,
                    message: error.message || "Oops! something went wrong.",
                    errorObject: error
                });

            }
        })

    }


    /**
    * @api {post} /kendra/api/v1/notifications/push/pushToAllUsers  
    * Push Notification To ALL Users
    * @apiVersion 1.0.0
    * @apiGroup pushNotifications
    * @apiSampleRequest /kendra/api/v1/notifications/push/pushToAllUsers
    * @apiHeader {String} X-authenticated-user-token Authenticity token
    * @apiParam {File} pushToAllUsers Mandatory pushToAllUsers file of type csv.        
    * @apiUse successBody
    * @apiUse errorBody
    */

    /**
      *  Push sample data to all users.
      * @method
      * @name pushToAllUsers 
      * @param  {Request}  req  request body.It consists of csv to be uploaded for pushing to all users.
      * @returns {csv} Response consists of exactly the same csv that we upload with extra column status.
     */

    async pushToAllUsers(req) {
        return new Promise(async (resolve, reject) => {

            try {

                if (!req.files || !req.files.pushToAllUsers) {
                    throw { message: "Missing file of type pushToAllUsers" };
                }

                let pushToAllUsers = 
                await csv().fromString(req.files.pushToAllUsers.data.toString());

                const fileName = `push-to-all-users`;
                let fileStream = new csvFileStream(fileName);
                let input = fileStream.initStream();

                (async function () {
                    await fileStream.getProcessorPromise();
                    return resolve({
                        isResponseAStream: true,
                        fileNameWithPath: fileStream.fileNameWithPath()
                    });
                })();


                await Promise.all(pushToAllUsers.map(async allUserData => {

                    let topicPushStatus = 
                    await pushNotificationsHelper.pushData(allUserData);

                    input.push(topicPushStatus);

                }))

                input.push(null);

            } catch (error) {

                return reject({
                    status: error.status || 500,
                    message: error.message || "Oops! something went wrong.",
                    errorObject: error
                });

            }
        })

    }


    /**
    * @api {post} /kendra/api/v1/notifications/push/subscribeToTopic  
    * Subscribe To Topic
    * @apiVersion 1.0.0
    * @apiGroup pushNotifications
    * @apiSampleRequest /kendra/api/v1/notifications/push/subscribeToTopic
    * @apiHeader {String} X-authenticated-user-token Authenticity token
    * @apiParam {File} subscribeToTopic Mandatory subscribeToTopic file of type csv.            
    * @apiUse successBody
    * @apiUse errorBody
    */

    /**
      * Subscribe sample data to particular topic.
      * @method
      * @name subscribeToTopic 
      * @param  {Request}  req  request body.It consists of csv to be uploaded for subscribing data to topic.
      * @returns {csv} Response consists of exactly the same csv that we upload with extra column status.
     */

    async subscribeToTopic(req) {
        return new Promise(async (resolve, reject) => {

            try {

                if (!req.files || !req.files.subscribeToTopic) {
                    throw { message: "Missing file of type subscribeToTopic" };
                }

                let subscribersData = 
                await csv().fromString(req.files.subscribeToTopic.data.toString());

                const fileName = `subscribe-to-topic`;
                let fileStream = new csvFileStream(fileName);
                let input = fileStream.initStream();

                (async function () {
                    await fileStream.getProcessorPromise();
                    return resolve({
                        isResponseAStream: true,
                        fileNameWithPath: fileStream.fileNameWithPath()
                    });
                })();

                await Promise.all(subscribersData.map(async subscriber => {

                    let subscribeStatus = 
                    await pushNotificationsHelper.subscribeOrUnSubscribeData(subscriber, true);

                    input.push(subscribeStatus);
                }))

                input.push(null);

            } catch (error) {

                return reject({
                    status: error.status || 500,
                    message: error.message || "Oops! something went wrong.",
                    errorObject: error
                })

            }
        })

    }

    /**
    * @api {post} /kendra/api/v1/notifications/push/unsubscribeFromTopic  
    * Unsubscribe From Topic
    * @apiVersion 1.0.0
    * @apiGroup pushNotifications
    * @apiSampleRequest /kendra/api/v1/notifications/push/unsubscribeFromTopic
    * @apiHeader {String} X-authenticated-user-token Authenticity token
    * @apiParam {File} unsubscribeFromTopic Mandatory unsubscribeFromTopic file of type csv.                
    * @apiUse successBody
    * @apiUse errorBody
    */

     /**
      * UnSubscribe sample data to particular topic.
      * @method
      * @name unsubscribeFromTopic 
      * @param  {Request}  req  request body.It consists of csv to be uploaded for unSubscribing data From topic.
      * @returns {csv} Response consists of exactly the same csv that we upload with extra column status.
     */

    async unsubscribeFromTopic(req) {
        return new Promise(async (resolve, reject) => {

            try {

                if (!req.files || !req.files.unsubscribeFromTopic) {
                    throw { message: "Missing file of type unSubscribeFromTopic" };
                }

                let unsubscribersData = 
                await csv().fromString(req.files.unsubscribeFromTopic.data.toString());

                const fileName = `unsubscribe-from-topic`;
                let fileStream = new csvFileStream(fileName);
                let input = fileStream.initStream();

                (async function () {
                    await fileStream.getProcessorPromise();
                    return resolve({
                        isResponseAStream: true,
                        fileNameWithPath: fileStream.fileNameWithPath()
                    });
                })();


                await Promise.all(unsubscribersData.map(async unsubscriber => {

                    let unSubscribeStatus = 
                    await pushNotificationsHelper.subscribeOrUnSubscribeData(unsubscriber);

                    input.push(unSubscribeStatus);
                }))

                input.push(null);

            } catch (error) {

                return reject({
                    status: error.status || 500,
                    message: error.message || "Oops! something went wrong.",
                    errorObject: error
                })

            }
        })

    }

      /**
    * @api {post} /kendra/api/v1/notifications/push/bodh
    * Unsubscribe From Topic
    * @apiVersion 1.0.0
    * @apiGroup notifications
    * @apiSampleRequest /kendra/api/v1/notifications/push/bodh
    * @apiHeader {String} X-authenticated-user-token Authenticity token
    * @apiParam {File} notifications Mandatory file of type csv.                
    * @apiUse successBody
    * @apiUse errorBody
    */

     /**
      * Push notification data to bodh.
      * @method
      * @name bodh 
      * @param  {Object} req - All requested data.
     */

    async bodh(req) {
        return new Promise(async (resolve, reject) => {

            try {

                if (!req.file || req.file !== "notifications") {
                    throw { message: "Missing file of type notifications" };
                }

                let notificationsData = req.csvData;
                let userExternalIds = [];
                let usersData = [];

                let fileStream = new csvFileStream("push-to-bodh");
                let input = fileStream.initStream();
            
                (async function () {
                  await fileStream.getProcessorPromise();
                  return resolve({
                    isResponseAStream: true,
                    fileNameWithPath: fileStream.fileNameWithPath()
                });
                }());

                notificationsData.forEach(eachNotificationData=>{
                    let userIds = eachNotificationData["userIds"].split(",");

                    if(userIds.length >0) {

                        for(let pointerToUserId = 0;
                            pointerToUserId<userIds.length;
                            pointerToUserId++
                        ) {
                            let notificationData = {...eachNotificationData};
                            notificationData["data"] = eachNotificationData.target?{
                                title:eachNotificationData.target
                            }:{};
    
                            delete notificationData.target;
                            delete notificationData.id;
                            delete notificationData.userIds;
                            delete notificationData.users;

                            userExternalIds.push(userIds[pointerToUserId]);
                            notificationData["userExternalId"] = 
                            userIds[pointerToUserId];

                            usersData.push(notificationData);
                        }
                    }
                })

                let userProfiles = 
                await database.models.userExtension.find({
                    externalId: {
                        $in:userExternalIds
                    },
                    status: "active",
                    isDeleted: false
                }, {
                    devices: 1,
                    userId:1,
                    externalId :1
                }).lean();

                let userProfilesData = _.keyBy(userProfiles,"externalId");

                await Promise.all(usersData.map(
                    async singleUserData => {
                        
                        if(userProfilesData[singleUserData.userExternalId]) {
                            let devicesArray = 
                            userProfilesData[singleUserData.userExternalId].devices;

                            let activeDevices =
                            devicesArray.filter(eachUserDevice=>{
                                if(eachUserDevice.app === process.env.BODH_NOTIFICATIONS_NAME 
                                    && eachUserDevice.os === singleUserData.os && 
                                    eachUserDevice.status !== "inactive") {
                                        return eachUserDevice;
                                    }
                            });

                            if(activeDevices.length>0) {
                                let bodhNotifications = 
                                await pushNotificationsHelper.sendNotificationsToBodh
                                (
                                    singleUserData,
                                    activeDevices,
                                    userProfilesData[singleUserData.userExternalId].userId,
                                    singleUserData.label
                                );
                                
                              
                                singleUserData["status"] = 
                                bodhNotifications?"Success":"failure";
                            } else {
                                singleUserData["status"] = "No active devices";
                            }
                        } else {
                            singleUserData["status"] = "User could not be found";
                        }
                        singleUserData.target = singleUserData.data.title;
                        delete singleUserData.data;

                        input.push(singleUserData);
                }));

                input.push(null);


            } catch (error) {

                return reject({
                    status: error.status || 500,
                    message: error.message || "Oops! something went wrong.",
                    errorObject: error
                })

            }
        })

    }

};

