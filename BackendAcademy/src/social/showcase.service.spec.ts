import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { FollowService } from './follow.service';
import { ShowcaseService } from './showcase.service';

/** A real, checksum-valid contract id derived from a keypair's raw bytes. */
const VALID_CONTRACT_ID = StrKey.encodeContract(Keypair.random().rawPublicKey());

describe('ShowcaseService', () => {
  let followService: FollowService;
  let service: ShowcaseService;

  beforeEach(() => {
    followService = new FollowService();
    service = new ShowcaseService(followService);
  });

  const valid = {
    authorId: 'tutor-1',
    title: 'Soroban escrow demo',
    repoUrl: 'https://github.com/example/escrow',
    demoUrl: 'https://escrow.example.dev',
    contractId: VALID_CONTRACT_ID,
  };

  describe('creation', () => {
    it('stores a showcase with all three references', () => {
      const post = service.create(valid);

      expect(post.kind).toBe('showcase');
      expect(post.repoUrl).toBe(valid.repoUrl);
      expect(post.demoUrl).toBe(valid.demoUrl);
      expect(post.contractId).toBe(VALID_CONTRACT_ID);
      expect(service.get(post.itemId)).toEqual(post);
    });

    it('lists showcases by author', () => {
      service.create(valid);
      service.create({ ...valid, title: 'Second' });
      service.create({ ...valid, authorId: 'tutor-2' });

      expect(service.listByAuthor('tutor-1')).toHaveLength(2);
      expect(service.listByAuthor('tutor-2')).toHaveLength(1);
    });
  });

  describe('showcase is flagged in the feed', () => {
    it('fans out with kind showcase so rendering can flag it', () => {
      followService.follow('learner-1', 'tutor-1');

      const post = service.create(valid);

      const feed = followService.getFeed('learner-1');
      expect(feed).toHaveLength(1);
      expect(feed[0].itemId).toBe(post.itemId);
      expect(feed[0].kind).toBe('showcase');
    });

    it('does not fan out when the author has no followers', () => {
      service.create(valid);
      expect(followService.getFeed('learner-1')).toEqual([]);
    });
  });

  describe('invalid contract ids are rejected', () => {
    it('rejects a syntactically wrong id', () => {
      expect(() => service.create({ ...valid, contractId: 'not-a-contract' })).toThrow(
        BadRequestException,
      );
    });

    it('rejects an account id instead of a contract id', () => {
      // G… is a valid strkey but the wrong kind, which a "starts with C" check
      // would catch yet a "56 chars base32" check would not.
      const accountId = Keypair.random().publicKey();
      expect(() => service.create({ ...valid, contractId: accountId })).toThrow(
        BadRequestException,
      );
    });

    it('rejects an id whose checksum is wrong', () => {
      // Same shape and prefix as a real id, one character changed, so only
      // checksum validation catches it.
      const swap = VALID_CONTRACT_ID[10] === 'A' ? 'B' : 'A';
      const corrupted =
        VALID_CONTRACT_ID.slice(0, 10) + swap + VALID_CONTRACT_ID.slice(11);

      expect(corrupted).toHaveLength(VALID_CONTRACT_ID.length);
      expect(corrupted.startsWith('C')).toBe(true);
      expect(() => service.create({ ...valid, contractId: corrupted })).toThrow(
        BadRequestException,
      );
    });

    it('does not store or fan out a rejected showcase', () => {
      followService.follow('learner-1', 'tutor-1');

      expect(() => service.create({ ...valid, contractId: 'bad' })).toThrow();

      expect(service.listByAuthor('tutor-1')).toEqual([]);
      expect(followService.getFeed('learner-1')).toEqual([]);
    });
  });

  describe('url validation', () => {
    it.each(['repoUrl', 'demoUrl'] as const)('rejects a non-absolute %s', (field) => {
      expect(() => service.create({ ...valid, [field]: 'example.com/repo' })).toThrow(
        BadRequestException,
      );
    });

    it.each(['repoUrl', 'demoUrl'] as const)('rejects plaintext http for %s', (field) => {
      expect(() => service.create({ ...valid, [field]: 'http://example.com' })).toThrow(
        /must use https/,
      );
    });

    it('names the offending field in the error', () => {
      expect(() => service.create({ ...valid, demoUrl: 'nope' })).toThrow(/demoUrl/);
    });
  });

  // ── BA-056: Enforce showcase ownership on updates ────────────────────────

  describe('BA-056 — Enforce showcase ownership on updates', () => {
    it('allows the authenticated project owner to update their showcase', () => {
      const post = service.create(valid);

      const updated = service.update(post.itemId, 'tutor-1', {
        title: 'Updated Escrow Demo',
        demoUrl: 'https://new-demo.example.dev',
      });

      expect(updated.title).toBe('Updated Escrow Demo');
      expect(updated.demoUrl).toBe('https://new-demo.example.dev');
      expect(updated.repoUrl).toBe(valid.repoUrl);
      expect(service.get(post.itemId)?.title).toBe('Updated Escrow Demo');
    });

    it('rejects edits by non-owners with ForbiddenException', () => {
      const post = service.create(valid);

      expect(() =>
        service.update(post.itemId, 'imposter-user', {
          title: 'Hacked showcase',
        }),
      ).toThrow(ForbiddenException);

      // Verify stored showcase is uncorrupted
      expect(service.get(post.itemId)?.title).toBe(valid.title);
    });

    it('rejects updates when editorId is missing or empty', () => {
      const post = service.create(valid);

      expect(() =>
        service.update(post.itemId, '', {
          title: 'Anonymous edit',
        }),
      ).toThrow(ForbiddenException);
    });

    it('throws NotFoundException for non-existent showcase item', () => {
      expect(() =>
        service.update('showcase-nonexistent', 'tutor-1', {
          title: 'New Title',
        }),
      ).toThrow(NotFoundException);
    });

    it('validates updated URLs and rejects plaintext http', () => {
      const post = service.create(valid);

      expect(() =>
        service.update(post.itemId, 'tutor-1', {
          demoUrl: 'http://insecure.example.dev',
        }),
      ).toThrow(BadRequestException);
    });
  });
});
