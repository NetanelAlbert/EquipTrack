import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { CreateFormComponent } from './create-form.component';
import { NotificationService } from '../../services/notification.service';

describe('CreateFormComponent', () => {
  let component: CreateFormComponent;
  let fixture: ComponentFixture<CreateFormComponent>;
  let queryParamsSubject: BehaviorSubject<Record<string, string>>;
  let notificationService: NotificationService;

  beforeEach(async () => {
    queryParamsSubject = new BehaviorSubject<Record<string, string>>({});

    await TestBed.configureTestingModule({
      imports: [
        CreateFormComponent,
        NoopAnimationsModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { queryParams: queryParamsSubject.asObservable() },
        },
      ],
    }).compileComponents();

    notificationService = TestBed.inject(NotificationService);
    fixture = TestBed.createComponent(CreateFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should handle malformed JSON in query params gracefully', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    const showErrorSpy = jest.spyOn(notificationService, 'showError');

    queryParamsSubject.next({
      formType: 'CheckOut',
      items: 'not-valid-json{{{',
    });
    fixture.detectChanges();

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to parse items from query params:',
      expect.any(SyntaxError)
    );
    expect(showErrorSpy).toHaveBeenCalledWith('errors.api.general');

    consoleSpy.mockRestore();
  });

  it('should parse valid JSON in query params successfully', () => {
    const items = [{ productId: 'LAPTOP-001', quantity: 2 }];
    const addAllItemsSpy = jest.spyOn(component, 'addAllItems');

    queryParamsSubject.next({
      formType: 'CheckOut',
      items: JSON.stringify(items),
      userId: 'user-1',
    });
    fixture.detectChanges();

    expect(addAllItemsSpy).toHaveBeenCalledWith(items);
  });

  it('should not subscribe again after component is destroyed and recreated', () => {
    const addAllItemsSpy = jest.spyOn(component, 'addAllItems');

    fixture.destroy();

    queryParamsSubject.next({
      formType: 'CheckOut',
      items: JSON.stringify([{ productId: 'P1', quantity: 1 }]),
    });

    expect(addAllItemsSpy).not.toHaveBeenCalled();
  });
});
