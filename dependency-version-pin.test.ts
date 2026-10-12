import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type PackageJson = {
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const packageJsonPath = resolve(__dirname, 'package.json');
const pkg: PackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

describe('weekly dependency maintenance update version pins', () => {
  describe('packages bumped to an exact pinned version', () => {
    it('devDependencies["@semantic-release/npm"] is pinned to 13.2.0', () => {
      expect(pkg.devDependencies?.['@semantic-release/npm']).toBe('13.2.0');
    });

    it('devDependencies["@types/node"] is pinned to 22.20.5', () => {
      expect(pkg.devDependencies?.['@types/node']).toBe('22.20.5');
    });

    it('devDependencies["tsx"] is pinned to 4.23.15', () => {
      expect(pkg.devDependencies?.tsx).toBe('4.23.15');
    });

    it('devDependencies["semantic-release"] is pinned to 25.0.9', () => {
      expect(pkg.devDependencies?.['semantic-release']).toBe('25.0.9');
    });

    it('devDependencies["vitest"] is pinned to 5.0.3', () => {
      expect(pkg.devDependencies?.vitest).toBe('5.0.3');
    });

    it('devDependencies["zod"] is pinned to 4.6.5', () => {
      expect(pkg.devDependencies?.zod).toBe('4.6.5');
    });

    it('peerDependencies["zod"] is pinned to 4.6.5', () => {
      expect(pkg.peerDependencies?.zod).toBe('4.6.5');
    });

    it('devDependencies["@commitlint/cli"] is pinned to 21.2.3', () => {
      expect(pkg.devDependencies?.['@commitlint/cli']).toBe('21.2.3');
    });

    it('devDependencies["@commitlint/config-conventional"] is pinned to 21.2.3', () => {
      expect(pkg.devDependencies?.['@commitlint/config-conventional']).toBe('21.2.3');
    });

    it('devDependencies["@semantic-release/changelog"] is pinned to 7.0.0', () => {
      expect(pkg.devDependencies?.['@semantic-release/changelog']).toBe('7.0.0');
    });

    it('devDependencies["@semantic-release/git"] is pinned to 11.0.1', () => {
      expect(pkg.devDependencies?.['@semantic-release/git']).toBe('11.0.1');
    });

    it('devDependencies["conventional-changelog-conventionalcommits"] is pinned to 10.4.1', () => {
      expect(pkg.devDependencies?.['conventional-changelog-conventionalcommits']).toBe('10.4.1');
    });
  });

  describe('packages excluded from this maintenance cycle', () => {
    it('devDependencies["@biomejs/biome"] has not moved to the prospective 2.5.15 bump', () => {
      expect(pkg.devDependencies?.['@biomejs/biome']).not.toBe('2.5.15');
    });

    it('devDependencies["typescript"] has not moved to the prospective 7.0.2 bump', () => {
      expect(pkg.devDependencies?.typescript).not.toBe('7.0.2');
    });
  });
});
