// Export Lambda handlers for deployment
export { lambdaHandlers } from './api/handler-factory';
import { startLocalHttpServer } from './local-http-server';

if (process.env.LOCAL_HTTP_SERVER === 'true') {
  startLocalHttpServer().catch((error) => {
    console.error('[main] failed to start local HTTP server', error);
    process.exit(1);
  });
}
