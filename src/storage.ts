import type { AppState } from './state';

const KEY = 'hoops_tracker_v1';

export function storeOK(): boolean {
  try {
    localStorage.setItem('__t', '1');
    localStorage.removeItem('__t');
    return true;
  } catch {
    return false;
  }
}

export const CAN_STORE = storeOK();

export function persist(state: AppState): void {
  if (!CAN_STORE) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 容量超過などの保存失敗はメモリ動作にフォールバック
  }
}

export function restore(): AppState | null {
  if (!CAN_STORE) return null;
  try {
    const s = localStorage.getItem(KEY);
    return s ? (JSON.parse(s) as AppState) : null;
  } catch {
    return null;
  }
}
