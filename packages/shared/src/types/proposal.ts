/**
 * F128: Thread proposal types.
 *
 * Cats propose a new thread via `cat_cafe_propose_thread`; the user
 * sees a card, edits if needed, and approves or rejects. Only on
 * approve does the backend actually create a thread.
 */

import type { CatId } from './ids.js';

export type ProposalStatus = 'pending' | 'approved' | 'rejected';

/**
 * A thread proposal created by a cat, awaiting user decision.
 */
export interface ThreadProposal {
  proposalId: string;
  status: ProposalStatus;

  // Source / lineage
  sourceThreadId: string;
  sourceInvocationId: string;
  sourceCatId: CatId;

  // Prefilled fields (user may override at approve time)
  title: string;
  reason: string;
  parentThreadId: string; // defaults to sourceThreadId at create time
  preferredCats: CatId[]; // empty array if none
  initialMessage?: string;
  projectPath: string;

  // Audit — creation
  createdBy: string;
  createdAt: number;

  // Audit — approval outcome
  approvedBy?: string;
  approvedAt?: number;
  createdThreadId?: string;

  // Audit — rejection outcome
  rejectedBy?: string;
  rejectedAt?: number;
  rejectionReason?: string;
}

/**
 * Fields the user may override at approve time.
 * `null` means "clear the field" for preferredCats/initialMessage;
 * `undefined` means "keep the proposal's prefilled value".
 */
export interface ProposalApproveOverrides {
  title?: string;
  parentThreadId?: string;
  preferredCats?: CatId[];
  initialMessage?: string | null;
}
