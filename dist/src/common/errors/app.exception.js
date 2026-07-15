"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppException = void 0;
const common_1 = require("@nestjs/common");
class AppException extends common_1.HttpException {
    constructor(code, message, status = common_1.HttpStatus.BAD_REQUEST, details) {
        super({ error: { code, message, details: details ?? [] } }, status);
    }
}
exports.AppException = AppException;
//# sourceMappingURL=app.exception.js.map