# Software Requirements Specification (SRS)
# VEIL - Visual Environment Information Lock

**Version:** 1.0  
**Date:** December 29, 2024  
**Document Status:** Draft

---

## Table of Contents
1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Features](#3-system-features)
4. [External Interface Requirements](#4-external-interface-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Appendices](#6-appendices)

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) document describes the functional and non-functional requirements for **VEIL** (Visual Environment Information Lock), a VS Code and Antigravity extension designed to detect and visually mask sensitive information such as API keys, tokens, URLs, and other secrets in source code files.

### 1.2 Scope
VEIL is a developer productivity and security tool that:
- Automatically detects sensitive information using pattern-based and context-aware detection
- Visually masks sensitive data without modifying file contents
- Provides screen-sharing mode for safe content streaming/recording
- Allows user-defined custom sensitive data patterns
- Offers per-variable and global mask/unmask controls

### 1.3 Definitions & Acronyms

| Term | Definition |
|------|------------|
| API Key | Application Programming Interface key for authentication |
| JWT | JSON Web Token |
| Masking | Visual overlay hiding actual values without file modification |
| Regex | Regular Expression for pattern matching |
| VEIL | Visual Environment Information Lock (this extension) |

### 1.4 Target Platforms
- Visual Studio Code (v1.85.0+)
- Antigravity (Latest version)

---

## 2. Overall Description

### 2.1 Product Perspective
VEIL operates as an editor extension that intercepts the rendering layer to provide visual masking capabilities. It does not modify source files but instead creates overlay decorations that hide sensitive information from view.

### 2.2 Product Functions (High-Level)

```mermaid
graph TD
    A[Source Code] --> B[Detection Engine]
    B --> C{Pattern Match?}
    C -->|Yes| D[Context Analysis]
    C -->|No| E[Display Normal]
    D --> F{Confirmed Sensitive?}
    F -->|Yes| G[Apply Visual Mask]
    F -->|No| E
    G --> H[User Controls]
    H -->|Toggle| I[Show/Hide]
    H -->|Hover| J[Temporary Reveal]
```

### 2.3 User Classes and Characteristics

| User Class | Description | Technical Level |
|------------|-------------|-----------------|
| Developers | Primary users writing/reviewing code | High |
| Content Creators | Streamers, tutorial makers | Medium |
| Educators | Teachers demonstrating code | Medium-High |
| Security-Conscious Teams | Teams sharing screens in meetings | Varies |

### 2.4 Operating Environment
- **IDE:** VS Code 1.85.0+, Antigravity
- **OS:** Windows, macOS, Linux
- **Languages:** All text-based files supported

### 2.5 Design Constraints
- Must NOT modify file contents
- Must have minimal performance impact (<10ms per file scan)
- Must work offline (no cloud dependencies)
- Must respect user privacy (no data collection)

---

## 3. System Features

### 3.1 Pattern-Based Detection (FR-01)

#### 3.1.1 Description
Core detection engine using regex patterns to identify known sensitive data formats.

#### 3.1.2 Supported Patterns

| Category | Pattern Name | Regex Pattern | Example |
|----------|--------------|---------------|---------|
| **AWS** | Access Key ID | `AKIA[0-9A-Z]{16}` | `AKIAIOSFODNN7EXAMPLE` |
| **AWS** | Secret Access Key | `[A-Za-z0-9/+=]{40}` | (in context of AWS) |
| **Google** | API Key | `AIza[0-9A-Za-z\-_]{35}` | `AIzaSyC...` |
| **Stripe** | Live Key | `sk_live_[0-9a-zA-Z]{24,}` | `sk_live_abc123...` |
| **Stripe** | Test Key | `sk_test_[0-9a-zA-Z]{24,}` | `sk_test_xyz789...` |
| **GitHub** | Personal Access Token | `ghp_[0-9a-zA-Z]{36}` | `ghp_abc123...` |
| **GitHub** | Fine-grained PAT | `github_pat_[0-9a-zA-Z]{22}_[0-9a-zA-Z]{59}` | `github_pat_...` |
| **Firebase** | API Key | `AIza[0-9A-Za-z\-_]{35}` | Same as Google |
| **Firebase** | Project Config | `"apiKey"\s*:\s*"[^"]+"`| JSON config |
| **Supabase** | Anon Key | `eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+` | JWT format |
| **Supabase** | Service Role Key | Same as above (JWT) | JWT format |
| **JWT** | Generic Token | `eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+` | `eyJhbGciOi...` |
| **Generic** | Private Key | `-----BEGIN .* PRIVATE KEY-----` | RSA/EC keys |
| **Generic** | Base64 Secret | `[A-Za-z0-9+/]{32,}={0,2}` | (context-aware) |

#### 3.1.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-01.1 | System SHALL detect AWS access keys matching pattern `AKIA[0-9A-Z]{16}` | High |
| FR-01.2 | System SHALL detect Stripe keys matching patterns `sk_live_*` and `sk_test_*` | High |
| FR-01.3 | System SHALL detect GitHub tokens matching patterns `ghp_*` and `github_pat_*` | High |
| FR-01.4 | System SHALL detect JWTs matching the three-part base64 pattern | High |
| FR-01.5 | System SHALL detect Google/Firebase API keys matching `AIza*` pattern | High |
| FR-01.6 | System SHALL detect private key blocks (PEM format) | High |
| FR-01.7 | System SHALL scan files on open and on content change | High |
| FR-01.8 | System SHALL allow users to add custom patterns | Medium |

---

### 3.2 Context-Aware Detection (FR-02)

#### 3.2.1 Description
Enhanced detection using semantic analysis to reduce false positives and catch secrets that don't match known patterns.

#### 3.2.2 Detection Strategies

**Key Name Detection:**
```
Patterns: API_KEY, SECRET, TOKEN, PASSWORD, CREDENTIALS, AUTH, PRIVATE
Formats: snake_case, camelCase, PascalCase, SCREAMING_SNAKE_CASE
```

**Assignment Pattern Detection:**
```
= (equals assignment)
: (colon assignment in JSON/YAML)
=> (arrow functions with secrets)
```

**File Context Detection:**
| File Type | Detection Behavior |
|-----------|-------------------|
| `.env`, `.env.*` | All key=value pairs scanned |
| `*.json` | Keys containing sensitive keywords scanned |
| `*.yaml`, `*.yml` | Same as JSON |
| `config.*` | Enhanced sensitivity |
| `secrets.*` | All values masked |

#### 3.2.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-02.1 | System SHALL detect variable names containing sensitive keywords | High |
| FR-02.2 | System SHALL recognize assignment operators (=, :, =>) | High |
| FR-02.3 | System SHALL apply enhanced detection in .env files | High |
| FR-02.4 | System SHALL apply enhanced detection in JSON/YAML config files | High |
| FR-02.5 | System SHALL use file path/name as context hint | Medium |
| FR-02.6 | System SHALL combine pattern + context for confidence scoring | Medium |

---

### 3.3 Visual Masking System (FR-03)

#### 3.3.1 Description
Non-destructive visual overlay system that hides sensitive values without modifying source files.

#### 3.3.2 Masking Behaviors

```
Original:  API_KEY="sk_live_EXAMPLE_XXX"
Masked:    API_KEY="••••••••••••••••••••"
           API_KEY="[MASKED]"
           API_KEY="sk_l***************"
```

#### 3.3.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-03.1 | System SHALL overlay mask characters without file modification | Critical |
| FR-03.2 | System SHALL provide global toggle to mask/unmask all secrets | High |
| FR-03.3 | System SHALL provide per-secret toggle to mask/unmask individual items | High |
| FR-03.4 | System SHALL support hover-to-reveal (temporary peek) | Medium |
| FR-03.5 | System SHALL support one-click temporary reveal (5 second default) | Medium |
| FR-03.6 | System SHALL allow customizable mask character (default: •) | Low |
| FR-03.7 | System SHALL show visual indicator for masked content (color/icon) | Medium |
| FR-03.8 | File operations (save, copy, paste) SHALL use original unmasked content | Critical |

---

### 3.4 Screen-Sharing Mode (FR-04)

#### 3.4.1 Description
Special mode for content creators, streamers, and presenters that ensures all sensitive data is hidden during screen sharing.

#### 3.4.2 Screen-Sharing Features

```mermaid
graph LR
    A[Normal Mode] -->|Toggle| B[Screen Share Mode]
    B --> C[All Secrets Masked]
    B --> D[Terminal Output Masked]
    B --> E[URLs Partially Hidden]
    B --> F[Status Bar Indicator]
```

**URL Masking Examples:**
```
Original: https://api.stripe.com/v1/charges
Masked:   https://api.***.com/v1/charges

Original: https://my-secret-project.supabase.co
Masked:   https://*****.supabase.co
```

#### 3.4.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-04.1 | System SHALL provide one-click "Screen Share Mode" toggle | High |
| FR-04.2 | System SHALL instantly mask all detected secrets when mode is enabled | High |
| FR-04.3 | System SHALL mask sensitive terminal output | Medium |
| FR-04.4 | System SHALL partially hide URLs (domain masking) | Medium |
| FR-04.5 | System SHALL show persistent status bar indicator when mode is active | High |
| FR-04.6 | System SHALL provide keyboard shortcut for quick toggle | High |
| FR-04.7 | System SHALL remember screen share mode state across sessions (optional) | Low |

---

### 3.5 User-Defined Sensitive Data (FR-05)

#### 3.5.1 Description
Allow users to define custom patterns, variable names, and specific strings to mask.

#### 3.5.2 Configuration Options

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
    "INTERNAL_TOKEN",
    "PROJECT_ID"
  ],
  "veil.hiddenStrings": [
    "my-specific-project-id",
    "secret-database-name"
  ],
  "veil.filePatterns": [
    "**/secrets/**",
    "**/*.secret.*"
  ]
}
```

#### 3.5.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-05.1 | System SHALL allow users to define custom regex patterns | High |
| FR-05.2 | System SHALL allow users to specify variable names to always hide | High |
| FR-05.3 | System SHALL allow users to specify literal strings to always hide | High |
| FR-05.4 | System SHALL allow users to specify file patterns for enhanced scanning | Medium |
| FR-05.5 | System SHALL support import/export of custom configurations | Low |
| FR-05.6 | System SHALL validate user-provided regex patterns | Medium |

---

### 3.6 Toggle Controls (FR-06)

#### 3.6.1 Description
Comprehensive toggle system for flexible control over masking behavior.

#### 3.6.2 Toggle Hierarchy

```
Global Toggle (Master)
    └── File Toggle
        └── Individual Secret Toggle
```

#### 3.6.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-06.1 | System SHALL provide master on/off toggle for entire extension | High |
| FR-06.2 | System SHALL provide file-level toggle to mask/unmask all secrets in current file | High |
| FR-06.3 | System SHALL provide per-secret inline toggle (gutter icon or inline action) | High |
| FR-06.4 | System SHALL respect toggle hierarchy (master overrides file, file overrides individual) | High |
| FR-06.5 | System SHALL persist toggle states within session | Medium |
| FR-06.6 | System SHALL optionally persist toggle states across sessions | Low |

---

## 4. External Interface Requirements

### 4.1 User Interface

#### 4.1.1 Status Bar
- Extension status indicator (enabled/disabled)
- Screen Share Mode indicator
- Secret count badge
- Quick toggle button

#### 4.1.2 Command Palette Commands

| Command | Description | Keybinding |
|---------|-------------|------------|
| `VEIL: Toggle Extension` | Enable/disable VEIL | `Ctrl+Shift+V` |
| `VEIL: Toggle Screen Share Mode` | Enable/disable screen share mode | `Ctrl+Shift+S` |
| `VEIL: Reveal All Secrets` | Temporarily show all secrets | `Ctrl+Shift+R` |
| `VEIL: Mask All Secrets` | Re-mask all secrets | `Ctrl+Shift+M` |
| `VEIL: Toggle Current File` | Toggle masking for current file | `Ctrl+Shift+F` |
| `VEIL: Open Settings` | Open VEIL settings | - |
| `VEIL: Add Custom Pattern` | Quick add custom pattern | - |

#### 4.1.3 Editor Decorations

```
┌─────────────────────────────────────────────────┐
│ 1  │ const API_KEY = "••••••••••••••••" 👁      │
│ 2  │ const url = "https://*****.api.com"        │
│ 3  │ // Normal code here                        │
│ 4  │ const TOKEN = "••••••••••••••••••" 👁      │
└─────────────────────────────────────────────────┘
     Gutter icons  →  [👁] Click to reveal/hide
     Inline badge  →  Masked indicator
```

#### 4.1.4 Settings UI

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `veil.enabled` | boolean | true | Enable/disable extension |
| `veil.screenShareMode` | boolean | false | Screen share mode state |
| `veil.maskCharacter` | string | "•" | Character used for masking |
| `veil.hoverToReveal` | boolean | true | Show secret on hover |
| `veil.revealDuration` | number | 5000 | Temp reveal duration (ms) |
| `veil.maskUrls` | boolean | true | Mask URL domains |
| `veil.customPatterns` | array | [] | User-defined patterns |
| `veil.hiddenVariables` | array | [] | Variables to always hide |
| `veil.hiddenStrings` | array | [] | Strings to always hide |

---

### 4.2 Software Interfaces

#### 4.2.1 VS Code Extension API
- `vscode.window.createTextEditorDecorationType` - Visual masking
- `vscode.workspace.onDidChangeTextDocument` - Real-time detection
- `vscode.workspace.getConfiguration` - Settings management
- `vscode.commands.registerCommand` - Command registration
- `vscode.window.createStatusBarItem` - Status bar integration

#### 4.2.2 File System
- Read-only access to workspace files for scanning
- No file modifications for masking
- Configuration file storage in VS Code settings

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | File scan time for files < 1000 lines | < 50ms |
| NFR-02 | File scan time for files < 10000 lines | < 200ms |
| NFR-03 | Memory overhead per file | < 5MB |
| NFR-04 | Extension activation time | < 100ms |
| NFR-05 | Real-time update latency (on type) | < 100ms |

### 5.2 Security

| ID | Requirement |
|----|-------------|
| NFR-06 | Extension SHALL NOT transmit any file content externally |
| NFR-07 | Extension SHALL NOT log sensitive values |
| NFR-08 | Extension SHALL NOT store unencrypted secrets |
| NFR-09 | Extension SHALL work completely offline |

### 5.3 Reliability

| ID | Requirement |
|----|-------------|
| NFR-10 | Extension SHALL NOT crash editor on malformed input |
| NFR-11 | Extension SHALL gracefully handle very large files |
| NFR-12 | Extension SHALL recover from internal errors without data loss |

### 5.4 Usability

| ID | Requirement |
|----|-------------|
| NFR-13 | All features SHALL be accessible via keyboard shortcuts |
| NFR-14 | Extension SHALL provide clear visual feedback for all states |
| NFR-15 | Settings SHALL have descriptive labels and examples |

### 5.5 Compatibility

| ID | Requirement |
|----|-------------|
| NFR-16 | Extension SHALL support VS Code 1.85.0 and later |
| NFR-17 | Extension SHALL support Windows, macOS, and Linux |
| NFR-18 | Extension SHALL not conflict with popular extensions |

---

## 6. Appendices

### 6.1 Appendix A: Sample Detection Scenarios

#### Scenario 1: .env File
```env
# Input
DATABASE_URL=postgres://user:password@localhost:5432/db
API_KEY=sk_live_EXAMPLE_XXX
JWT_SECRET=mysupersecretkey

# Output (Masked)
DATABASE_URL=••••••••••••••••••••••••••••••••••••••
API_KEY=••••••••••••••••••••
JWT_SECRET=••••••••••••••••••
```

#### Scenario 2: JavaScript Config
```javascript
// Input
const config = {
  apiKey: "AIzaSyC123abc456def789",
  stripeKey: "sk_live_abc123xyz",
  normalValue: "hello world"
};

// Output (Masked)
const config = {
  apiKey: "••••••••••••••••••••••",
  stripeKey: "••••••••••••••••",
  normalValue: "hello world"  // Not masked - not sensitive
};
```

#### Scenario 3: URL Masking (Screen Share Mode)
```javascript
// Input
const apiUrl = "https://api.mycompany.com/v1/users";
const dbUrl = "postgres://admin:secret@db.internal.com:5432";

// Output (Screen Share Mode)
const apiUrl = "https://api.***.com/v1/users";
const dbUrl = "postgres://***:***@***.***.com:5432";
```

### 6.2 Appendix B: Keyboard Shortcuts

| Action | Windows/Linux | macOS |
|--------|---------------|-------|
| Toggle Extension | `Ctrl+Shift+V` | `Cmd+Shift+V` |
| Toggle Screen Share | `Ctrl+Shift+S` | `Cmd+Shift+S` |
| Reveal All | `Ctrl+Shift+R` | `Cmd+Shift+R` |
| Mask All | `Ctrl+Shift+M` | `Cmd+Shift+M` |
| Toggle File | `Ctrl+Shift+F` | `Cmd+Shift+F` |

### 6.3 Appendix C: Extension Architecture

```mermaid
graph TB
    subgraph Extension
        A[Extension Entry] --> B[Activation]
        B --> C[Detection Engine]
        B --> D[Masking Engine]
        B --> E[Settings Manager]
        B --> F[Command Handler]
        
        C --> C1[Pattern Matcher]
        C --> C2[Context Analyzer]
        C --> C3[Custom Rules]
        
        D --> D1[Decoration Provider]
        D --> D2[Toggle Manager]
        D --> D3[Hover Provider]
        
        F --> F1[Toggle Commands]
        F --> F2[Reveal Commands]
        F --> F3[Config Commands]
    end
    
    subgraph VS Code
        G[Editor] --> D1
        H[Settings] --> E
        I[Commands] --> F
    end
```

---

## Document Approval

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author | VEIL Development Team | | 2024-12-29 |
| Reviewer | | | |
| Approver | | | |

---

*End of Software Requirements Specification*
