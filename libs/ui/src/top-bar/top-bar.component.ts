import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '@equip-track/shared';

@Component({
  selector: 'top-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  appName = input('AppName');
  user = input<User>();
  userInitials = computed(() => {
    return this.user()
      ?.name.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  });
}
