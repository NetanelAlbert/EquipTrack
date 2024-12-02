import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TopBarComponent } from '..';
import { User } from '@equip-track/shared';

@Component({
  selector: 'welcome',
  standalone: true,
  imports: [CommonModule, TopBarComponent],
  templateUrl: './welcome.component.html',
  styleUrl: './welcome.component.scss',
})
export class WelcomeComponent {
  mockedUser: User = {
    name: 'Harry Potter',
    email: 'bla@shtut.x',
    id: '123',
    phone: '123456789',
    organizations: [],
    state: 'active',
  };
}
