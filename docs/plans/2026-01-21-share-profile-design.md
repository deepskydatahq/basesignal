# Share Profile Design

## Overview
Add a Share button to product profiles that generates a permanent, copyable link for read-only viewing by stakeholders.

## Problem Statement
Product leaders need to share their P&L dashboard with team members and stakeholders without requiring them to create accounts. The core job is frictionless "share → done" - get stakeholders aligned on numbers immediately.

## Expert Perspectives

### Product
Ship the simplest version first - permanent link with zero configuration friction. Expiration dates, view tracking, and access controls add cognitive load at the moment of sharing. The magic moment is the frictionless sharing experience; add features later based on real usage data.

### Technical
Start minimal to validate whether sharing solves real problems before building control mechanisms. A permanent link is honest about what we're offering. Revocation can be added later as "regenerate token" migration if users request it.

### Simplification Review
**Removed:**
- Separate `ShareModal` component - inline copy interaction is sufficient
- Separate `SharedProfilePage` component - reuse `ProfilePage` with `readOnly` prop
- Complex modal state management in ProfilePage
- `onShare` prop threading through ProfileHeader

**Simplified:**
- Share button lives in ProfilePage directly, not inside ProfileHeader
- Single backend query handles both auth and public token lookup
- Copy feedback via simple tooltip/toast, not modal

## Proposed Solution
Minimal implementation: one schema field, one mutation, one query, one route, inline copy button.

## Design Details

### 1. Schema Change
**File: `convex/schema.ts`**

```typescript
users: defineTable({
  // ... existing fields
  shareToken: v.optional(v.string()),
})
  .index("by_clerk_id", ["clerkId"])
  .index("email", ["email"])
  .index("by_share_token", ["shareToken"]) // New index
```

### 2. Backend Functions
**File: `convex/profile.ts`**

```typescript
// Mutation: Get or create share token (auth required)
export const getOrCreateShareToken = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");

    if (user.shareToken) return user.shareToken;

    const shareToken = crypto.randomUUID().slice(0, 12); // Short token
    await ctx.db.patch(user._id, { shareToken });
    return shareToken;
  },
});

// Query: Get profile by share token (no auth required)
export const getProfileByShareToken = query({
  args: { shareToken: v.string() },
  handler: async (ctx, { shareToken }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_share_token", (q) => q.eq("shareToken", shareToken))
      .first();

    if (!user) return null;

    // Return same shape as getProfileData
    return {
      identity: { /* product name, business type, etc */ },
      metricCatalog: { /* metrics grouped by category */ },
      measurementPlan: { /* entities and activities */ },
      completeness: { /* progress data */ },
    };
  },
});
```

### 3. Route Structure
**File: `src/App.tsx`**

Add public route before auth check:
```typescript
function App() {
  const pathname = window.location.pathname;

  // Public share route - no auth
  if (pathname.startsWith('/p/')) {
    return (
      <Routes>
        <Route path="/p/:shareToken" element={<ProfilePage readOnly />} />
      </Routes>
    );
  }

  // Authenticated routes
  const authState = useAuthGuard();
  // ... existing logic
}
```

### 4. ProfilePage Enhancement
**File: `src/components/profile/ProfilePage.tsx`**

```typescript
interface ProfilePageProps {
  readOnly?: boolean;
}

export function ProfilePage({ readOnly = false }: ProfilePageProps) {
  const { shareToken } = useParams();
  const [copied, setCopied] = useState(false);

  // Use appropriate query based on mode
  const profileData = readOnly
    ? useQuery(api.profile.getProfileByShareToken, { shareToken: shareToken! })
    : useQuery(api.profile.getProfileData);

  const getOrCreateToken = useMutation(api.profile.getOrCreateShareToken);

  const handleShare = async () => {
    const token = await getOrCreateToken();
    const url = `${window.location.origin}/p/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (profileData === undefined) return <Loading />;
  if (profileData === null) return <NotFound />;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {readOnly && (
        <div className="mb-4 bg-gray-50 p-3 rounded text-sm text-gray-600">
          Viewing shared profile for {profileData.identity.productName}
        </div>
      )}

      <ProfileHeader
        identity={profileData.identity}
        completeness={profileData.completeness}
        stats={profileData.stats}
      />

      {/* Share button - owner only */}
      {!readOnly && (
        <button
          onClick={handleShare}
          className="mt-4 text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
        >
          <ShareIcon className="w-4 h-4" />
          {copied ? 'Link copied!' : 'Share profile'}
        </button>
      )}

      {/* Existing sections - pass readOnly to hide edit buttons */}
      <CoreIdentitySection data={profileData.identity} readOnly={readOnly} />
      <MetricCatalogSection metrics={profileData.metricCatalog} readOnly={readOnly} />
      <MeasurementPlanSection plan={profileData.measurementPlan} readOnly={readOnly} />
    </div>
  );
}
```

### 5. Section Components
Add `readOnly` prop to hide edit buttons/CTAs in:
- `CoreIdentitySection`
- `MetricCatalogSection`
- `MeasurementPlanSection`

## Files to Modify

| File | Change |
|------|--------|
| `convex/schema.ts` | Add `shareToken` field + index |
| `convex/profile.ts` | Add `getOrCreateShareToken` mutation + `getProfileByShareToken` query |
| `src/App.tsx` | Add early return for `/p/*` public routes |
| `src/components/profile/ProfilePage.tsx` | Add `readOnly` prop, share button, conditional query |
| Section components | Add `readOnly` prop to hide edit buttons |

**No new files created** - reuse existing components.

## Alternatives Considered

1. **Separate ShareModal component** - Rejected: copy-to-clipboard doesn't warrant modal complexity
2. **Separate SharedProfilePage component** - Rejected: duplicates ProfilePage logic unnecessarily
3. **Share button inside ProfileHeader** - Rejected: adds prop threading; ProfilePage owns the action

## Success Criteria
- [ ] Share button visible on ProfilePage (owner view)
- [ ] Click copies link with "Link copied!" feedback
- [ ] `/p/:token` route shows read-only profile without auth
- [ ] Invalid tokens show "Profile not found"
- [ ] Read-only view hides all edit buttons/CTAs
