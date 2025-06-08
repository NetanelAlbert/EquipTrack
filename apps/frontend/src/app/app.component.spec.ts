import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule, TranslateStore } from '@ngx-translate/core';
import { MatIconModule } from '@angular/material/icon';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('AppComponent', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;

  beforeEach(async () => {
    // Mock fetch globally
    global.fetch = jest.fn().mockImplementation(() =>
      Promise.resolve({
        json: () => Promise.resolve({ message: 'Test message' }),
      })
    );

    await TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        TranslateModule.forRoot(),
        MatIconModule,
        MatIconTestingModule,
        HttpClientTestingModule,
      ],
      declarations: [AppComponent],
      providers: [TranslateStore],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    // Clean up the mock
    delete global.fetch;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it("should have as title 'frontend'", () => {
    expect(component.title).toEqual('frontend');
  });
});
