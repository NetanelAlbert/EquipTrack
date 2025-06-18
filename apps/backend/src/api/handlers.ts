import {
  // endpointMetas,
  BasicResponse,
  GetUsersResponse,
  // EndpointMeta,
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
// type HandlerFunction<Req, Res> = (user: User, req: Req) => Promise<Res>;

// type Handlers = {
//   [K in keyof typeof endpointMetas]: (typeof endpointMetas)[K] extends EndpointMeta<
//     infer Req,
//     infer Res
//   >
//     ? HandlerFunction<Req, Res>
//     : never;
// };

export const handlers = {
  // Admin Users
  getUsers: async (_user: User, _req: undefined): Promise<GetUsersResponse> => {
    return getUsersHandler(_user, _req);
  },
  setUser: async (_user: User, req: SetUser): Promise<BasicResponse> => {
    return setUserHandler(_user, req);
  },

  // Basic User
  start: async (_user: User, _req: undefined): Promise<StartResponse> => {
    return startHandler(_user, _req);
  },
  approveCheckOut: async (
    _user: User,
    req: ApproveCheckOut
  ): Promise<BasicResponse> => {
    return approveCheckOutHandler(_user, req);
  },
  rejectCheckOut: async (
    _user: User,
    req: RejectCheckOut
  ): Promise<BasicResponse> => {
    return rejectCheckOutHandler(_user, req);
  },
  requestCheckIn: async (
    _user: User,
    req: RequestCheckIn
  ): Promise<BasicResponse> => {
    return requestCheckInHandler(_user, req);
  },

  // Warehouse
  setProducts: async (
    _user: User,
    req: SetProducts
  ): Promise<BasicResponse> => {
    return setProductsHandler(_user, req);
  },
  addInventory: async (
    _user: User,
    req: AddInventory
  ): Promise<BasicResponse> => {
    return addInventoryHandler(_user, req);
  },
  removeInventory: async (
    _user: User,
    req: RemoveInventory
  ): Promise<BasicResponse> => {
    return removeInventoryHandler(_user, req);
  },
  getInventory: async (
    _user: User,
    _req: undefined
  ): Promise<GetInventoryResponse> => {
    return getInventoryHandler(_user, _req);
  },
};
