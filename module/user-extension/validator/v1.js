/**
 * name : v1.js
 * author : Aman Jung Karki
 * created-date : 09-Sep-2020
 * Description : User extension validation.
 */

module.exports = (req) => {
    
    let userExtensionValidator = {
        updateProfileRoles : function () {
            req.checkBody('stateId').exists().withMessage("State id is required");
            req.checkBody('roles').exists().withMessage("Roles data is required");
        },
        programsByPlatformRoles: function () {
            req.checkQuery('role').exists().withMessage("Required platform user role");
        }
    }

    if ( userExtensionValidator[req.params.method] ) {
        userExtensionValidator[req.params.method]()
    }
}