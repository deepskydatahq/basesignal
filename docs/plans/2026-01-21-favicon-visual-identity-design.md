# Website Visual Identity Design

## Overview
Add visual product identity to ProfileHeader using the product's website favicon instead of the originally proposed screenshot capture.

## Problem Statement
Users want their product profile to have visual identity that connects to their brand. The original request was for website screenshots, but expert analysis revealed this adds significant infrastructure complexity for marginal value.

## Expert Perspectives

### Product (Butterfield-style)
- The real magic moment is users defining their P&L metrics, not seeing visual polish
- Favicon achieves 80% of visual identity value at 10% of complexity
- Don't burn engineering on screenshot APIs when a free, reliable solution exists
- Focus on the transformation (understanding product performance), not the decoration

### Technical (Abramov-style)
- Screenshot services add API complexity, failure modes, and caching infrastructure
- Favicon via Google's service is free, instant, and handles caching automatically
- Store nothing extra - just use the existing `websiteUrl` field to derive the favicon URL
- The best API is the one you don't need to build

### Simplification Review (Jobs-style)
- **Removed**: Separate `ProductAvatar` component abstraction - inline the logic
- **Removed**: Dedicated `src/lib/url.ts` file - inline the 4-line function
- **Simplified**: Error handling - no explicit state tracking needed, just fallback on error
- **Simplified**: Props structure - use existing ProfileHeader props, don't create intermediate types

## Proposed Solution

Add favicon display to the existing avatar in ProfileHeader with fallback to the current initial-based avatar.

**Favicon URL pattern:**
```
https://www.google.com/s2/favicons?domain={domain}&sz=128
```

**Implementation approach:**
1. Inline domain extraction in ProfileHeader
2. Render `<img>` with favicon URL when `websiteUrl` exists
3. Fall back to initial avatar on any error
4. No new files, no new components, no state management

## Design Details

### Changes to ProfileHeader.tsx

Add to existing avatar rendering logic:

```typescript
// Inside ProfileHeader component
const domain = identity.websiteUrl
  ? (() => {
      try {
        const url = identity.websiteUrl.startsWith('http')
          ? identity.websiteUrl
          : `https://${identity.websiteUrl}`;
        return new URL(url).hostname;
      } catch { return null; }
    })()
  : null;

const faviconUrl = domain
  ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
  : null;

// In JSX - replace existing avatar div with:
{faviconUrl ? (
  <img
    src={faviconUrl}
    alt={`${identity.productName} logo`}
    className="flex-shrink-0 w-12 h-12 rounded-full object-cover"
    onError={(e) => { e.currentTarget.style.display = 'none'; }}
  />
) : null}
{/* Existing initial avatar as fallback - always render but hide when favicon loads */}
<div
  aria-label="Product avatar"
  className={cn(
    "flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white text-xl font-semibold",
    faviconUrl && "hidden" // Hide when favicon is showing
  )}
  style={{ backgroundColor }}
>
  {initial}
</div>
```

### Changes to ProfilePage.tsx

Pass `websiteUrl` from profile data (already available in schema):

```typescript
const identity = {
  productName: profile.productName,
  productDescription: profile.productDescription,
  websiteUrl: profile.websiteUrl,  // Add this line
  // ... rest unchanged
};
```

### Files Modified

1. `src/components/profile/ProfileHeader.tsx` - Add favicon logic to existing avatar
2. `src/components/profile/ProfilePage.tsx` - Wire websiteUrl prop

### Tests

Add to existing ProfileHeader tests:
- Renders initial avatar when no websiteUrl
- Renders favicon img when websiteUrl provided
- Shows initial avatar as fallback (always present in DOM)

## Alternatives Considered

| Approach | Pros | Cons | Decision |
|----------|------|------|----------|
| **Favicon (chosen)** | Free, instant, no API keys, graceful fallback, no infrastructure | Lower visual impact than screenshot | **Selected** - right trade-off for MVP |
| Screenshot API | Rich visual preview | $5-50/mo cost, API complexity, failure modes, caching infrastructure | Rejected - too complex for MVP |
| Server-side Puppeteer | Full control | Huge complexity, cold starts, memory/timeout issues in serverless | Rejected - overkill |

## Success Criteria

1. User with `websiteUrl` sees their product's favicon in header
2. User without `websiteUrl` sees initial-based avatar (current behavior preserved)
3. Invalid URLs or failed favicon loads gracefully fall back to initial
4. No new API costs or infrastructure dependencies
5. Implementation is < 50 lines of changes total
