import { useScheduleStore } from '../../store/useScheduleStore';
import type { ToastType } from './AppToast';

export function toastSwitchedPlan(
  showToast: (text: string, type?: ToastType, planId?: string) => void,
  planId: string,
  previousPlanId?: string,
): void {
  if (previousPlanId !== undefined && planId === previousPlanId) return;
  const created = useScheduleStore.getState().plans.find((plan) => plan.id === planId);
  if (!created) return;
  showToast(`Switched to "${created.name}"`, 'info', created.id);
}
