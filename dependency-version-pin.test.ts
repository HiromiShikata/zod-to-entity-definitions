import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type PackageJson = {
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const packageJsonPath = resolve(__dirname, 'package.json');
const pkg: PackageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

type LockfileName = 'package-lock.json' | 'pnpm-lock.yaml';

type PackageLock = {
  packages?: Record<string, { version?: string }>;
};

type PnpmImporterDependency = {
  specifier?: string;
  resolvedVersion?: string;
};

type DevDependencyAgreementCase = {
  packageName: string;
  packageJsonRange: string;
  packageLockVersion: string | undefined;
  pnpmSpecifier: string | undefined;
  pnpmResolvedVersion: string | undefined;
};

const pnpmTopLevelSectionPattern = /^([A-Za-z]+):/;
const pnpmImporterPattern = /^ {2}(\S.*):$/;
const pnpmDependencyGroupPattern = /^ {4}([A-Za-z]+):$/;
const pnpmDependencyNamePattern = /^ {6}(?:'([^']+)'|([^\s'][^:]*)):$/;
const pnpmDependencyFieldPattern = /^ {8}(specifier|version): (.+)$/;

const readLockfileText = (lockfileName: LockfileName): string =>
  readFileSync(resolve(__dirname, lockfileName), 'utf-8');

const stripSurroundingQuotes = (value: string): string => value.replace(/^'(.*)'$/, '$1');

const parsePnpmRootImporterDevDependencies = (
  lockfileText: string
): Record<string, PnpmImporterDependency> => {
  const dependencies: Record<string, PnpmImporterDependency> = {};
  let currentSection = '';
  let currentImporter = '';
  let currentDependencyGroup = '';
  let currentPackageName = '';
  for (const line of lockfileText.split(/\r?\n/)) {
    const sectionMatch = pnpmTopLevelSectionPattern.exec(line);
    if (sectionMatch !== null) {
      currentSection = sectionMatch[1] ?? '';
      currentImporter = '';
      currentDependencyGroup = '';
      continue;
    }
    if (currentSection !== 'importers') {
      continue;
    }
    const importerMatch = pnpmImporterPattern.exec(line);
    if (importerMatch !== null) {
      currentImporter = importerMatch[1] ?? '';
      currentDependencyGroup = '';
      continue;
    }
    const dependencyGroupMatch = pnpmDependencyGroupPattern.exec(line);
    if (dependencyGroupMatch !== null) {
      currentDependencyGroup = dependencyGroupMatch[1] ?? '';
      continue;
    }
    if (currentImporter !== '.' || currentDependencyGroup !== 'devDependencies') {
      continue;
    }
    const dependencyNameMatch = pnpmDependencyNamePattern.exec(line);
    if (dependencyNameMatch !== null) {
      currentPackageName = dependencyNameMatch[1] ?? dependencyNameMatch[2] ?? '';
      continue;
    }
    const dependencyFieldMatch = pnpmDependencyFieldPattern.exec(line);
    if (dependencyFieldMatch !== null) {
      const fieldValue = stripSurroundingQuotes(dependencyFieldMatch[2] ?? '');
      const existingDependency = dependencies[currentPackageName] ?? {};
      dependencies[currentPackageName] =
        dependencyFieldMatch[1] === 'specifier'
          ? { ...existingDependency, specifier: fieldValue }
          : { ...existingDependency, resolvedVersion: fieldValue.split('(')[0] };
    }
  }
  return dependencies;
};

const readPackageLockVersion = (packageName: string): string | undefined => {
  const packageLock: PackageLock = JSON.parse(readLockfileText('package-lock.json'));
  return packageLock.packages?.[`node_modules/${packageName}`]?.version;
};

const buildDevDependencyAgreementCases = (): DevDependencyAgreementCase[] => {
  const pnpmDependencies = parsePnpmRootImporterDevDependencies(readLockfileText('pnpm-lock.yaml'));
  return Object.entries(pkg.devDependencies ?? {}).map(([packageName, packageJsonRange]) => ({
    packageName,
    packageJsonRange,
    packageLockVersion: readPackageLockVersion(packageName),
    pnpmSpecifier: pnpmDependencies[packageName]?.specifier,
    pnpmResolvedVersion: pnpmDependencies[packageName]?.resolvedVersion,
  }));
};

const describeDisagreements = (agreementCase: DevDependencyAgreementCase): string[] => {
  const disagreements: string[] = [];
  if (agreementCase.pnpmSpecifier !== agreementCase.packageJsonRange) {
    disagreements.push(
      `${agreementCase.packageName}: pnpm-lock.yaml specifier ${agreementCase.pnpmSpecifier ?? 'missing'} differs from package.json range ${agreementCase.packageJsonRange}`
    );
  }
  if (agreementCase.pnpmResolvedVersion !== agreementCase.packageLockVersion) {
    disagreements.push(
      `${agreementCase.packageName}: pnpm-lock.yaml resolved version ${agreementCase.pnpmResolvedVersion ?? 'missing'} differs from package-lock.json version ${agreementCase.packageLockVersion ?? 'missing'}`
    );
  }
  return disagreements;
};

describe('weekly dependency maintenance update version pins', () => {
  describe('packages bumped to an exact pinned version', () => {
    it('devDependencies["@semantic-release/npm"] is pinned to 13.2.0', () => {
      expect(pkg.devDependencies?.['@semantic-release/npm']).toBe('13.2.0');
    });

    it('devDependencies["@types/node"] is pinned to 26.6.5', () => {
      expect(pkg.devDependencies?.['@types/node']).toBe('26.6.5');
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

    it('devDependencies["zod"] is pinned to 4.6.6', () => {
      expect(pkg.devDependencies?.zod).toBe('4.6.6');
    });

    it('peerDependencies["zod"] is pinned to 4.6.6', () => {
      expect(pkg.peerDependencies?.zod).toBe('4.6.6');
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

  describe('lockfiles resolve the pinned zod version', () => {
    it('package-lock.json resolves zod to 4.6.6', () => {
      expect(readPackageLockVersion('zod')).toBe('4.6.6');
    });

    it('pnpm-lock.yaml importer "." resolves zod to 4.6.6 with specifier 4.6.6', () => {
      const pnpmDependencies = parsePnpmRootImporterDevDependencies(
        readLockfileText('pnpm-lock.yaml')
      );

      expect(pnpmDependencies.zod).toEqual({ specifier: '4.6.6', resolvedVersion: '4.6.6' });
    });
  });

  describe('pnpm-lock.yaml agrees with package.json and package-lock.json', () => {
    it('every devDependency has the package.json range as specifier and the package-lock.json version as resolved version', () => {
      const agreementCases = buildDevDependencyAgreementCases();

      expect(agreementCases.length).toBeGreaterThan(0);
      expect(agreementCases.flatMap(describeDisagreements)).toEqual([]);
    });
  });
});
