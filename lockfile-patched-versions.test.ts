import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type LockfileName = 'package-lock.json' | 'pnpm-lock.yaml';

type VulnerablePackage = {
  packageName: string;
  vulnerableFrom: string;
  patchedVersion: string;
  lockfilesCovered: LockfileName[];
};

type ResolvedPackageInstance = {
  packageName: string;
  version: string;
};

type PackageLockEntry = {
  name?: string;
  version?: string;
};

type PackageLock = {
  packages?: Record<string, PackageLockEntry>;
};

const vulnerablePackages: VulnerablePackage[] = [
  {
    packageName: 'handlebars',
    vulnerableFrom: '3.0.0',
    patchedVersion: '4.7.10',
    lockfilesCovered: ['package-lock.json', 'pnpm-lock.yaml'],
  },
  {
    packageName: 'undici',
    vulnerableFrom: '7.0.0',
    patchedVersion: '7.29.1',
    lockfilesCovered: ['package-lock.json', 'pnpm-lock.yaml'],
  },
  {
    packageName: 'ip-address',
    vulnerableFrom: '0.0.0',
    patchedVersion: '10.3.1',
    lockfilesCovered: ['package-lock.json'],
  },
  {
    packageName: 'fast-uri',
    vulnerableFrom: '3.0.0',
    patchedVersion: '3.1.7',
    lockfilesCovered: ['pnpm-lock.yaml'],
  },
  {
    packageName: 'rollup',
    vulnerableFrom: '4.0.0',
    patchedVersion: '4.59.0',
    lockfilesCovered: ['pnpm-lock.yaml'],
  },
  {
    packageName: 'lodash',
    vulnerableFrom: '4.0.0',
    patchedVersion: '4.18.0',
    lockfilesCovered: ['pnpm-lock.yaml'],
  },
  {
    packageName: 'js-yaml',
    vulnerableFrom: '4.0.0',
    patchedVersion: '4.3.2',
    lockfilesCovered: ['pnpm-lock.yaml'],
  },
  {
    packageName: 'source-map-js',
    vulnerableFrom: '1.0.0',
    patchedVersion: '1.2.2',
    lockfilesCovered: ['pnpm-lock.yaml'],
  },
  {
    packageName: 'http-cache-semantics',
    vulnerableFrom: '0.0.0',
    patchedVersion: '4.3.0',
    lockfilesCovered: ['package-lock.json'],
  },
];

const packageNamesInBothLockfiles = ['handlebars', 'undici'];

const readLockfile = (lockfileName: LockfileName): string =>
  readFileSync(resolve(__dirname, lockfileName), 'utf-8');

const parseMajorMinorPatch = (version: string): number[] => {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (match === null) {
    throw new Error(`Version does not start with major.minor.patch: ${version}`);
  }
  return match.slice(1, 4).map(Number);
};

const compareMajorMinorPatch = (leftVersion: string, rightVersion: string): number => {
  const rightParts = parseMajorMinorPatch(rightVersion);
  const differences = parseMajorMinorPatch(leftVersion).map(
    (leftPart, index) => leftPart - (rightParts[index] ?? 0)
  );
  return differences.find((difference) => difference !== 0) ?? 0;
};

const isOffendingVersion = (vulnerablePackage: VulnerablePackage, version: string): boolean =>
  compareMajorMinorPatch(version, vulnerablePackage.vulnerableFrom) >= 0 &&
  compareMajorMinorPatch(version, vulnerablePackage.patchedVersion) < 0;

const parsePackageLockInstances = (lockfileText: string): ResolvedPackageInstance[] => {
  const packageLock: PackageLock = JSON.parse(lockfileText);
  return Object.entries(packageLock.packages ?? {}).flatMap(([packagePath, entry]) => {
    const pathMatch = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/.exec(packagePath);
    if (pathMatch === null || entry.version === undefined) {
      return [];
    }
    const packageNameFromPath = pathMatch[1] ?? '';
    return [{ packageName: entry.name ?? packageNameFromPath, version: entry.version }];
  });
};

const pnpmSectionPattern = /^([A-Za-z]+):/;
const pnpmEntryKeyPattern = /^ {2}(?:'([^']+)'|([^\s'].*?)):(?: \{\})?$/;
const pnpmSectionsListingResolvedPackages = ['packages', 'snapshots'];

const parsePnpmEntryKey = (entryKey: string): ResolvedPackageInstance[] => {
  const keyWithoutPeerSuffix = entryKey.split('(')[0] ?? entryKey;
  const versionSeparatorIndex = keyWithoutPeerSuffix.lastIndexOf('@');
  if (versionSeparatorIndex <= 0) {
    return [];
  }
  return [
    {
      packageName: keyWithoutPeerSuffix.slice(0, versionSeparatorIndex),
      version: keyWithoutPeerSuffix.slice(versionSeparatorIndex + 1),
    },
  ];
};

const parsePnpmLockInstances = (lockfileText: string): ResolvedPackageInstance[] => {
  const instances: ResolvedPackageInstance[] = [];
  let currentSection = '';
  for (const line of lockfileText.split(/\r?\n/)) {
    const sectionMatch = pnpmSectionPattern.exec(line);
    if (sectionMatch !== null) {
      currentSection = sectionMatch[1] ?? '';
      continue;
    }
    if (!pnpmSectionsListingResolvedPackages.includes(currentSection)) {
      continue;
    }
    const entryKeyMatch = pnpmEntryKeyPattern.exec(line);
    const unquotedEntryKey = entryKeyMatch?.[1] ?? entryKeyMatch?.[2];
    if (unquotedEntryKey !== undefined) {
      instances.push(...parsePnpmEntryKey(unquotedEntryKey));
    }
  }
  return instances;
};

const findOffenders = (
  lockfileName: LockfileName,
  vulnerablePackage: VulnerablePackage,
  instances: ResolvedPackageInstance[]
): string[] => {
  const offendingVersions = instances
    .filter((instance) => instance.packageName === vulnerablePackage.packageName)
    .filter((instance) => isOffendingVersion(vulnerablePackage, instance.version))
    .map((instance) => instance.version);
  return [...new Set(offendingVersions)].map(
    (version) =>
      `${lockfileName}: ${vulnerablePackage.packageName}@${version} (patched: ${vulnerablePackage.patchedVersion})`
  );
};

const findPackageNamesWithoutInstances = (
  packageNames: string[],
  instances: ResolvedPackageInstance[]
): string[] =>
  packageNames.filter(
    (packageName) => !instances.some((instance) => instance.packageName === packageName)
  );

describe('lockfiles resolve patched versions of vulnerable packages', () => {
  describe('package-lock.json', () => {
    it('parses resolved instances of handlebars and undici', () => {
      const instances = parsePackageLockInstances(readLockfile('package-lock.json'));

      expect(findPackageNamesWithoutInstances(packageNamesInBothLockfiles, instances)).toEqual([]);
    });

    it('resolves no instance below the patched version of a vulnerable package', () => {
      const instances = parsePackageLockInstances(readLockfile('package-lock.json'));

      const offenders = vulnerablePackages
        .filter((vulnerablePackage) =>
          vulnerablePackage.lockfilesCovered.includes('package-lock.json')
        )
        .flatMap((vulnerablePackage) =>
          findOffenders('package-lock.json', vulnerablePackage, instances)
        );

      expect(offenders).toEqual([]);
    });
  });

  describe('pnpm-lock.yaml', () => {
    it('parses resolved instances of handlebars and undici', () => {
      const instances = parsePnpmLockInstances(readLockfile('pnpm-lock.yaml'));

      expect(findPackageNamesWithoutInstances(packageNamesInBothLockfiles, instances)).toEqual([]);
    });

    it('resolves no instance below the patched version of a vulnerable package', () => {
      const instances = parsePnpmLockInstances(readLockfile('pnpm-lock.yaml'));

      const offenders = vulnerablePackages
        .filter((vulnerablePackage) =>
          vulnerablePackage.lockfilesCovered.includes('pnpm-lock.yaml')
        )
        .flatMap((vulnerablePackage) =>
          findOffenders('pnpm-lock.yaml', vulnerablePackage, instances)
        );

      expect(offenders).toEqual([]);
    });
  });
});
