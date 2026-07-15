import { HttpException, HttpStatus } from '@nestjs/common';
export declare class AppException extends HttpException {
    constructor(code: string, message: string, status?: HttpStatus, details?: Array<{
        field?: string;
        reason: string;
    }>);
}
