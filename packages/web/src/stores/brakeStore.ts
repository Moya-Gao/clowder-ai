'use client';

import { create } from 'zustand';
import type { BrakeEvent } from '@cat-cafe/shared';
import { apiFetch } from '@/utils/api-client';

interface BrakeStoreState {
	visible: boolean;
	level: 1 | 2 | 3;
	activeMinutes: number;
	nightMode: boolean;
	/** Submitting check-in */
	submitting: boolean;
	/** True when bypass exhausted (3+ in 4h) — hide continue button */
	bypassDisabled: boolean;

	show: (event: BrakeEvent) => void;
	hide: () => void;
	checkin: (choice: 'rest' | 'wrap_up' | 'continue', reason?: string) => Promise<void>;
}

export const useBrakeStore = create<BrakeStoreState>((set) => ({
	visible: false,
	level: 1,
	activeMinutes: 0,
	nightMode: false,
	submitting: false,
	bypassDisabled: false,

	show: (event) =>
		set({
			visible: true,
			level: event.level,
			activeMinutes: event.activeMinutes,
			nightMode: event.nightMode,
			submitting: false,
			bypassDisabled: false, // Reset on each new trigger
		}),

	hide: () => set({ visible: false, submitting: false, bypassDisabled: false }),

	checkin: async (choice, reason) => {
		set({ submitting: true });
		try {
			const res = await apiFetch('/api/brake/checkin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ choice, reason }),
			});
			const data = await res.json();
			if (data.bypassDisabled) {
				// Bypass exhausted — keep modal open, disable continue
				set({ submitting: false, bypassDisabled: true });
			} else {
				set({ visible: false, submitting: false, bypassDisabled: false });
			}
		} catch {
			set({ submitting: false });
		}
	},
}));
