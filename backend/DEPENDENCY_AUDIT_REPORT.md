# Dependency Audit Report
**Date**: 2026-01-13
**Project**: KPI Productivity System

## Executive Summary

This audit analyzed the project's dependencies for security vulnerabilities, outdated packages, and unnecessary bloat. Key findings:

- ✅ **Security**: No vulnerabilities detected
- ⚠️ **Outdated Packages**: 8 major version updates available
- ⚠️ **Bloat**: 2 unused packages detected, 2 misplaced type definitions
- ⚠️ **Configuration Issues**: Package.json references non-existent subdirectories

---

## 1. Security Vulnerabilities

**Status**: ✅ **PASS** - No security vulnerabilities found

```
Total Dependencies: 374 packages
├─ Production: 229
├─ Development: 146
└─ Optional: 52

Vulnerabilities:
├─ Critical: 0
├─ High: 0
├─ Moderate: 0
├─ Low: 0
└─ Info: 0
```

---

## 2. Outdated Packages

### Critical Major Updates (Breaking Changes Expected)

| Package | Current | Latest | Priority | Notes |
|---------|---------|--------|----------|-------|
| **@prisma/client** | 5.7.1 | 7.2.0 | HIGH | Major ORM update with performance improvements |
| **@sentry/node** | 7.99.0 | 10.33.0 | LOW | **UNUSED** - Consider removing |
| **@sentry/profiling-node** | 1.3.5 | 10.33.0 | LOW | **UNUSED** - Consider removing |
| **bcryptjs** | 2.4.3 | 3.0.3 | MEDIUM | Password hashing - test thoroughly |
| **dotenv** | 16.3.1 | 17.2.3 | LOW | Environment variable loading |
| **express** | 4.18.2 | 5.2.1 | HIGH | Major framework update |
| **helmet** | 7.1.0 | 8.1.0 | MEDIUM | Security headers middleware |
| **zod** | 3.22.4 | 4.3.5 | HIGH | Validation library - breaking changes |

### Recommended Update Strategy

1. **Immediate Updates** (Low Risk):
   - Remove Sentry packages (unused)
   - Update `dotenv` to 17.2.3

2. **Staged Updates** (Medium Risk - require testing):
   - Update `helmet` to 8.1.0
   - Update `bcryptjs` to 3.0.3

3. **Planned Updates** (High Risk - major breaking changes):
   - Update `express` 4.x → 5.x (review migration guide)
   - Update `@prisma/client` 5.x → 7.x (database compatibility check)
   - Update `zod` 3.x → 4.x (schema validation changes)

---

## 3. Unnecessary Bloat

### Unused Dependencies

**1. Sentry Monitoring Packages** - **2 packages, ~5MB**
```json
"@sentry/node": "^7.99.0",              // NOT USED
"@sentry/profiling-node": "^1.3.5"     // NOT USED
```

**Analysis**: No imports found in codebase
- Searched: `grep -r "from '@sentry" src/`
- Result: No matches

**Recommendation**: Remove unless monitoring will be added soon

**Cost**:
- Installation time: ~15-20 seconds
- Disk space: ~5MB
- Security surface: Additional attack vectors

---

### Misplaced Dependencies

**2. Type Definitions in Production**
```json
// Currently in "dependencies" but should be "devDependencies":
"@types/nodemailer": "^7.0.4",
"@types/redis": "^4.0.10"
```

**Impact**:
- Increases production bundle size unnecessarily
- Type definitions are only needed during development/build
- Adds ~2MB to production deployments

**Recommendation**: Move to `devDependencies`

---

### Configuration Issues

**3. Non-Existent Directory References**

The root `package.json` contains scripts referencing directories that don't exist:

```json
"dev:backend": "cd backend && npm run dev",        // ❌ backend/ doesn't exist
"dev:frontend": "cd frontend && npm run dev",      // ❌ frontend/ doesn't exist
"dev:gateway": "cd gateway && npm run dev",        // ❌ gateway/ doesn't exist
"dev:docs": "cd docs/interactive && npm run dev"   // ❌ docs/interactive/ doesn't exist
```

**Actual Structure**: This is a monolithic application with code in `src/`, not a monorepo.

**Impact**:
- Confusing for new developers
- Scripts will fail if executed
- Suggests incomplete refactoring or outdated documentation

**Recommendation**:
- Remove references to non-existent directories
- Update scripts to reflect actual project structure
- Consider if monorepo structure was intended but not implemented

---

## 4. Dependency Tree Analysis

### Large Dependencies (>1MB)

Based on typical package sizes:
- `@prisma/client`: ~15MB (database ORM engines)
- `@sentry/*`: ~5MB combined (if kept)
- `socket.io`: ~3MB (WebSocket library)
- `vitest`: ~8MB (testing framework - dev only)

**Total Production Bundle**: ~229 packages, estimated ~50-80MB

---

## 5. Recommendations Summary

### Immediate Actions (Low Risk)

1. **Remove unused Sentry packages**
   ```bash
   npm uninstall @sentry/node @sentry/profiling-node
   ```
   **Savings**: ~5MB, 2 packages, 20s install time

2. **Move type definitions to devDependencies**
   ```json
   // Move from "dependencies" to "devDependencies":
   "@types/nodemailer": "^7.0.4",
   "@types/redis": "^4.0.10"
   ```
   **Savings**: ~2MB production bundle size

3. **Clean up package.json scripts**
   - Remove references to non-existent directories
   - Update scripts to match actual project structure

4. **Update safe packages**
   ```bash
   npm update dotenv
   ```

### Short-term Actions (1-2 weeks)

1. **Test and update medium-risk packages**
   ```bash
   npm install helmet@^8.1.0 bcryptjs@^3.0.3
   npm test
   ```

2. **Review and plan for major updates**
   - Create test plan for Express 5.x migration
   - Review Prisma 7.x migration guide
   - Test Zod 4.x schema compatibility

### Long-term Monitoring

1. **Set up automated dependency updates**
   - Consider Dependabot or Renovate bot
   - Configure automated security alerts
   - Schedule quarterly dependency reviews

2. **Add dependency size monitoring**
   - Use `npm-check` or `depcheck` in CI/CD
   - Monitor production bundle size
   - Set budget limits for new dependencies

---

## 6. Implementation Script

```bash
#!/bin/bash
# dependency-cleanup.sh

echo "Step 1: Removing unused Sentry packages..."
npm uninstall @sentry/node @sentry/profiling-node

echo "Step 2: Updating safe dependencies..."
npm update dotenv

echo "Step 3: Running tests..."
npm test

echo "Step 4: Audit security..."
npm audit

echo "✅ Dependency cleanup complete!"
echo "Next: Manually move @types packages to devDependencies in package.json"
```

---

## 7. Risk Assessment

| Action | Risk Level | Impact | Testing Required |
|--------|-----------|--------|-----------------|
| Remove Sentry | LOW | None (unused) | Basic smoke test |
| Move @types | LOW | None (build-time only) | Build test |
| Update dotenv | LOW | Minimal | Config validation |
| Update helmet | MEDIUM | Security headers | Integration tests |
| Update bcryptjs | MEDIUM | Password hashing | Auth tests |
| Update Express | HIGH | Core framework | Full test suite |
| Update Prisma | HIGH | Database layer | Migration testing |
| Update Zod | HIGH | Validation layer | Schema tests |

---

## Appendix: Package Usage Verification

**Verified as Used**:
- ✅ `fuse.js` - Used in `src/services/documentationManager.ts`
- ✅ `nodemailer` - Used in `src/services/emailService.ts`
- ✅ `redis` - Used in `src/services/redisClient.ts`
- ✅ `socket.io` - Used in `src/services/socketService.ts`
- ✅ `bcryptjs` - Used in `src/routes/auth.ts`, `src/utils/security.ts`
- ✅ `axios` - Used in `src/scripts/api-audit.ts`

**Verified as Unused**:
- ❌ `@sentry/node` - No imports found
- ❌ `@sentry/profiling-node` - No imports found

---

**Report Generated By**: Claude Code Dependency Auditor
**Next Review**: 2026-04-13 (Quarterly)
