import { UserRole } from '../elements/users';
import * as Admin from './admin';
import * as Auth from './auth';
import * as BasicUser from './basicUser';
import * as Wharehouse from './wharehouse';
import * as Reports from './reports';
import { BasicResponse } from './basic';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface EndpointMeta<Req = unknown, Res = unknown> {
  path: string;
  method: HttpMethod;
  allowedRoles: UserRole[];
  requestType?: Req;
  responseType?: Res;
}

export const ORGANIZATION_ID_PATH_PARAM = 'organizationId';
export const USER_ID_PATH_PARAM = 'userId';

export const endpointMetas = {
  // Authentication
  googleAuth: {
    path: `/api/auth/google`,
    method: 'POST',
    allowedRoles: [], // No authentication required for this endpoint
    requestType: {} as Auth.GoogleAuthRequest,
    responseType: {} as Auth.GoogleAuthResponse,
  } as EndpointMeta<Auth.GoogleAuthRequest, Auth.GoogleAuthResponse>,

  // Admin Users
  getUsers: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/users`,
    method: 'GET',
    allowedRoles: [UserRole.Admin],
    responseType: {} as Admin.GetUsersResponse,
  } as EndpointMeta<undefined, Admin.GetUsersResponse>,
  setUser: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/users`,
    method: 'POST',
    allowedRoles: [UserRole.Admin],
    requestType: {} as Admin.SetUser,
    responseType: {} as BasicResponse,
  } as EndpointMeta<Admin.SetUser, BasicResponse>,
  inviteUser: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/users/invite`,
    method: 'POST',
    allowedRoles: [UserRole.Admin],
    requestType: {} as Admin.InviteUser,
    responseType: {} as BasicResponse,
  } as EndpointMeta<Admin.InviteUser, BasicResponse>,

  // Basic User
  start: {
    path: `/api/users/{${USER_ID_PATH_PARAM}}/start`,
    method: 'GET',
    allowedRoles: [
      UserRole.Admin,
      UserRole.Customer,
      UserRole.WarehouseManager,
    ],
    responseType: {} as BasicUser.StartResponse,
  } as EndpointMeta<undefined, BasicUser.StartResponse>,
  approveCheckOut: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/checkout/approve`,
    method: 'POST',
    allowedRoles: [
      UserRole.WarehouseManager,
      UserRole.Admin,
      UserRole.Customer,
    ],
    requestType: {} as BasicUser.ApproveCheckOut,
    responseType: {} as BasicResponse,
  } as EndpointMeta<BasicUser.ApproveCheckOut, BasicResponse>,
  rejectCheckOut: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/checkout/reject`,
    method: 'POST',
    allowedRoles: [
      UserRole.WarehouseManager,
      UserRole.Admin,
      UserRole.Customer,
    ],
    requestType: {} as BasicUser.RejectCheckOut,
    responseType: {} as BasicResponse,
  } as EndpointMeta<BasicUser.RejectCheckOut, BasicResponse>,
  requestCheckIn: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/checkin/request`,
    method: 'POST',
    allowedRoles: [
      UserRole.Customer,
      UserRole.Admin,
      UserRole.WarehouseManager,
    ],
    requestType: {} as BasicUser.RequestCheckIn,
    responseType: {} as BasicResponse,
  } as EndpointMeta<BasicUser.RequestCheckIn, BasicResponse>,

  // Warehouse
  setProduct: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/products/set`,
    method: 'POST',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as Wharehouse.SetProduct,
    responseType: {} as BasicResponse,
  } as EndpointMeta<Wharehouse.SetProduct, BasicResponse>,
  deleteProduct: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/products/delete`,
    method: 'POST',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as Wharehouse.DeleteProduct,
    responseType: {} as BasicResponse,
  } as EndpointMeta<Wharehouse.DeleteProduct, BasicResponse>,
  addInventory: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/inventory/add`,
    method: 'POST',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as Wharehouse.AddInventory,
    responseType: {} as BasicResponse,
  } as EndpointMeta<Wharehouse.AddInventory, BasicResponse>,
  removeInventory: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/inventory/remove`,
    method: 'POST',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as Wharehouse.RemoveInventory,
    responseType: {} as BasicResponse,
  } as EndpointMeta<Wharehouse.RemoveInventory, BasicResponse>,
  getInventory: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/inventory`,
    method: 'GET',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    responseType: {} as Wharehouse.GetInventoryResponse,
  } as EndpointMeta<undefined, Wharehouse.GetInventoryResponse>,
  getUserInventory: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/inventory/user/{${USER_ID_PATH_PARAM}}`,
    method: 'GET',
    allowedRoles: [
      UserRole.WarehouseManager,
      UserRole.Admin,
      UserRole.Customer,
    ],
    responseType: {} as Wharehouse.GetUserInventoryResponse,
  } as EndpointMeta<undefined, Wharehouse.GetUserInventoryResponse>,
  createCheckOutForm: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/checkout/create`,
    method: 'POST',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as Wharehouse.CreateCheckOutForm,
    responseType: {} as BasicResponse,
  } as EndpointMeta<Wharehouse.CreateCheckOutForm, BasicResponse>,

  // Reports
  getReports: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/reports`,
    method: 'GET',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    responseType: {} as Reports.GetReportsResponse,
  } as EndpointMeta<undefined, Reports.GetReportsResponse>,
  getReportsByDates: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/reports/by-dates`,
    method: 'POST',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as Reports.GetReportsByDatesRequest,
    responseType: {} as Reports.GetReportsByDatesResponse,
  } as EndpointMeta<
    Reports.GetReportsByDatesRequest,
    Reports.GetReportsByDatesResponse
  >,
  publishPartialReport: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/reports/publish`,
    method: 'POST',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as Reports.PublishPartialReportRequest,
    responseType: {} as Reports.PublishPartialReportResponse,
  } as EndpointMeta<
    Reports.PublishPartialReportRequest,
    Reports.PublishPartialReportResponse
  >,
};
