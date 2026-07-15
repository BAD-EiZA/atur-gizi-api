import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    details?: Array<{ field?: string; reason: string }>,
  ) {
    super({ error: { code, message, details: details ?? [] } }, status);
  }
}
