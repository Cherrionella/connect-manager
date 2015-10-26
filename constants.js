var Constants = {
    ACCESS: {
        IS_GOD: -1,
        IS_BANNED: 0
    },
    ERROR: {
        METHOD_NOT_FOUND: {
            code: -32601,
            message: 'Method not implemented'
        },
        INVALID_PARAMS: {
            code: -32602,
            message: 'Wrong parameters'
        },
        INTERNAL_ERROR: {
            code: -32603,
            message: 'Server error'
        },
        RESERVED: {
            code: -32000,
            message: 'Reserved'
        },
        NO_AUTH: {
            code: -32001,
            message: 'Not authorized'
        },
        FAIL_AUTH: {
            code: -32002,
            message: 'Wrong login and/or password'
        },
        BANNED: {
            code: -32003,
            message: 'You were banned'
        },
        NOT_ENOUGH_PERMISSIONS: {
            code: -32004,
            message: 'Insufficient permissions'
        },
        UNKNOWN: {
            code: -32000,
            message: 'Unknown protocol error'
        }
    }
};

module.exports = Constants;