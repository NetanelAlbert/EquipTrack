import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dummy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dummy.component.html',
  styleUrl: './dummy.component.scss',
})
export class DummyComponent {}
