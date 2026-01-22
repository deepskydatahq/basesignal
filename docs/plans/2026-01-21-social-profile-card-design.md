# Social Profile Card Image Generation Design

## Overview
Generate a shareable PNG image (1200x630) of the product profile for social media sharing - Twitter cards, LinkedIn posts, Slack embeds.

## Problem Statement
Product leaders want to share their P&L progress on social media and in team channels. A link works for detailed viewing, but social platforms display OG images inline. A visually appealing card image makes the share more impactful and professional.

## Expert Perspectives

### Product
The core job is "share achievement → get recognition." The card should feel like a badge of progress, not a data dump. Focus on the transformation: "I built a P&L for my product" rather than listing every metric. The magic moment is seeing your product represented professionally in a shareable format.

### Technical
Server-side generation is the right approach for deterministic rendering across all share contexts. Use satori (JSX to SVG) + resvg-js (SVG to PNG) - both work in serverless environments without native dependencies. On-demand generation keeps it simple; add caching only if performance becomes an issue.

### Simplification Review
**Kept minimal:**
- Single HTTP action endpoint handles everything
- Template defined inline (no separate file needed)
- Standard OG image dimensions (1200x630)
- On-demand generation (no caching complexity)

**Deferred:**
- Caching/storage (add if needed)
- Multiple card styles (one design first)
- Direct social sharing API integration (just download PNG)

## Proposed Solution
Convex HTTP action that generates PNG on-demand. User clicks "Download Card" button, receives PNG file.

## Design Details

### 1. Dependencies
```bash
npm install satori @resvg/resvg-js
```

### 2. HTTP Action Endpoint
**File: `convex/http.ts`**

Add route `/api/profile-card`:
```typescript
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

http.route({
  path: "/api/profile-card",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const data = await request.json();

    // Satori JSX template (inline)
    const svg = await satori(
      <div style={{
        width: 1200,
        height: 630,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        padding: 60,
        fontFamily: 'Inter',
      }}>
        {/* Header: Logo + Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 48, height: 48,
            backgroundColor: '#000',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 24,
            fontWeight: 700,
          }}>B</div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>BASESIGNAL</div>
            <div style={{ fontSize: 14, color: '#666' }}>Outcome-driven product analytics</div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: '#e5e5e5', margin: '24px 0' }} />

        {/* Product Info */}
        <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
          {data.productName}
        </div>
        <div style={{ fontSize: 18, color: '#666', marginBottom: 24 }}>
          {data.description || 'Product P&L Dashboard'}
        </div>

        {/* Journey Stages */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <span style={{ fontSize: 14, color: '#666' }}>Journey:</span>
          {data.stages.map((stage, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 500 }}>{stage}</span>
              {i < data.stages.length - 1 && <span style={{ color: '#ccc' }}>→</span>}
            </div>
          ))}
        </div>

        {/* Stats Badges */}
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{
            padding: '16px 24px',
            backgroundColor: '#f5f5f5',
            borderRadius: 8,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{data.completeness}</div>
            <div style={{ fontSize: 12, color: '#666' }}>Complete</div>
          </div>
          <div style={{
            padding: '16px 24px',
            backgroundColor: '#f5f5f5',
            borderRadius: 8,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{data.metricsCount}</div>
            <div style={{ fontSize: 12, color: '#666' }}>Metrics</div>
          </div>
          <div style={{
            padding: '16px 24px',
            backgroundColor: '#f5f5f5',
            borderRadius: 8,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, fontWeight: 700 }}>{data.entitiesCount}</div>
            <div style={{ fontSize: 12, color: '#666' }}>Entities</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 'auto', fontSize: 14, color: '#999' }}>
          Built with Basesignal · basesignal.net
        </div>
      </div>,
      {
        width: 1200,
        height: 630,
        fonts: [/* Inter font loaded at runtime */],
      }
    );

    const resvg = new Resvg(svg);
    const png = resvg.render().asPng();

    return new Response(png, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="basesignal-profile.png"',
      },
    });
  }),
});
```

### 3. Download Button
**File: `src/components/profile/ProfilePage.tsx`**

Add download button near share button:
```typescript
const handleDownloadCard = async () => {
  setDownloading(true);

  const response = await fetch('/api/profile-card', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productName: profileData.identity.productName,
      description: profileData.identity.description,
      stages: profileData.journey?.stages?.map(s => s.name) || ['Define', 'Track', 'Measure'],
      completeness: `${profileData.completeness.completed}/${profileData.completeness.total}`,
      metricsCount: profileData.stats?.metricsCount || 0,
      entitiesCount: profileData.stats?.entitiesCount || 0,
    }),
  });

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'basesignal-profile.png';
  a.click();
  URL.revokeObjectURL(url);

  setDownloading(false);
};

// In JSX:
<button onClick={handleDownloadCard} disabled={downloading}>
  {downloading ? 'Generating...' : 'Download Card'}
</button>
```

### 4. Font Loading
Satori requires font data. Load Inter font at build time:
```typescript
// In HTTP action
const interFont = await fetch('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700').then(r => r.arrayBuffer());
```

Or bundle font file in `convex/` directory.

## Files to Modify

| File | Change |
|------|--------|
| `package.json` | Add `satori` and `@resvg/resvg-js` dependencies |
| `convex/http.ts` | Add `/api/profile-card` POST endpoint |
| `src/components/profile/ProfilePage.tsx` | Add "Download Card" button |

## Alternatives Considered

1. **Client-side satori** - Rejected: browser rendering inconsistencies, no caching path
2. **Canvas-based rendering** - Rejected: harder to style, less maintainable than JSX
3. **External service (Cloudinary, imgix)** - Rejected: adds dependency, cost, latency

## Success Criteria
- [ ] "Download Card" button visible on ProfilePage
- [ ] Click generates and downloads PNG file
- [ ] Card displays product name, journey, and stats
- [ ] Card renders at 1200x630 (OG image standard)
- [ ] Basesignal branding visible on card
