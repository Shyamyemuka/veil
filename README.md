# VEIL - Visual Environment Information Lock

🔒 **Automatically detect and mask sensitive information in your code — without modifying files.**

![VEIL Extension](images/banner.png)

## Features

### 🎯 Pattern-Based Detection
Automatically detects known secret formats:
- **AWS** - Access Keys (`AKIA...`)
- **Stripe** - Live & Test Keys (`sk_live_...`, `sk_test_...`)
- **GitHub** - Personal Access Tokens (`ghp_...`, `github_pat_...`)
- **Google/Firebase** - API Keys (`AIza...`)
- **JWT** - JSON Web Tokens
- **Private Keys** - RSA, EC, SSH keys
- **And many more...**

### 🧠 Context-Aware Detection
Goes beyond regex with intelligent analysis:
- Recognizes sensitive variable names (`API_KEY`, `SECRET`, `TOKEN`, etc.)
- Understands assignment patterns (`=`, `:`, `=>`)
- File type awareness (`.env`, `.json`, `.yaml`, config files)

### 👁️ Visual Masking
Non-destructive protection for your secrets:
- Overlay masking with `••••••••` - file contents remain unchanged
- **Per-secret toggle** - click the gutter icon to reveal/hide individual secrets
- **File-level toggle** - show/hide all secrets in current file
- **Hover to peek** - see obfuscated preview on hover
- **Temporary reveal** - auto-hide after 5 seconds

### 📺 Screen Share Mode
Perfect for streamers, educators, and presenters:
- **One-click activation** - `Ctrl+Shift+S`
- Instantly masks ALL secrets
- Partial URL hiding (`https://api.***.com`)
- Persistent status bar indicator 🔴

### ⚙️ User-Defined Rules
Customize detection for your needs:
- Add custom regex patterns
- Specify variable names to always hide
- Define literal strings to mask
- Import/export configurations

## Installation

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "VEIL"
4. Click Install

## Usage

### Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Toggle VEIL | `Ctrl+Shift+V` | `Cmd+Shift+V` |
| Screen Share Mode | `Ctrl+Shift+S` | `Cmd+Shift+S` |
| Reveal All | `Ctrl+Shift+R` | `Cmd+Shift+R` |
| Mask All | `Ctrl+Shift+M` | `Cmd+Shift+M` |
| Toggle File | `Ctrl+Shift+F` | `Cmd+Shift+F` |
| Toggle Secret at Cursor | `Ctrl+.` | `Cmd+.` |

### Status Bar

The status bar shows:
- 🛡️ VEIL status and secret count
- 🔴 **LIVE** indicator when Screen Share Mode is active

Click the status bar item to toggle VEIL on/off.

### Toggle Icons

Each detected secret shows indicators:
- 👁 **Eye icon** at end of masked value - indicates hidden secret
- 🔓 **Unlock icon** at end of revealed value - indicates visible secret
- Gutter icons show mask state per line

**To toggle:** Place cursor on line with secret → Press `Ctrl+.` (or `Cmd+.` on Mac)

## Configuration

Open Settings → Extensions → VEIL

| Setting | Default | Description |
|---------|---------|-------------|
| `veil.enabled` | `true` | Enable/disable VEIL |
| `veil.maskCharacter` | `•` | Character used for masking |
| `veil.hoverToReveal` | `true` | Show preview on hover |
| `veil.revealDuration` | `5000` | Temp reveal duration (ms) |
| `veil.maskUrls` | `true` | Mask URL domains in Screen Share |
| `veil.customPatterns` | `[]` | Custom regex patterns |
| `veil.hiddenVariables` | `[]` | Variables to always mask |
| `veil.hiddenStrings` | `[]` | Strings to always mask |

### Custom Patterns Example

```json
{
  "veil.customPatterns": [
    {
      "name": "Internal API",
      "pattern": "internal_api_[a-z0-9]{32}",
      "description": "Company internal API keys"
    }
  ],
  "veil.hiddenVariables": [
    "MY_CUSTOM_SECRET",
    "PROJECT_ID"
  ],
  "veil.hiddenStrings": [
    "my-secret-project-name"
  ]
}
```

## Requirements

- VS Code 1.85.0 or later

## Privacy

VEIL is designed with privacy in mind:
- ✅ Works completely offline
- ✅ No data collection
- ✅ No external requests
- ✅ Files are never modified

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

---

**Made with 🔐 by the VEIL Team**
