# ProductsListPage & Routing Design

## Overview
Create a ProductsListPage that replaces ProfilePage as the dashboard home route. Product cards show name, URL, completeness, and data-availability badges. Update App.tsx routing and Sidebar active-state logic.

## Problem Statement
Users need a product list as their landing page to navigate between products and see at-a-glance status (completeness, available data). The current home route shows a single ProfilePage which doesn't support multi-product navigation.

## Expert Perspectives

### Technical
- Use `<Link>` directly for card navigation — no conditional disabled logic for routes that don't exist yet. This is a deployment concern, not a design concern.
- Use simple `Math.round(completeness * 100) + '%'` text for completeness — no progress bars. Keep the list view fast and scannable; richer visuals belong on the profile detail page.
- Follow JourneysListPage pattern exactly: useQuery at top, loading check, empty state, list render.

### Simplification Review
- Inline the empty state — don't extract a separate EmptyState component for 2 lines of text.
- Keep only ProductCard as a local extracted component.
- ProductProfilePage skeleton is kept minimal (required by acceptance criteria for the route to resolve).
- Test scope: 4-5 focused tests covering critical paths.

## Proposed Solution

### 1. `src/routes/ProductsListPage.tsx` (Create)

Single default export `ProductsListPage` with one local `ProductCard` component.

- `useQuery(api.products.listWithProfiles)` for data
- Loading state: centered "Loading..." (matches JourneysListPage)
- Empty state: inline "No products yet" message
- Product cards: white bordered card, shows name + URL on left, badges + completeness on right
- Completeness: `Math.round(completeness * 100) + '%'` text
- Badges: purple "Convergence" pill when hasConvergence, green "Outputs" pill when hasOutputs
- Each card is a `<Link to={/products/${product._id}}>`

### 2. `src/routes/ProductProfilePage.tsx` (Create — minimal skeleton)

3-line placeholder so `/products/:productId` route resolves. Will be replaced by M005-E002-S001.

### 3. `src/App.tsx` (Modify)

- Import ProductsListPage and ProductProfilePage
- Replace `<Route index element={<ProfilePage />} />` with `<Route index element={<ProductsListPage />} />`
- Add `<Route path="products/:productId" element={<ProductProfilePage />} />`
- Keep ProfilePage import for `/p/:shareToken` public share route

### 4. `src/components/Sidebar.tsx` (Modify)

Change isActive for Home nav item:
```
location.pathname === '/' || location.pathname.startsWith('/products')
```

### 5. `src/routes/ProductsListPage.test.tsx` (Create)

~5 focused tests: loading state, renders cards with name/URL, completeness percentage, badges conditional, empty state, card links.

## Files Touched

| File | Action |
|------|--------|
| `src/routes/ProductsListPage.tsx` | Create |
| `src/routes/ProductsListPage.test.tsx` | Create |
| `src/routes/ProductProfilePage.tsx` | Create (skeleton) |
| `src/App.tsx` | Modify |
| `src/components/Sidebar.tsx` | Modify (1 line) |

## Alternatives Considered
- **Progress bar for completeness**: Rejected — text percentage is pattern-consistent and keeps list scannable.
- **Disabled cards when profile page doesn't exist**: Rejected — link should work, route just needs a skeleton.
- **Separate EmptyState component**: Rejected — over-componentized for 2 lines of text.

## Success Criteria
- Home route shows product cards with correct data
- Cards link to /products/:productId
- Sidebar highlights Home on both / and /products/* paths
- Empty state renders when no products exist
- Tests pass
