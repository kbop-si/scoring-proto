import type { GameAction } from '../types';

type DispatchFn = (action: GameAction) => void;
let _dispatch: DispatchFn | null = null;

export function registerDeleteDispatch(dispatch: DispatchFn) {
  console.log('[bridge] registerDeleteDispatch called');
  _dispatch = dispatch;
}

export function deleteCell(cellKey: string) {
  console.log('[bridge] deleteCell called, key=', cellKey, 'dispatch=', !!_dispatch);
  _dispatch?.({ type: 'DELETE_CELL', cellKey });
}
