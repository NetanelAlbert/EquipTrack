import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { SignaturePadComponent } from './signature-pad.component';

const mockContext2d = {
  fillStyle: '',
  fillRect: jest.fn(),
  scale: jest.fn(),
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  closePath: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  canvas: {} as HTMLCanvasElement,
};

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue(mockContext2d) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = jest.fn().mockReturnValue('data:image/png;base64,');
});

describe('SignaturePadComponent', () => {
  let component: SignaturePadComponent;
  let fixture: ComponentFixture<SignaturePadComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SignaturePadComponent, TranslateModule.forRoot()],
    }).compileComponents();

    fixture = TestBed.createComponent(SignaturePadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should remove window resize listener on destroy', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    fixture.destroy();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    );
    removeEventListenerSpy.mockRestore();
  });

  it('should use the same function reference for add and remove resize listener', () => {
    const addSpy = jest.spyOn(window, 'addEventListener');
    const removeSpy = jest.spyOn(window, 'removeEventListener');

    const fixture2 = TestBed.createComponent(SignaturePadComponent);
    fixture2.detectChanges();

    const addedHandler = addSpy.mock.calls.find(
      (c) => c[0] === 'resize'
    )?.[1];

    fixture2.destroy();

    const removedHandler = removeSpy.mock.calls.find(
      (c) => c[0] === 'resize'
    )?.[1];

    expect(addedHandler).toBeDefined();
    expect(addedHandler).toBe(removedHandler);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
