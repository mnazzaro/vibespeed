# Dependency Management Guide

## Overview

This project uses pnpm for package management with specific configurations to handle Electron and lefthook dependencies properly.

## Known Issues and Solutions

### Issue: `pnpm install --dev` Error

**Problem**: Running `pnpm install --dev` results in the following error:

```
ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY  Broken lockfile: no entry for 'global-agent@3.0.0' in pnpm-lock.yaml
```

**Root Cause**: The `--dev` flag in pnpm attempts to install only devDependencies, which can break the lockfile when transitive dependencies (like `global-agent` required by Electron packages) are shared between dev and production dependencies.

**Solution**: We've implemented a production-ready configuration that ensures all dependencies are properly managed.

## Configuration

### 1. Package.json Configuration

The following configurations are set in `package.json`:

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["electron", "electron-winstaller", "lefthook"]
  },
  "scripts": {
    "postinstall": "lefthook install",
    "prepare": "lefthook install"
  }
}
```

- **onlyBuiltDependencies**: Allows specific packages to run build scripts during installation
- **postinstall/prepare scripts**: Ensures lefthook git hooks are installed automatically

### 2. .npmrc Configuration

The `.npmrc` file contains:

```ini
frozen-lockfile=false          # Allows lockfile updates when needed
enable-pre-post-scripts=true   # Enables lifecycle scripts
shamefully-hoist=true          # Ensures proper Electron dependency resolution
strict-peer-dependencies=false  # Prevents installation failures from peer dep warnings
```

## Installation Commands

### Development Setup

```bash
# Standard installation (recommended)
pnpm install

# Clean installation
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### CI/CD Setup

```bash
# For CI environments where you want a frozen lockfile
pnpm install --frozen-lockfile

# For production builds (excludes devDependencies)
pnpm install --prod
```

## Important Notes

1. **Avoid `pnpm install --dev`**: This flag is problematic with complex dependency trees. Use standard `pnpm install` instead.

2. **Lefthook Integration**: The git hooks are automatically installed via postinstall scripts. No manual setup required.

3. **Electron Dependencies**: The `shamefully-hoist` setting ensures Electron and its dependencies are properly accessible.

4. **Build Scripts**: Only approved packages (electron, electron-winstaller, lefthook) can run build scripts for security.

## Troubleshooting

### If hooks aren't installing:

```bash
# Manually install lefthook hooks
pnpm exec lefthook install
```

### If you encounter lockfile errors:

```bash
# Regenerate lockfile
rm pnpm-lock.yaml
pnpm install
```

### To verify installation:

```bash
# Check if lefthook is working
pnpm exec lefthook run pre-commit
```

## Best Practices

1. Always commit both `package.json` and `pnpm-lock.yaml` together
2. Run `pnpm install` after pulling changes that modify dependencies
3. Use `pnpm add` and `pnpm remove` for dependency management
4. Don't use the `--dev` flag with `pnpm install`

## Related Files

- `package.json` - Main package configuration
- `pnpm-lock.yaml` - Lockfile (auto-generated)
- `.npmrc` - pnpm configuration
- `lefthook.yml` - Git hooks configuration
