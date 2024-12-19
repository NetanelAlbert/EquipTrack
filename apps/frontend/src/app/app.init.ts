import { AppInitService } from './app.init.service';


export const initApplication = (appInitService: AppInitService) => (): Promise<void> => {
    return appInitService.initializeApp();
};