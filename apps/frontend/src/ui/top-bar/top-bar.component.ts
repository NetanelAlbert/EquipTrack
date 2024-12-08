import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserStore, OrganizationStore } from '../../store';

@Component({
  selector: 'top-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  userStore = inject(UserStore);
  organizationStore = inject(OrganizationStore);
}
