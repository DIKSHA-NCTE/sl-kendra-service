/**
 * name : sunbirdService.js.
 * author : Aman Karki.
 * created-date : 02-Feb-2021.
 * Description :  Sunbird service health check functionality.
*/

// Dependencies 

const request = require('request');

/**
   * Sunbird service health check.
   * @function
   * @name health_check
   * @returns {Boolean} - true/false.
*/

function health_check() {
    return new Promise(async (resolve, reject) => {
        try {

            let healthCheckUrl = 
            process.env.SUNBIRD_SERIVCE_HOST + "/healthCheckStatus";

            const options = {
                headers : {
                    "content-type": "application/json"
                }
            };
            
            request.get(healthCheckUrl,options,sunbirdCallback);

            function sunbirdCallback(err, data) {

                let result = false;

                if (err) {
                    result = false;
                } else {
                    
                    let response = JSON.parse(data.body);
                    if( response.status === 200 ) {
                        result = true;
                    } else {
                        result = false;
                    }
                }
                return resolve(result);
            }

        } catch (error) {
            return reject(error);
        }
    })
}

module.exports = {
    health_check : health_check
}