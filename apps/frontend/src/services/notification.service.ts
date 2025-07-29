import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  
  showSuccess(message: string): void {
    // For now, use console.log and alert
    // In a real app, this would integrate with a toast/snackbar component
    console.log('SUCCESS:', message);
    alert(`Success: ${message}`);
  }

  showError(message: string): void {
    // For now, use console.error and alert
    // In a real app, this would integrate with a toast/snackbar component  
    console.error('ERROR:', message);
    alert(`Error: ${message}`);
  }

  showInfo(message: string): void {
    // For now, use console.log and alert
    // In a real app, this would integrate with a toast/snackbar component
    console.log('INFO:', message);
    alert(`Info: ${message}`);
  }

  showWarning(message: string): void {
    // For now, use console.warn and alert
    // In a real app, this would integrate with a toast/snackbar component
    console.warn('WARNING:', message);
    alert(`Warning: ${message}`);
  }
}