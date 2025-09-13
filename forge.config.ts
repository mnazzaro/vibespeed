import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      // Unpack native modules and the entire node-pty package so its .node can be loaded
      unpack: '{**/*.node,**/*.dylib,**/*.so,**/*.dll,**/node_modules/node-pty/**}',
    },
    // icon: './src/assets/icon', // Uncomment when you have an icon file
    appBundleId: 'com.vibespeed.app', // Bundle ID for macOS
    appCategoryType: 'public.app-category.productivity', // macOS app category
    // osxSign: {}, // Uncomment to enable code signing (will use your keychain certificates)
    // osxNotarize: undefined, // Set this up later if you want to notarize
    extraResource: ['.env.production'],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerDMG({
      // background: './src/assets/dmg-background.png', // Optional: custom DMG background
      // icon: './src/assets/icon.icns', // Optional: custom icon for the DMG
      format: 'ULFO', // macOS 10.11+ compressed format
    }),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({
      // Ensure node-pty native module is properly handled
    }),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      // Allow loading unpacked native modules like node-pty from app.asar.unpacked
      [FuseV1Options.OnlyLoadAppFromAsar]: false,
    }),
  ],
  hooks: {
    // Rebuild native modules for the target Electron in the project root before packaging
    // Casting to any to satisfy varying hook signatures across Forge versions
    prePackage: (async (..._args: any[]) => {
      const { rebuild } = await import('@electron/rebuild');
      const pkg = ((await import('./package.json', { assert: { type: 'json' } })) as any).default;
      const electronVersion = (pkg?.devDependencies?.electron || pkg?.dependencies?.electron || '38.0.0').replace(
        /^\^|~/,
        ''
      );
      const arch = process.arch;
      await rebuild({
        buildPath: process.cwd(),
        electronVersion,
        arch,
        force: true,
        onlyModules: ['node-pty'],
      });
    }) as unknown as any,
    packageAfterPrune: async (_forgeConfig, buildPath) => {
      const path = await import('node:path');
      const fs = await import('node:fs/promises');
      const { existsSync } = await import('node:fs');

      const src = path.resolve(process.cwd(), 'node_modules/node-pty');
      const dest = path.resolve(buildPath, 'node_modules/node-pty');

      if (!existsSync(src)) return;

      await fs.mkdir(path.dirname(dest), { recursive: true });
      // Copy the entire package; our asar.unpack rule will place native .node outside the asar
      await fs.cp(src, dest, { recursive: true, dereference: true });
    },
  },
};

export default config;
