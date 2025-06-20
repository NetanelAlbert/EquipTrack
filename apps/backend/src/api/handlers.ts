import {
  endpointMetas,
  BasicResponse,
  GetUsersResponse,
  EndpointMeta,
  SetUser,
  ApproveCheckOut,
  RejectCheckOut,
  RequestCheckIn,
  GetInventoryResponse,
  SetProducts,
  RemoveInventory,
  AddInventory,
  StartResponse,
  User,
} from '@equip-track/shared';
import { handler as getUsersHandler } from './admin/users/get';
import { handler as setUserHandler } from './admin/users/set';
import { handler as approveCheckOutHandler } from './user/checkout/approve';
import { handler as rejectCheckOutHandler } from './user/checkout/reject';
import { handler as requestCheckInHandler } from './user/checkin/request';
import { handler as setProductsHandler } from './warehouse/products/set';
import { handler as addInventoryHandler } from './warehouse/inventory/add';
import { handler as removeInventoryHandler } from './warehouse/inventory/remove';
import { handler as getInventoryHandler } from './warehouse/inventory/get';
import { handler as startHandler } from './start';

// Handler signatures
type HandlerFunction<Req, Res> = (user: User, req: Req) => Promise<Res>;

type Handlers = {
  [K in keyof typeof endpointMetas]: (typeof endpointMetas)[K] extends EndpointMeta<
    infer Req,
    infer Res
  >
    ? HandlerFunction<Req, Res>
    : never;
};

export const handlers: Handlers = {
  // Admin Users
  getUsers: getUsersHandler,
  setUser: setUserHandler,

  // Basic User
  start: startHandler,
  approveCheckOut: approveCheckOutHandler,
  rejectCheckOut: rejectCheckOutHandler,
  requestCheckIn: requestCheckInHandler,

  // Warehouse
  setProducts: setProductsHandler,
  addInventory: addInventoryHandler,
  removeInventory: removeInventoryHandler,
  getInventory: getInventoryHandler,
};
