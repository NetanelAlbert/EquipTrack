import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '@equip-track/shared';

@Component({
  selector: 'lib-top-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  appName = input('AppName');
  user = input<User>();
  userInitial = computed(() => {
    return this.user.name[0].toUpperCase();
  });
}
