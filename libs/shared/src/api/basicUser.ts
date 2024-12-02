import { InventoryItem, ItemReport } from '../elements';
import { BasicResponse } from './basic';

/*
    NOTE: all api assume that 
    the user id can be extracted 
    from the token / coockie etc.
*/

/**
 * GET /api/start
 */
export interface Start {
    userID: string;
}
export interface StartResponse extends BasicResponse {
    /* Todo: add here all the data needed for the app to start
    * - user data
    * - organization data
    * - inventory data
    * - forms data
    * - reports data
    */
   dummyData: string; // todo remove this. only for lint
}

/**
 * POST /api/user/checkOut/approve
 */
export interface ApproveCheckOut {
    formID: string;
    imageData: Blob; // todo check if this is correct
}

/**
 * POST /api/user/checkOut/reject
 */
export interface RejectCheckOut {
    formID: string;
    reason: string;
}

/**
 * POST /api/user/checkIn/request
 */
export interface RequestCheckIn {
    items: InventoryItem[];
}

/**
 * POST /api/user/report
 */
export interface ReportItems {
    items: ItemReport[];
}




