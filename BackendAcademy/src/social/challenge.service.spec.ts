import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChallengeService } from './challenge.service';

const POT = 10_000_000n; // 1 XLM in stroops

describe('ChallengeService', () => {
  let service: ChallengeService;

  beforeEach(() => {
    service = new ChallengeService();
    service.create({ challengeId: 'wk-1', title: 'Week 1: no_std parsing', potStroops: POT });
  });

  /** Drives a challenge to `voting` with two entries. */
  const withEntries = () => {
    service.submit('wk-1', { userId: 'alice', submissionId: 'sub-a' });
    service.submit('wk-1', { userId: 'bob', submissionId: 'sub-b' });
    service.openVoting('wk-1');
  };

  describe('creation', () => {
    it('starts open', () => {
      expect(service.get('wk-1').state).toBe('open');
    });

    it('rejects a duplicate id', () => {
      expect(() =>
        service.create({ challengeId: 'wk-1', title: 'again', potStroops: POT }),
      ).toThrow(BadRequestException);
    });

    it('rejects a negative pot', () => {
      expect(() =>
        service.create({ challengeId: 'wk-2', title: 'bad', potStroops: -1n }),
      ).toThrow(BadRequestException);
    });

    it('throws for an unknown challenge', () => {
      expect(() => service.get('nope')).toThrow(NotFoundException);
    });
  });

  describe('lifecycle is enforced by the state machine', () => {
    it('allows open → voting → closed', () => {
      expect(service.openVoting('wk-1').state).toBe('voting');
      expect(service.close('wk-1').challenge.state).toBe('closed');
    });

    it('refuses to skip voting', () => {
      expect(() => service.close('wk-1')).toThrow(/from open to closed/);
    });

    it('refuses to reopen voting once closed', () => {
      service.openVoting('wk-1');
      service.close('wk-1');

      expect(() => service.openVoting('wk-1')).toThrow(/from closed to voting/);
    });

    it('refuses to enter voting twice', () => {
      service.openVoting('wk-1');
      expect(() => service.openVoting('wk-1')).toThrow(/from voting to voting/);
    });

    it('refuses to close twice', () => {
      service.openVoting('wk-1');
      service.close('wk-1');
      expect(() => service.close('wk-1')).toThrow(/from closed to closed/);
    });
  });

  describe('submissions', () => {
    it('accepts entries while open', () => {
      service.submit('wk-1', { userId: 'alice', submissionId: 'sub-a' });
      expect(service.getSubmissions('wk-1')).toHaveLength(1);
    });

    it('rejects a duplicate submission id', () => {
      service.submit('wk-1', { userId: 'alice', submissionId: 'sub-a' });
      expect(() => service.submit('wk-1', { userId: 'bob', submissionId: 'sub-a' })).toThrow(
        BadRequestException,
      );
    });

    it('rejects entries once voting has opened', () => {
      service.openVoting('wk-1');
      expect(() => service.submit('wk-1', { userId: 'x', submissionId: 's' })).toThrow(
        /must be open to accept submissions/,
      );
    });
  });

  describe('voting window', () => {
    it('rejects votes before voting opens', () => {
      service.submit('wk-1', { userId: 'alice', submissionId: 'sub-a' });
      expect(() => service.vote('wk-1', { voterId: 'carol', submissionId: 'sub-a' })).toThrow(
        /must be voting to accept votes/,
      );
    });

    it('rejects votes after closing', () => {
      withEntries();
      service.close('wk-1');
      expect(() => service.vote('wk-1', { voterId: 'carol', submissionId: 'sub-a' })).toThrow(
        /must be voting to accept votes/,
      );
    });

    it('counts a vote', () => {
      withEntries();
      service.vote('wk-1', { voterId: 'carol', submissionId: 'sub-a' });
      expect(service.getTally('wk-1')).toEqual({ 'sub-a': 1 });
    });

    it('allows one vote per account', () => {
      withEntries();
      service.vote('wk-1', { voterId: 'carol', submissionId: 'sub-a' });
      expect(() => service.vote('wk-1', { voterId: 'carol', submissionId: 'sub-b' })).toThrow(
        /already voted/,
      );
    });

    it('rejects a self-vote', () => {
      withEntries();
      expect(() => service.vote('wk-1', { voterId: 'alice', submissionId: 'sub-a' })).toThrow(
        /cannot vote for their own submission/,
      );
    });

    it('rejects a vote for an unknown submission', () => {
      withEntries();
      expect(() => service.vote('wk-1', { voterId: 'carol', submissionId: 'ghost' })).toThrow(
        /Unknown submission/,
      );
    });
  });

  describe('closing queues a payout for BE-053', () => {
    it('awards the whole pot to a single winner', () => {
      withEntries();
      service.vote('wk-1', { voterId: 'carol', submissionId: 'sub-a' });

      const { payout } = service.close('wk-1');

      expect(payout.winningSubmissionIds).toEqual(['sub-a']);
      expect(payout.awards['sub-a']).toBe(POT);
      expect(payout.votes).toBe(1);
    });

    it('splits the pot between tied winners', () => {
      withEntries();
      service.vote('wk-1', { voterId: 'carol', submissionId: 'sub-a' });
      service.vote('wk-1', { voterId: 'dave', submissionId: 'sub-b' });

      const { payout } = service.close('wk-1');

      expect(payout.winningSubmissionIds).toEqual(['sub-a', 'sub-b']);
      expect(payout.awards['sub-a']).toBe(POT / 2n);
      expect(payout.awards['sub-b']).toBe(POT / 2n);
    });

    it('gives an indivisible remainder to the first winner so awards sum to the pot', () => {
      // 10 stroops between 3 winners: 4 + 3 + 3, not 3.33 each.
      service.create({ challengeId: 'wk-2', title: 'odd pot', potStroops: 10n });
      service.submit('wk-2', { userId: 'a', submissionId: 's-a' });
      service.submit('wk-2', { userId: 'b', submissionId: 's-b' });
      service.submit('wk-2', { userId: 'c', submissionId: 's-c' });
      service.openVoting('wk-2');
      service.vote('wk-2', { voterId: 'v1', submissionId: 's-a' });
      service.vote('wk-2', { voterId: 'v2', submissionId: 's-b' });
      service.vote('wk-2', { voterId: 'v3', submissionId: 's-c' });

      const { payout } = service.close('wk-2');

      expect(payout.awards).toEqual({ 's-a': 4n, 's-b': 3n, 's-c': 3n });
      const total = Object.values(payout.awards).reduce((sum, v) => sum + v, 0n);
      expect(total).toBe(10n);
    });

    it('queues no winners and no awards when nobody voted', () => {
      withEntries();

      const { payout } = service.close('wk-1');

      expect(payout.winningSubmissionIds).toEqual([]);
      expect(payout.awards).toEqual({});
      expect(payout.votes).toBe(0);
    });

    it('enqueues the payout rather than paying it', () => {
      withEntries();
      service.vote('wk-1', { voterId: 'carol', submissionId: 'sub-a' });

      expect(service.getPendingPayouts()).toHaveLength(0);
      service.close('wk-1');

      const pending = service.getPendingPayouts();
      expect(pending).toHaveLength(1);
      expect(pending[0].challengeId).toBe('wk-1');
    });
  });

  // ── BA-057: Bound challenge submission attempts ──────────────────────────

  describe('BA-057 — Bound challenge submission attempts', () => {
    it('enforces default retry limit: tests before, at, and beyond the limit', () => {
      // Default limit is 3 attempts
      expect(service.getMaxAttempts('wk-1')).toBe(3);

      // 1. Before the limit (attempts 1 and 2)
      const sub1 = service.submit('wk-1', { userId: 'alice', submissionId: 'sub-1' });
      expect(sub1.submissionId).toBe('sub-1');
      expect(service.getAttempts('wk-1', 'alice')).toBe(1);

      const sub2 = service.submit('wk-1', { userId: 'alice', submissionId: 'sub-2' });
      expect(sub2.submissionId).toBe('sub-2');
      expect(service.getAttempts('wk-1', 'alice')).toBe(2);

      // 2. Exactly at the limit (attempt 3)
      const sub3 = service.submit('wk-1', { userId: 'alice', submissionId: 'sub-3' });
      expect(sub3.submissionId).toBe('sub-3');
      expect(service.getAttempts('wk-1', 'alice')).toBe(3);

      // 3. Beyond the limit (attempt 4)
      expect(() =>
        service.submit('wk-1', { userId: 'alice', submissionId: 'sub-4' }),
      ).toThrow(BadRequestException);

      // Verify attempts counter remains at 3
      expect(service.getAttempts('wk-1', 'alice')).toBe(3);
    });

    it('enforces custom configured retry limit: tests before, at, and beyond limit', () => {
      // Create a challenge with maxAttempts = 2
      service.create({
        challengeId: 'custom-bound',
        title: 'Strict Retry Challenge',
        potStroops: POT,
        maxAttempts: 2,
      });

      expect(service.getMaxAttempts('custom-bound')).toBe(2);

      // Before limit (attempt 1)
      service.submit('custom-bound', { userId: 'coder', submissionId: 'c-sub-1' });
      expect(service.getAttempts('custom-bound', 'coder')).toBe(1);

      // At limit (attempt 2)
      service.submit('custom-bound', { userId: 'coder', submissionId: 'c-sub-2' });
      expect(service.getAttempts('custom-bound', 'coder')).toBe(2);

      // Beyond limit (attempt 3) -> rejected
      expect(() =>
        service.submit('custom-bound', { userId: 'coder', submissionId: 'c-sub-3' }),
      ).toThrow(BadRequestException);
    });

    it('does not impact other users attempts', () => {
      service.submit('wk-1', { userId: 'u1', submissionId: 'u1-1' });
      service.submit('wk-1', { userId: 'u1', submissionId: 'u1-2' });
      service.submit('wk-1', { userId: 'u1', submissionId: 'u1-3' });

      // u1 is exhausted
      expect(() => service.submit('wk-1', { userId: 'u1', submissionId: 'u1-4' })).toThrow(
        BadRequestException,
      );

      // u2 can still submit
      expect(service.submit('wk-1', { userId: 'u2', submissionId: 'u2-1' }).submissionId).toBe(
        'u2-1',
      );
    });

    it('rejects creation with maxAttempts less than 1', () => {
      expect(() =>
        service.create({
          challengeId: 'bad-limit',
          title: 'Zero Limit',
          potStroops: POT,
          maxAttempts: 0,
        }),
      ).toThrow(BadRequestException);
    });
  });
});
