import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopBarComponent, EditableInventoryComponent, InventoryListComponent } from '..';
import { UserStore } from '../../store';

@Component({
  selector: 'welcome',
  standalone: true,
  imports: [CommonModule, TopBarComponent, InventoryListComponent, EditableInventoryComponent],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
})
export class WelcomeComponent {
  userStore = inject(UserStore);
}
