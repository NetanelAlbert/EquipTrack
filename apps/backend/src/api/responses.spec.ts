import {
  isErrorResponse,
  badRequest,
  unauthorized,
  internalServerError,
  customError,
  organizationIdRequired,
} from './responses';
import { ErrorKeys } from '@equip-track/shared';

describe('isErrorResponse', () => {
  it('returns true for badRequest', () => {
    expect(isErrorResponse(badRequest('test'))).toBe(true);
  });

  it('returns true for unauthorized', () => {
    expect(isErrorResponse(unauthorized('test'))).toBe(true);
  });

  it('returns true for internalServerError', () => {
    expect(isErrorResponse(internalServerError('test'))).toBe(true);
  });

  it('returns true for customError', () => {
    expect(
      isErrorResponse(customError(ErrorKeys.BAD_REQUEST, 400, 'test'))
    ).toBe(true);
  });

  it('returns true for pre-built error constants', () => {
    expect(isErrorResponse(organizationIdRequired)).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isErrorResponse(new Error('test'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isErrorResponse(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isErrorResponse(undefined)).toBe(false);
  });

  it('returns false for string', () => {
    expect(isErrorResponse('error')).toBe(false);
  });

  it('returns false for number', () => {
    expect(isErrorResponse(500)).toBe(false);
  });
});
