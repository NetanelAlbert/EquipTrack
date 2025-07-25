import { endpointMetas, EndpointMeta } from '@equip-track/shared';
import { handler as googleAuthHandler } from './auth/google';
import { handler as getUsersHandler } from './admin/users/get';
import { handler as setUserHandler } from './admin/users/set';
import { handler as inviteUserHandler } from './admin/users/invite';
import { handler as approveCheckOutHandler } from './user/checkout/approve';
import { handler as rejectCheckOutHandler } from './user/checkout/reject';
import { handler as requestCheckInHandler } from './user/checkin/request';
import { handler as setProductHandler } from './warehouse/products/set';
import { handler as deleteProductHandler } from './warehouse/products/delete';
import { handler as addInventoryHandler } from './warehouse/inventory/add';
import { handler as removeInventoryHandler } from './warehouse/inventory/remove';
import { handler as getInventoryHandler } from './warehouse/inventory/get';
import { handler as getUserInventoryHandler } from './warehouse/inventory/get-user';
import { handler as getReportsHandler } from './warehouse/reports/get';
import { handler as getReportsByDatesHandler } from './warehouse/reports/get-by-dates';
import { handler as publishPartialReportHandler } from './warehouse/reports/publish';
import { handler as createCheckOutFormHandler } from './user/checkout/create';
import { handler as startHandler } from './start';
import { APIGatewayProxyEventPathParameters } from 'aws-lambda';

// Handler signatures
export type HandlerFunction<Req, Res> = (
  req: Req,
  pathParams?: APIGatewayProxyEventPathParameters
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

  // Admin Users
  getUsers: getUsersHandler,
  setUser: setUserHandler,
  inviteUser: inviteUserHandler,

  // Basic User
  start: startHandler,
  approveCheckOut: approveCheckOutHandler, // TODO: Implement this
  rejectCheckOut: rejectCheckOutHandler, // TODO: Implement this
  requestCheckIn: requestCheckInHandler, // TODO: Implement this

  // Warehouse
  setProduct: setProductHandler,
  deleteProduct: deleteProductHandler,
  addInventory: addInventoryHandler,
  removeInventory: removeInventoryHandler,
  getInventory: getInventoryHandler,
  getUserInventory: getUserInventoryHandler,
  createCheckOutForm: createCheckOutFormHandler,

  // Reports
  getReports: getReportsHandler, // needed?
  getReportsByDates: getReportsByDatesHandler,
  publishPartialReport: publishPartialReportHandler,
};
