import { UserRole } from '../elements/users';
import * as Admin from './admin';
import * as BasicUser from './basicUser';
import * as Wharehouse from './wharehouse';
import { BasicResponse } from './basic';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface EndpointMeta<Req = any, Res = any> {
  path: string;
  method: HttpMethod;
  allowedRoles: UserRole[];
  requestType?: Req;
  responseType?: Res;
}

export const endpointMetas = {
  // Admin Users
  getUsers: {
    path: '/api/admin/users',
    method: 'GET',
    allowedRoles: [UserRole.Admin],
    responseType: {} as Admin.GetUsersResponse,
  } as EndpointMeta<undefined, Admin.GetUsersResponse>,
  setUser: {
    path: '/api/admin/users',
    method: 'POST',
    allowedRoles: [UserRole.Admin],
    requestType: {} as Admin.SetUser,
    responseType: {} as BasicResponse,
  } as EndpointMeta<Admin.SetUser, BasicResponse>,

  // Basic User
  start: {
    path: '/api/start',
    method: 'GET',
    allowedRoles: [
      UserRole.Admin,
      UserRole.Customer,
      UserRole.WarehouseManager,
    ],
    responseType: {} as BasicUser.StartResponse,
  } as EndpointMeta<undefined, BasicUser.StartResponse>,
  approveCheckOut: {
    path: '/api/user/checkOut/approve',
    method: 'POST',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as BasicUser.ApproveCheckOut,
    responseType: {} as BasicResponse,
  } as EndpointMeta<BasicUser.ApproveCheckOut, BasicResponse>,
  rejectCheckOut: {
    path: '/api/user/checkOut/reject',
    method: 'POST',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as BasicUser.RejectCheckOut,
    responseType: {} as BasicResponse,
  } as EndpointMeta<BasicUser.RejectCheckOut, BasicResponse>,
  requestCheckIn: {
    path: '/api/user/checkIn/request',
    method: 'POST',
    allowedRoles: [UserRole.Customer, UserRole.Admin],
    requestType: {} as BasicUser.RequestCheckIn,
    responseType: {} as BasicResponse,
  } as EndpointMeta<BasicUser.RequestCheckIn, BasicResponse>,

  // Warehouse
  setProducts: {
    path: '/api/warehouse/products/set',
    method: 'POST',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as Wharehouse.SetProducts,
    responseType: {} as BasicResponse,
  } as EndpointMeta<Wharehouse.SetProducts, BasicResponse>,
  addInventory: {
    path: '/api/warehouse/inventory/add',
    method: 'POST',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as Wharehouse.AddInventory,
    responseType: {} as BasicResponse,
  } as EndpointMeta<Wharehouse.AddInventory, BasicResponse>,
  removeInventory: {
    path: '/api/warehouse/inventory/remove',
    method: 'POST',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as Wharehouse.RemoveInventory,
    responseType: {} as BasicResponse,
  } as EndpointMeta<Wharehouse.RemoveInventory, BasicResponse>,
  getInventory: {
    path: '/api/warehouse/inventory/get',
    method: 'GET',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    responseType: {} as Wharehouse.GetInventoryResponse,
  } as EndpointMeta<undefined, Wharehouse.GetInventoryResponse>,
};
