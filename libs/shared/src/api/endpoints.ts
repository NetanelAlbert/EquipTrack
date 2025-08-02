import { UserRole } from '../elements/users';
import * as Admin from './admin';
import * as Auth from './auth';
import * as BasicUser from './basicUser';
import * as Wharehouse from './wharehouse';
import * as Reports from './reports';
import { BasicResponse } from './basic';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type OptionalObject = object | undefined;

export interface EndpointMeta<Req extends OptionalObject = undefined, Res extends OptionalObject = undefined> {
  path: string;
  method: HttpMethod;
  allowedRoles: UserRole[];
  allowedOtherUsers?: UserRole[];
  requestType?: Req;
  responseType?: Res;
}

export const ORGANIZATION_ID_PATH_PARAM = 'organizationId';
export const USER_ID_PATH_PARAM = 'userId';
export const FORM_ID_PATH_PARAM = 'formId';

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
    allowedRoles: [],
    responseType: {} as Admin.GetUsersResponse,
  } as EndpointMeta<undefined, Admin.GetUsersResponse>,
  setUser: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/users`,
    method: 'POST',
    allowedRoles: [UserRole.Admin],
    requestType: {} as Admin.SetUser,
    responseType: {} as BasicResponse,
    allowedOtherUsers: [UserRole.Admin],
  } as EndpointMeta<Admin.SetUser, BasicResponse>,
  inviteUser: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/users/invite`,
    method: 'POST',
    allowedRoles: [UserRole.Admin],
    requestType: {} as Admin.InviteUser,
    responseType: {} as Admin.InviteUserResponse,
    allowedOtherUsers: [UserRole.Admin],
  } as EndpointMeta<Admin.InviteUser, Admin.InviteUserResponse>,

  // Basic User
  start: {
    path: `/api/users/start`,
    method: 'GET',
    allowedRoles: [
      UserRole.Admin,
      UserRole.Customer,
      UserRole.WarehouseManager,
    ],
    responseType: {} as BasicUser.StartResponse,
  } as EndpointMeta<undefined, BasicUser.StartResponse>,
  // Warehouse
  getProducts: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/products`,
    method: 'GET',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin, UserRole.Customer],
    responseType: {} as Wharehouse.GetProductsResponse,
  } as EndpointMeta<undefined, Wharehouse.GetProductsResponse>,
  setProduct: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/products`,
    method: 'POST',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    allowedOtherUsers: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as Wharehouse.SetProduct,
    responseType: {} as BasicResponse,
  } as EndpointMeta<Wharehouse.SetProduct, BasicResponse>,
  deleteProduct: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/products`,
    method: 'DELETE',
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
    allowedOtherUsers: [UserRole.WarehouseManager, UserRole.Admin],
    responseType: {} as Wharehouse.GetUserInventoryResponse,
  } as EndpointMeta<undefined, Wharehouse.GetUserInventoryResponse>,

  // Forms
  getUserForms: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/my-forms`,
    method: 'GET',
    allowedRoles: [
      UserRole.WarehouseManager,
      UserRole.Admin,
      UserRole.Customer,
    ],
    allowedOtherUsers: [UserRole.WarehouseManager, UserRole.Admin],
    responseType: {} as Wharehouse.GetUserFormsResponse,
  } as EndpointMeta<undefined, Wharehouse.GetUserFormsResponse>,
  getAllForms: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/all-forms`,
    method: 'GET',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    responseType: {} as Wharehouse.GetAllFormsResponse,
  } as EndpointMeta<undefined, Wharehouse.GetAllFormsResponse>,
  createCheckOutForm: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/checkout/create`,
    method: 'POST',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    allowedOtherUsers: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as Wharehouse.CreateCheckOutForm,
    responseType: {} as Wharehouse.CreateCheckOutFormResponse,
  } as EndpointMeta<Wharehouse.CreateCheckOutForm, Wharehouse.CreateCheckOutFormResponse>,
  requestCheckIn: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/checkin/request`,
    method: 'POST',
    allowedRoles: [
      UserRole.Customer,
      UserRole.Admin,
      UserRole.WarehouseManager,
    ],
    allowedOtherUsers: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as BasicUser.RequestCheckIn,
    responseType: {} as BasicUser.RequestCheckInResponse,
  } as EndpointMeta<BasicUser.RequestCheckIn, BasicUser.RequestCheckInResponse>,
  approveForm: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/forms/approve`,
    method: 'POST',
    allowedRoles: [
      UserRole.WarehouseManager,
      UserRole.Admin,
      UserRole.Customer,
    ],
    allowedOtherUsers: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as BasicUser.ApproveCheckOut,
    responseType: {} as BasicUser.ApproveCheckOutResponse,
  } as EndpointMeta<BasicUser.ApproveCheckOut, BasicUser.ApproveCheckOutResponse>,
  rejectForm: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/forms/reject`,
    method: 'POST',
    allowedRoles: [
      UserRole.WarehouseManager,
      UserRole.Admin,
      UserRole.Customer,
    ],
    allowedOtherUsers: [UserRole.WarehouseManager, UserRole.Admin],
    requestType: {} as BasicUser.RejectCheckOut,
    responseType: {} as BasicResponse,
  } as EndpointMeta<BasicUser.RejectCheckOut, BasicResponse>,
  getPresignedUrl: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/users/{${USER_ID_PATH_PARAM}}/forms/{${FORM_ID_PATH_PARAM}}/presigned-url`,
    method: 'GET',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin, UserRole.Customer],
    allowedOtherUsers: [UserRole.WarehouseManager, UserRole.Admin],
    responseType: {} as BasicUser.GetPresignedUrlResponse,
  } as EndpointMeta<undefined, BasicUser.GetPresignedUrlResponse>,


  // Reports
  /**
   * @deprecated Use getReportsByDates instead
   */
  getReports: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/reports`,
    method: 'GET',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin],
    responseType: {} as Reports.GetReportsResponse,
  } as EndpointMeta<undefined, Reports.GetReportsResponse>,
  getReportsByDates: {
    path: `/api/organizations/{${ORGANIZATION_ID_PATH_PARAM}}/reports/by-dates`,
    method: 'POST',
    allowedRoles: [UserRole.WarehouseManager, UserRole.Admin, UserRole.Customer],
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
