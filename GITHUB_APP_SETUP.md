# GitHub App Authentication Setup

This Electron app implements GitHub App installation flow for secure repository access.

## Setup Instructions

### 1. Create a GitHub App

1. Go to https://github.com/settings/apps/new
2. Configure your GitHub App with these settings:

   **GitHub App name:** Your app name
   
   **Homepage URL:** https://your-website.com
   
   **Callback URL:** `vibespeed://auth-callback`
   
   **Webhook URL:** (Optional) Your webhook endpoint
   
   **Permissions:**
   - Repository permissions:
     - Contents: Read/Write
     - Issues: Read/Write  
     - Pull requests: Read/Write
     - Metadata: Read
   - Account permissions:
     - Email addresses: Read
     
   **Where can this GitHub App be installed?** Any account

3. After creating, note down:
   - App Name (the URL slug, e.g., if your app URL is `github.com/apps/my-cool-app`, then the name is `my-cool-app`)
   - App ID
   - Client ID
   - Client Secret
   - Generate and download a private key

### 2. Configure Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your GitHub App credentials in `.env`:
   ```env
   # Required GitHub App Settings
   GITHUB_APP_NAME=your-app-name  # The URL slug of your app
   GITHUB_APP_ID=your_app_id
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   
   # Private Key - Choose one option:
   # Option 1: Path to .pem file
   GITHUB_PRIVATE_KEY_PATH=./private-key.pem
   # Option 2: Base64 encoded private key (use: base64 -i private-key.pem | tr -d '\n')
   # GITHUB_PRIVATE_KEY=LS0tLS1CRUdJTi...
   
   # Optional Settings
   GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
   GITHUB_REDIRECT_URI=vibespeed://auth-callback  # Override default if needed
   
   # Application Environment
   APP_ENV=development  # or 'production'
   APP_DEBUG=true       # Enable debug logging
   APP_LOG_LEVEL=info   # Logging level
   
   # Security (required in production)
   SESSION_SECRET=generate_a_random_string_here
   ```

3. Configure your private key using one of these methods:
   - **Option 1 (File)**: Place your private key file in the project root and set `GITHUB_PRIVATE_KEY_PATH`
   - **Option 2 (Base64)**: Convert your private key to base64 and set `GITHUB_PRIVATE_KEY`:
     ```bash
     base64 -i private-key.pem | tr -d '\n'
     ```
   Note: If both are set, the file path takes precedence.

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Run the Application

```bash
pnpm start
```

## Authentication Flow

1. **User Login**: Click "Sign in with GitHub" button
2. **OAuth Authorization**: Browser opens GitHub authorization page
3. **Installation Selection**: Choose a GitHub App installation
4. **Repository Access**: Browse and select repositories

## Key Features

- **PKCE OAuth Flow**: Enhanced security with Proof Key for Code Exchange
- **Secure Token Storage**: Tokens encrypted using Electron's safeStorage API
- **Auto Token Refresh**: Tokens automatically refresh before expiration
- **Fine-grained Permissions**: Access only what's needed
- **Multi-Installation Support**: Switch between different installations
- **Deep Link Handling**: Custom protocol `vibespeed://` for OAuth callbacks

## Security Considerations

- Never commit `.env` or private key files
- Tokens are stored encrypted
- Context isolation enabled
- CSP headers configured
- CSRF protection with state parameter

## API Usage Examples

After authentication, the app can:
- List repositories
- Create/update files
- Open issues and pull requests
- Access repository metadata
- Manage webhooks

## Troubleshooting

### "No installations found"
- Install the GitHub App at: https://github.com/apps/YOUR_APP_NAME/installations/new

### Authentication fails
- Verify callback URL matches: `vibespeed://auth-callback`
- Check GitHub App is not suspended
- Ensure private key is valid

### Token errors
- Tokens expire after 1 hour
- App automatically refreshes tokens
- Manual refresh available in UI

### Configuration errors
- **Missing required environment variables**: Check that all required variables are set in `.env`
- **Private key loading fails**: Verify file path exists or base64 encoding is correct
- **Session secret in production**: `SESSION_SECRET` must be set for production deployments
- **Invalid GitHub App credentials**: Verify App ID, Client ID, and Client Secret are correct

## Environment Configuration

### Development vs Production

**Development Environment:**
- Uses `APP_ENV=development`
- `SESSION_SECRET` defaults to a development value if not set
- `APP_DEBUG=true` enables detailed logging
- DevTools open automatically

**Production Environment:**
- Set `APP_ENV=production`
- `SESSION_SECRET` is required and must be a secure random string
- `APP_DEBUG=false` for performance and security
- Generate session secret with: `openssl rand -base64 32`

### Debug Mode
- Enable with `APP_DEBUG=true`
- Provides detailed authentication flow logs
- Shows configuration loading details
- Useful for troubleshooting setup issues

## Development

### File Structure
```
src/
├── main/           # Main process code
│   ├── services/   # Auth, token, GitHub services
│   ├── handlers/   # Deep link handler
│   ├── ipc/        # IPC communication
│   └── config/     # Configuration
├── renderer/       # Renderer process code
│   ├── components/ # React components
│   ├── store/      # Zustand state management
│   └── App.tsx     # Main app component
├── shared/         # Shared types
└── preload.ts      # Preload script
```

### Testing
1. Set `APP_DEBUG=true` in `.env` for debug logs
2. DevTools open automatically in development
3. Check console for auth flow events

## Resources

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [OAuth 2.0 with PKCE](https://oauth.net/2/pkce/)