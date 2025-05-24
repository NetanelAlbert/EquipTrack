import { Route } from '@angular/router';
import { DummyComponent } from '../ui';

export const appRoutes: Route[] = [
  {
    path: '**',
    component: DummyComponent,
    title: 'Dummy Page',
  },
];
