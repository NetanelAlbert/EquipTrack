export enum ErrorKeys {
  // General API errors
  GENERAL_ERROR = 'errors.api.general',
  NETWORK_ERROR = 'errors.api.network-error',
  TIMEOUT = 'errors.api.timeout',

  // Required errors
  ORGANIZATION_ID_REQUIRED = 'errors.api.organization-id-required',
  FORM_ID_REQUIRED = 'errors.api.form-id-required',
  USER_ID_REQUIRED = 'errors.api.user-id-required',
  JWT_PAYLOAD_REQUIRED = 'errors.api.jwt-payload-required',

  // HTTP status errors
  BAD_REQUEST = 'errors.api.bad-request',
  UNAUTHORIZED = 'errors.api.unauthorized',
  FORBIDDEN = 'errors.api.forbidden',
  NOT_FOUND = 'errors.api.not-found',
  INTERNAL_SERVER_ERROR = 'errors.api.internal-server-error',
  NOT_IMPLEMENTED = 'errors.api.not-implemented',

  // Authentication errors
  NO_TOKEN = 'errors.auth.no-token',
  SESSION_EXPIRED = 'errors.auth.session-expired',
  INVALID_CREDENTIALS = 'errors.auth.invalid-credentials',
  EMAIL_VERIFICATION_REQUIRED = 'errors.api.email-verification-required',

  // Organization errors
  NO_ORGANIZATION_SELECTED = 'errors.organization.not-selected',
  ORGANIZATION_ACCESS_DENIED = 'errors.organization.access-denied',

  // Forms errors
  FORMS_FETCH_FAILED = 'errors.forms.fetch-failed',
  FORMS_SUBMIT_FAILED = 'errors.forms.submit-failed',
  FORMS_APPROVE_FAILED = 'errors.forms.approve-failed',
  FORMS_REJECT_FAILED = 'errors.forms.reject-failed',

  // Inventory errors
  INVENTORY_FETCH_FAILED = 'errors.inventory.fetch-failed',
  INVENTORY_ADD_FAILED = 'errors.inventory.add-failed',
  INVENTORY_REMOVE_FAILED = 'errors.inventory.remove-failed',
  INVENTORY_UPDATE_FAILED = 'errors.inventory.update-failed',

  // Reports errors
  REPORTS_FETCH_FAILED = 'errors.reports.fetch-failed',
  REPORTS_GENERATE_FAILED = 'errors.reports.generate-failed',
  REPORTS_PUBLISH_FAILED = 'errors.reports.publish-failed',

  // Users errors
  USERS_FETCH_FAILED = 'errors.users.fetch-failed',
  USERS_INVITE_FAILED = 'errors.users.invite-failed',
  USERS_UPDATE_FAILED = 'errors.users.update-failed',

  // Products errors
  PRODUCTS_FETCH_FAILED = 'errors.products.fetch-failed',
  PRODUCTS_SAVE_FAILED = 'errors.products.save-failed',
  PRODUCTS_DELETE_FAILED = 'errors.products.delete-failed',
}
