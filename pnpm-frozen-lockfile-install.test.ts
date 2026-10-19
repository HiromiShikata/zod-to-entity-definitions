import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type PnpmFrozenLockfileInstallCase = {
  purpose: 'acceptance criterion' | 'existing behaviour';
  pnpmVersion: string;
};

type PnpmInstallResult = {
  exitStatus: number | null;
  combinedOutput: string;
};

const pnpmFrozenLockfileInstallCases: PnpmFrozenLockfileInstallCase[] = [
  { purpose: 'acceptance criterion', pnpmVersion: '12.10.1' },
  { purpose: 'acceptance criterion', pnpmVersion: '11.18.0' },
  { purpose: 'existing behaviour', pnpmVersion: '10.34.6' },
  { purpose: 'existing behaviour', pnpmVersion: '9.15.9' },
];

const pnpmInstallInputFileNames = [
  'package.json',
  '.npmrc',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
];

const hostPackageManagerVariablePattern = /^(npm_|pnpm_|xdg_)/i;
const ignoredBuildsErrorCode = 'ERR_PNPM_IGNORED_BUILDS';
const installProcessTimeoutMilliseconds = 150_000;
const testTimeoutMilliseconds = 180_000;

const copyPnpmInstallInputs = (destinationDirectory: string): void => {
  for (const fileName of pnpmInstallInputFileNames) {
    const sourcePath = resolve(__dirname, fileName);
    if (existsSync(sourcePath)) {
      copyFileSync(sourcePath, join(destinationDirectory, fileName));
    }
  }
};

const buildEnvironmentWithoutHostPackageManagerSettings = (
  homeDirectory: string
): NodeJS.ProcessEnv => {
  const inheritedEntries = Object.entries(process.env).filter(
    ([variableName]) => !hostPackageManagerVariablePattern.test(variableName)
  );
  return {
    ...Object.fromEntries(inheritedEntries),
    HOME: homeDirectory,
    USERPROFILE: homeDirectory,
  };
};

const runPnpmFrozenLockfileInstall = (pnpmVersion: string): PnpmInstallResult => {
  const workDirectory = mkdtempSync(join(tmpdir(), 'pnpm-frozen-lockfile-install-'));
  try {
    const homeDirectory = join(workDirectory, 'home');
    const projectDirectory = join(workDirectory, 'project');
    const storeDirectory = join(workDirectory, 'store');
    mkdirSync(homeDirectory);
    mkdirSync(projectDirectory);
    copyPnpmInstallInputs(projectDirectory);

    const npxArguments = [
      '--yes',
      `pnpm@${pnpmVersion}`,
      'install',
      '--frozen-lockfile',
      '--store-dir',
      storeDirectory,
    ];
    const spawned = spawnSync('npx', npxArguments, {
      cwd: projectDirectory,
      encoding: 'utf8',
      env: buildEnvironmentWithoutHostPackageManagerSettings(homeDirectory),
      timeout: installProcessTimeoutMilliseconds,
    });

    return {
      exitStatus: spawned.status,
      combinedOutput: `${spawned.stdout}${spawned.stderr}${spawned.error?.message ?? ''}`,
    };
  } finally {
    rmSync(workDirectory, { recursive: true, force: true });
  }
};

describe('pnpm install --frozen-lockfile at the repository root', () => {
  it.each(pnpmFrozenLockfileInstallCases)(
    '$purpose: pnpm $pnpmVersion exits 0 and reports no ERR_PNPM_IGNORED_BUILDS',
    ({ pnpmVersion }) => {
      const result = runPnpmFrozenLockfileInstall(pnpmVersion);

      expect(result.exitStatus, result.combinedOutput).toBe(0);
      expect(result.combinedOutput).not.toContain(ignoredBuildsErrorCode);
    },
    testTimeoutMilliseconds
  );
});
