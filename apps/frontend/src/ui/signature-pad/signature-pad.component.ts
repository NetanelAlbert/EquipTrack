import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  AfterViewInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import SignaturePad from 'signature_pad';

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './signature-pad.component.html',
  styleUrls: ['./signature-pad.component.scss'],
})
export class SignaturePadComponent implements OnDestroy, AfterViewInit {
  @ViewChild('signaturePad')
  signaturePadElement!: ElementRef<HTMLCanvasElement>;
  @Input() width = 300;
  @Input() height = 200;
  @Input() backgroundColor = 'white';
  @Input() penColor = 'black';
  @Output() signatureChange = new EventEmitter<string>();

  private signaturePad!: SignaturePad;

  ngAfterViewInit() {
    this.initializeSignaturePad();
  }

  ngOnDestroy() {
    if (this.signaturePad) {
      this.signaturePad.off();
    }
  }

  private initializeSignaturePad() {
    const canvas = this.signaturePadElement.nativeElement;
    this.signaturePad = new SignaturePad(canvas, {
      backgroundColor: this.backgroundColor,
      penColor: this.penColor,
      minWidth: 0.5,
      maxWidth: 2.5,
      throttle: 16, // Increase smoothness
      velocityFilterWeight: 0.7,
    });

    // Ensure the canvas is properly sized
    this.resizeCanvas();

    this.signaturePad.addEventListener('endStroke', () => {
      this.signatureChange.emit(this.signaturePad.toDataURL());
    });

    // Handle window resize
    window.addEventListener('resize', this.resizeCanvas.bind(this));
  }

  private resizeCanvas() {
    const canvas = this.signaturePadElement.nativeElement;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    canvas.width = this.width * ratio;
    canvas.height = this.height * ratio;
    canvas.style.width = `${this.width}px`;
    canvas.style.height = `${this.height}px`;

    canvas.getContext('2d')?.scale(ratio, ratio);

    // Clear the canvas after resize
    this.signaturePad.clear();
  }

  clear() {
    this.signaturePad.clear();
    this.signatureChange.emit('');
  }

  isEmpty(): boolean {
    return this.signaturePad.isEmpty();
  }

  getSignatureData(): string {
    return this.signaturePad.toDataURL();
  }

  setSignatureData(dataUrl: string) {
    this.signaturePad.fromDataURL(dataUrl);
  }
}
