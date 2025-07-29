import { endpointMetas, EndpointMeta, JwtPayload } from '@equip-track/shared';
import { handler as googleAuthHandler } from './auth/google';
import { handler as refreshTokenHandler } from './auth/refresh';
import { handler as getUsersHandler } from './admin/users/get';
import { handler as setUserHandler } from './admin/users/set';
import { handler as inviteUserHandler } from './admin/users/invite';
import { handler as approveCheckOutHandler } from './forms/checkout/approve';
import { handler as rejectCheckOutHandler } from './forms/checkout/reject';
import { handler as requestCheckInHandler } from './forms/checkin/request';
import { handler as setProductHandler } from './warehouse/products/set';
import { handler as deleteProductHandler } from './warehouse/products/delete';
import { handler as getProductsHandler } from './warehouse/products/get';
import { handler as addInventoryHandler } from './warehouse/inventory/add';
import { handler as removeInventoryHandler } from './warehouse/inventory/remove';
import { handler as getInventoryHandler } from './warehouse/inventory/get';
import { handler as getUserInventoryHandler } from './warehouse/inventory/get-user';
import { handler as getReportsHandler } from './warehouse/reports/get';
import { handler as getReportsByDatesHandler } from './warehouse/reports/get-by-dates';
import { handler as publishPartialReportHandler } from './warehouse/reports/publish';
import { handler as createCheckOutFormHandler } from './forms/checkout/create';
import { handler as getUserFormsHandler } from './forms/get-user';
import { handler as getAllFormsHandler } from './forms/get-all';
import { handler as startHandler } from './start';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';

// Handler signatures
export type HandlerFunction<Req, Res> = (
  req: Req,
  pathParams?: APIGatewayProxyEventPathParameters,
  jwtPayload?: JwtPayload
) => Promise<Res>;

type HandlersDefinition = {
  [K in keyof typeof endpointMetas]: (typeof endpointMetas)[K] extends EndpointMeta<
    infer Req,
    infer Res
  >
    ? HandlerFunction<Req, Res>
    : never;
};

export const handlers: HandlersDefinition = {
  // Authentication
  googleAuth: googleAuthHandler,
  refreshToken: refreshTokenHandler,

  // Admin Users
  getUsers: getUsersHandler,
  setUser: setUserHandler,
  inviteUser: inviteUserHandler,

  // Basic User
  start: startHandler,

  // Forms
  approveForm: approveCheckOutHandler,
  rejectForm: rejectCheckOutHandler,
  requestCheckIn: requestCheckInHandler,

  // Warehouse
  setProduct: setProductHandler,
  deleteProduct: deleteProductHandler,
  getProducts: getProductsHandler,
  addInventory: addInventoryHandler,
  removeInventory: removeInventoryHandler,
  getInventory: getInventoryHandler,
  getUserInventory: getUserInventoryHandler,

  // Forms
  getUserForms: getUserFormsHandler,
  getAllForms: getAllFormsHandler,
  createCheckOutForm: createCheckOutFormHandler,

  // Reports
  getReports: getReportsHandler, // needed?
  getReportsByDates: getReportsByDatesHandler,
  publishPartialReport: publishPartialReportHandler,
};
