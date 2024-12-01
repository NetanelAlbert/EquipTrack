import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  title = 'frontend';
  backendMessage = '';

  ngOnInit(): void {
    fetch('http://localhost:3000/')
      .then((response) => response.json())
      .then((data) => {
        const { message } = data;
        this.backendMessage = message;
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
        this.backendMessage = 'Error connecting backend';
      });
  }
}
