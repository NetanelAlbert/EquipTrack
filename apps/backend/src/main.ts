import { lambdaHandlers as apiLambdaHandlers } from './api/handler-factory';
import { handler as inventoryStateBackupHandler } from './scheduled/inventory-state-backup';

// Export Lambda handlers for deployment
export const lambdaHandlers = {
  ...apiLambdaHandlers,
  inventoryStateBackup: inventoryStateBackupHandler,
};
