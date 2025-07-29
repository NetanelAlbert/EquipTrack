import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Log HTTP errors for debugging
      console.error('HTTP Error:', error);

      // Let individual services handle their own error notifications
      // This prevents circular dependency with NotificationService
      return throwError(() => error);
    })
  );
};
