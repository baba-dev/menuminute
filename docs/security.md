# MenuMinute — Security & Authorization Architecture

## 1. Security Model Overview

MenuMinute adheres to strict defense-in-depth security principles across authentication, session management, input validation, and multi-tenant isolation.

---

## 2. Authentication & Authorization

- **Session Security**: NextAuth v5 JWT sessions encrypted and signed with HMAC SHA-256 via `AUTH_SECRET`.
- **Password Hashing**: Strong one-way password hashing using `bcryptjs` with salt rounds set to 12.
- **Server-Side Enforcement**: Authorization checks are performed on the server inside services and route handlers; UI components are not relied upon for security boundaries.
- **Role Hierarchy**:
  - `owner`: Full administrative rights, billing management, deletion.
  - `manager`: Menu and staff management.
  - `staff`: Order viewing and status updates.
  - `kitchen`: Kitchen Display System interface access.

---

## 3. Multi-Tenant Isolation

Every database query in the data access layer (`src/modules/*`) strictly scopes records by the authenticated user's `restaurantId`:

```typescript
// Enforces tenant isolation
export function getMenuItemsByCategory(categoryId: string, restaurantId: string): MenuItem[] {
  return db
    .select()
    .from(menuItems)
    .where(
      and(
        eq(menuItems.categoryId, categoryId),
        eq(menuItems.restaurantId, restaurantId) // Tenant boundary
      )
    )
    .all();
}
```

Direct object references (IDOR vulnerabilities) are prevented by verifying that the requesting session belongs to the tenant owning the resource.

---

## 4. Input Validation & Sanitization

- All API inputs are strictly parsed using **Zod** schemas before execution.
- Extraneous fields are stripped automatically.
- Prices are validated as non-negative and converted directly to integer minor units (paise) to prevent fractional manipulation.

---

## 5. Security Headers (Configured in `next.config.ts`)

- `X-Frame-Options: DENY` (prevents clickjacking)
- `X-Content-Type-Options: nosniff` (prevents MIME sniffing)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (enforces HTTPS)
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## 6. Safe Error Handling

Errors returned to clients never leak database stack traces, file paths, or private configuration. In production, unhandled exceptions return a standardized payload:

```json
{
  "message": "An unexpected error occurred"
}
```

Validation errors provide structured field error maps without exposing internal internals.
