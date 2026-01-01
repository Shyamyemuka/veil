# Changelog

All notable changes to the VEIL extension will be documented in this file.

## [1.0.2] - 2026-01-01

### Fixed
- Fixed inconsistent masking visual where long values showed a mix of dotted characters and rectangular overlays
- Mask dots now cover the full length of masked values without any background rectangles

---

## [1.0.1] - 2024-12-30

### Fixed
- Fixed masking range issue where variable names were being masked along with secret values in TypeScript/JavaScript files
- Improved decoration approach to prevent affecting adjacent characters

### Enhanced
- Added support for template literals (backticks) in secret detection
- Added detection for exported constants with sensitive names
- Improved overlap detection for multiple patterns matching same content

## [1.0.0] - 2024-12-29

### Added
- Initial release of VEIL (Visual Environment Information Lock)
- Pattern-based detection for AWS, Google, Stripe, GitHub, Firebase, Supabase keys
- JWT and private key (PEM) detection
- Context-aware detection for sensitive variable names
- Visual masking system with customizable mask character
- Screen Share Mode for safe streaming/recording
- Hover-to-reveal functionality
- Per-secret and per-file toggle controls
- Status bar indicator with secret count
- Custom pattern support via settings
- Keyboard shortcuts for all major actions
