import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { FormsComponent } from './forms.component';
import { FormStatus, FormType } from '@equip-track/shared';

describe('FormsComponent', () => {
  let component: FormsComponent;
  let fixture: ComponentFixture<FormsComponent>;
  let queryParamsSubject: Subject<Record<string, string>>;

  beforeEach(async () => {
    queryParamsSubject = new Subject<Record<string, string>>();

    await TestBed.configureTestingModule({
      imports: [
        FormsComponent,
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

    fixture = TestBed.createComponent(FormsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set query params when all required params are provided', () => {
    queryParamsSubject.next({
      formType: FormType.CheckIn,
      searchStatus: FormStatus.Pending,
      searchTerm: 'test',
    });

    expect(component.checkInQueryParams()).toEqual({
      formType: FormType.CheckIn,
      searchStatus: FormStatus.Pending,
      searchTerm: 'test',
    });
  });

  it('should clear query params when required params are missing', () => {
    queryParamsSubject.next({
      formType: FormType.CheckIn,
      searchStatus: FormStatus.Pending,
      searchTerm: 'test',
    });

    queryParamsSubject.next({});

    expect(component.checkInQueryParams()).toBeUndefined();
    expect(component.checkOutQueryParams()).toBeUndefined();
  });

  it('should unsubscribe from queryParams when destroyed', () => {
    expect(queryParamsSubject.observed).toBe(true);

    fixture.destroy();

    expect(queryParamsSubject.observed).toBe(false);
  });
});
