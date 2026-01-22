# PDF Export Design

## Overview

Add a single-click PDF export feature to the product profile page. Users click "Export PDF" in ProfileHeader and the browser downloads a PDF of their complete profile.

## Problem Statement

Users need to share their product profile outside the app - with stakeholders, in documents, or for offline reference. A PDF export provides a portable, professional format for this.

## Expert Perspectives

### Product
- The job is sharing, not configuring. One click to download - no modal, no options.
- Export button visibility can serve as a completion signal, but don't over-gate it.
- Text-based journey representation is more professional for business documents than UI screenshots.

### Technical
- Client-side html2pdf.js avoids server infrastructure complexity.
- Direct download flow (no modal) = fewer components, fewer states, fewer edge cases.
- PDF generation is a one-off transformation, not an interactive subsystem - treat it accordingly.

### Simplification Review
- **Cut**: Separate utility file for content check (inline the check)
- **Cut**: 4 separate PDF section components (use HTML template in generation function)
- **Cut**: `sections` parameter for future flexibility (build when needed)
- **Cut**: "Generating..." loading state (html2pdf is fast enough)
- **Cut**: PdfProfileContent wrapper component (unnecessary indirection)

Final file count: 3 files instead of originally proposed 10.

## Proposed Solution

### User Flow
1. User views their profile in ProfilePage
2. User clicks "Export PDF" button in ProfileHeader
3. Browser generates PDF client-side and triggers download
4. File named `{product-name}-profile.pdf` saves to downloads

### Architecture
```
ProfileHeader
    └── ExportPdfButton (click handler)
            └── generateProfilePdf(profileData)
                    └── html2pdf.js → download
```

## Design Details

### ExportPdfButton Component
**Location**: `src/components/profile/ExportPdfButton.tsx`

```typescript
interface ExportPdfButtonProps {
  profileData: ProfileData
}
```

Simple button that calls `generateProfilePdf()` on click. No loading state - html2pdf is synchronous and fast.

### generateProfilePdf Function
**Location**: `src/lib/pdf/generateProfilePdf.ts`

Single function that:
1. Builds HTML string from profile data using inline template
2. Configures html2pdf.js options (margins, page breaks)
3. Triggers download with filename `{productName}-profile.pdf`

HTML template includes:
- Profile header (name, tagline)
- Core identity section
- Journey map as styled HTML table (stages with activities)
- Metric catalog organized by P&L category
- Measurement plan overview

### PDF Layout
```
┌─────────────────────────────────────┐
│  Product Name                       │
│  Tagline                            │
├─────────────────────────────────────┤
│  CORE IDENTITY                      │
│  Problem, users, value props        │
├─────────────────────────────────────┤
│  JOURNEY MAP                        │
│  Stage → Activities table           │
├─────────────────────────────────────┤
│  METRIC CATALOG                     │
│  P&L categories with metrics        │
├─────────────────────────────────────┤
│  MEASUREMENT PLAN                   │
│  Data sources, measurements         │
└─────────────────────────────────────┘
```

### Integration in ProfileHeader
Add ExportPdfButton to ProfileHeader.tsx, positioned near other action buttons.

## File Changes

| File | Change |
|------|--------|
| `package.json` | Add html2pdf.js dependency |
| `src/components/profile/ExportPdfButton.tsx` | Create - button component |
| `src/lib/pdf/generateProfilePdf.ts` | Create - generation function with HTML template |
| `src/components/profile/ProfileHeader.tsx` | Modify - add export button |

## Alternatives Considered

1. **Server-side Puppeteer** - Rejected: adds infrastructure complexity for no user benefit
2. **Modal with section toggles** - Rejected: adds friction without value for v1
3. **Separate PDF component hierarchy** - Rejected: over-engineers a simple transformation

## Success Criteria

- [ ] Export button visible in ProfileHeader
- [ ] Single click triggers PDF download
- [ ] PDF includes all profile sections as readable text
- [ ] Journey map rendered as structured table (not screenshot)
- [ ] PDF filename includes product name
