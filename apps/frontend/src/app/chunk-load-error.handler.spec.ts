import { ErrorHandler } from '@angular/core';
import { TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { NotificationService } from '../services/notification.service';
import { ChunkLoadErrorHandler } from './chunk-load-error.handler';

jest.mock('./chunk-load-recovery', () => ({
  isChunkLoadError: jest.fn(),
  recoverFromChunkLoadError: jest.fn(),
}));

import {
  isChunkLoadError,
  recoverFromChunkLoadError,
} from './chunk-load-recovery';

describe('ChunkLoadErrorHandler', () => {
  let showInfo: jest.Mock;
  let showError: jest.Mock;
  let superHandleError: jest.SpyInstance;

  beforeEach(() => {
    showInfo = jest.fn();
    showError = jest.fn();
    superHandleError = jest
      .spyOn(ErrorHandler.prototype, 'handleError')
      .mockImplementation(() => undefined);

    (isChunkLoadError as jest.Mock).mockReset();
    (recoverFromChunkLoadError as jest.Mock).mockReset();

    TestBed.configureTestingModule({
      providers: [
        ChunkLoadErrorHandler,
        {
          provide: NotificationService,
          useValue: { showInfo, showError },
        },
      ],
    });
  });

  afterEach(() => {
    superHandleError.mockRestore();
  });

  it('calls recoverFromChunkLoadError and shows info snackbar when recovering', fakeAsync(() => {
    (isChunkLoadError as jest.Mock).mockReturnValue(true);
    (recoverFromChunkLoadError as jest.Mock).mockResolvedValue('recovering');

    const handler = TestBed.inject(ChunkLoadErrorHandler);
    handler.handleError(new Error('Loading chunk 1 failed'));

    flushMicrotasks();

    expect(recoverFromChunkLoadError).toHaveBeenCalledTimes(1);
    expect(showInfo).toHaveBeenCalledWith('common.app-reloading');
    expect(showError).not.toHaveBeenCalled();
    expect(superHandleError).not.toHaveBeenCalled();
  }));

  it('shows error snackbar when recovery gives up', fakeAsync(() => {
    (isChunkLoadError as jest.Mock).mockReturnValue(true);
    (recoverFromChunkLoadError as jest.Mock).mockResolvedValue('gave-up');

    const handler = TestBed.inject(ChunkLoadErrorHandler);
    handler.handleError(new Error('Loading chunk 1 failed'));

    flushMicrotasks();

    expect(showError).toHaveBeenCalledWith(
      'common.app-reload-failed',
      undefined,
      undefined,
      { duration: 7000 }
    );
    expect(showInfo).not.toHaveBeenCalled();
    expect(superHandleError).not.toHaveBeenCalled();
  }));

  it('forwards non-chunk errors to super.handleError', () => {
    (isChunkLoadError as jest.Mock).mockReturnValue(false);

    const handler = TestBed.inject(ChunkLoadErrorHandler);
    const err = new Error('regular');
    handler.handleError(err);

    expect(recoverFromChunkLoadError).not.toHaveBeenCalled();
    expect(superHandleError).toHaveBeenCalledWith(err);
  });
});
