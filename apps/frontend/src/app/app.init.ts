import { inject } from '@angular/core';
import { AppInitService } from './app.init.service';

export function appInitializer() {
  const appInitService = inject(AppInitService);
  return () => appInitService.initialize();
}
