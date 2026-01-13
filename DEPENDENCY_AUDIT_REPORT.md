# Dependency Audit Report
**Date:** 2026-01-13
**Project:** KPI Productivity System

## Executive Summary

This audit analyzed dependencies across 5 packages (root, backend, frontend, gateway, and docs/interactive) and identified:

- **14 security vulnerabilities** (all moderate severity)
- **Multiple outdated packages** with available major version updates
- **2 missing package-lock.json files** (root & frontend)
- **Several opportunities** for dependency optimization

---

## 🔴 Critical Issues

### 1. Missing Package Lock Files

**Issue:** Root and frontend packages lack `package-lock.json` files.

**Impact:**
- Inconsistent dependency versions across environments
- Unpredictable builds
- Difficulty reproducing bugs
- Security audit cannot run without lockfiles

**Recommendation:**
```bash
# Root directory
npm install --package-lock-only

# Frontend directory
cd frontend && npm install --package-lock-only
```

---

## 🟠 Security Vulnerabilities

### Backend (5 moderate vulnerabilities)

| Package | Severity | Issue | Fix |
|---------|----------|-------|-----|
| `esbuild` | Moderate | CVE: Unauthorized request access to dev server (GHSA-67mh-4wv8-2f99) | Update vitest to v4.0.17+ |
| `vitest` | Moderate | Via vite/vite-node dependencies | Update to v4.0.17+ |
| `@vitest/coverage-v8` | Moderate | Via vitest dependency | Update to v4.0.17+ |

**Fix Command:**
```bash
cd backend
npm install vitest@^4.0.17 @vitest/coverage-v8@^4.0.17 --save-dev
```

### Gateway (4 moderate vulnerabilities)

| Package | Severity | Issue | Fix |
|---------|----------|-------|-----|
| `esbuild` | Moderate | Same as backend | Update vitest to v4.0.17+ |
| `vitest` | Moderate | Via vite/vite-node dependencies | Update to v4.0.17+ |

**Fix Command:**
```bash
cd gateway
npm install vitest@^4.0.17 --save-dev
```

### Docs/Interactive (5 moderate vulnerabilities)

| Package | Severity | Issue | Fix |
|---------|----------|-------|-----|
| `vite` | Moderate | Multiple path traversal issues (GHSA-g4jq-h2w9-997c, GHSA-jqfw-vq24-v9c3, GHSA-93m4-6634-74q7) | Update to v7.3.1+ |
| `prismjs` | Moderate | DOM Clobbering vulnerability (GHSA-x7hr-w5r2-h6wg) | Update react-syntax-highlighter to v16.1.0+ |
| `react-syntax-highlighter` | Moderate | Via prismjs dependency | Update to v16.1.0+ |
| `esbuild` | Moderate | Same as backend | Update vite to v7.3.1+ |

**Fix Command:**
```bash
cd docs/interactive
npm install vite@^7.3.1 react-syntax-highlighter@^16.1.0 --save-dev
```

---

## 🟡 Outdated Dependencies

### Backend - Critical Updates

| Package | Current | Latest | Type | Breaking Changes |
|---------|---------|--------|------|------------------|
| `@prisma/client` | 5.7.1 | 7.2.0 | Major | Yes - Migration required |
| `@sentry/node` | 7.99.0 | 10.33.0 | Major | Yes - API changes |
| `@sentry/profiling-node` | 1.3.5 | 10.33.0 | Major | Yes - Unified with @sentry/node |
| `express` | 4.18.2 | 5.2.1 | Major | Yes - Breaking changes |
| `zod` | 3.22.4 | 4.3.5 | Major | Yes - Stricter typing |
| `bcryptjs` | 2.4.3 | 3.0.3 | Major | Possibly - Check changelog |
| `helmet` | 7.1.0 | 8.1.0 | Major | Possibly |
| `dotenv` | 16.3.1 | 17.2.3 | Major | Likely minimal |

### Frontend - Critical Updates

| Package | Current | Latest | Type | Breaking Changes |
|---------|---------|--------|------|------------------|
| `react` | 18.2.0 | 19.2.3 | Major | Yes - React 19 changes |
| `react-dom` | 18.2.0 | 19.2.3 | Major | Yes - React 19 changes |
| `react-router-dom` | 6.8.1 | 7.12.0 | Major | Yes - Router v7 breaking changes |
| `zod` | 3.22.4 | 4.3.5 | Major | Yes - Stricter typing |
| `lucide-react` | 0.263.1 | 0.562.0 | Minor | No - Icon library updates |
| `@hookform/resolvers` | 3.3.0 | 5.2.2 | Major | Yes |

### Gateway - Critical Updates

| Package | Current | Latest | Type | Breaking Changes |
|---------|---------|--------|------|------------------|
| `express` | 4.18.2 | 5.2.1 | Major | Yes - Breaking changes |
| `express-rate-limit` | 7.1.5 | 8.2.1 | Major | Possibly |
| `http-proxy-middleware` | 2.0.6 | 3.0.5 | Major | Yes - Significant API changes |
| `helmet` | 7.1.0 | 8.1.0 | Major | Possibly |
| `dotenv` | 16.3.1 | 17.2.3 | Major | Likely minimal |

### Docs/Interactive - Critical Updates

| Package | Current | Latest | Type | Breaking Changes |
|---------|---------|--------|------|------------------|
| `react` | 18.2.0 | 19.2.3 | Major | Yes - React 19 changes |
| `react-dom` | 18.2.0 | 19.2.3 | Major | Yes - React 19 changes |
| `react-router-dom` | 6.8.1 | 7.12.0 | Major | Yes - Router v7 breaking changes |
| `lucide-react` | 0.263.1 | 0.562.0 | Minor | No - Icon library updates |

---

## 🔵 Dependency Bloat Analysis

### Backend Dependencies
**Total:** 17 production + 14 dev dependencies (31 total)
**Status:** ✅ Lean - All dependencies appear necessary

**Potential Issues:**
- `@types/nodemailer` and `@types/redis` in `dependencies` should be in `devDependencies`
- Consider if `fuse.js` is necessary (fuzzy search) - could be replaced with simpler search if not heavily used
- `socket.io` (4.8.3) - Ensure WebSocket functionality is actually being used

### Frontend Dependencies
**Total:** 10 production + 13 dev dependencies (23 total)
**Status:** ✅ Lean - Minimal and focused

**Notes:**
- Very clean dependency list
- All dependencies appear necessary for a modern React application

### Gateway Dependencies
**Total:** 6 production + 6 dev dependencies (12 total)
**Status:** ✅ Optimal - Minimal as expected for an API gateway

**Notes:**
- Excellent minimal footprint
- All dependencies are necessary for gateway functionality

### Docs/Interactive Dependencies
**Total:** 8 production + 10 dev dependencies (18 total)
**Status:** ✅ Lean - Documentation-focused dependencies

**Notes:**
- Consider if both `prismjs` AND `react-syntax-highlighter` are needed
- `react-syntax-highlighter` already uses prismjs internally, direct prismjs dependency might be redundant

### Root Dependencies
**Total:** 1 dev dependency (concurrently)
**Status:** ✅ Minimal - Single orchestration tool

---

## 📊 Recommendations by Priority

### Priority 1: Immediate Action Required

1. **Generate Missing Lockfiles**
   ```bash
   # Root
   npm install --package-lock-only

   # Frontend
   cd frontend && npm install --package-lock-only
   ```

2. **Fix Security Vulnerabilities**
   ```bash
   # Backend
   cd backend
   npm install vitest@^4.0.17 @vitest/coverage-v8@^4.0.17 --save-dev

   # Gateway
   cd gateway
   npm install vitest@^4.0.17 --save-dev

   # Docs
   cd docs/interactive
   npm install vite@^7.3.1 react-syntax-highlighter@^16.1.0 --save
   ```

3. **Move Type Definitions to devDependencies** (backend/package.json)
   ```bash
   cd backend
   npm uninstall @types/nodemailer @types/redis
   npm install @types/nodemailer@^7.0.4 @types/redis@^4.0.10 --save-dev
   ```

### Priority 2: Plan for Breaking Updates

These require careful testing and potential code changes:

1. **React 19 Migration** (Frontend & Docs)
   - Read migration guide: https://react.dev/blog/2024/04/25/react-19-upgrade-guide
   - Test thoroughly before upgrading
   - Consider staying on React 18 until ecosystem stabilizes

2. **Express 5 Migration** (Backend & Gateway)
   - Review breaking changes: https://expressjs.com/en/guide/migrating-5.html
   - Major changes to middleware and error handling
   - Plan testing strategy

3. **Prisma 7 Migration** (Backend)
   - Review migration guide: https://www.prisma.io/docs/orm/upgrade-guides/upgrade-from-v6
   - Test database migrations thoroughly
   - Plan downtime if needed

4. **Zod 4 Migration** (Backend & Frontend)
   - More strict type checking
   - Review validation schemas
   - Update error handling

5. **React Router v7 Migration** (Frontend & Docs)
   - Significant changes to routing API
   - Review migration guide
   - Consider staying on v6 for now

### Priority 3: Minor Updates (Low Risk)

Safe to update with minimal testing:

```bash
# Backend
cd backend
npm update helmet dotenv

# Frontend
cd frontend
npm update lucide-react

# Gateway
cd gateway
npm update dotenv

# Docs
cd docs/interactive
npm update lucide-react
```

### Priority 4: Dependency Cleanup

1. **Remove Redundant prismjs** (docs/interactive)
   ```bash
   cd docs/interactive
   # If prismjs is only imported via react-syntax-highlighter
   npm uninstall prismjs @types/prismjs
   ```

2. **Audit socket.io Usage** (backend)
   - Verify WebSocket functionality is actually being used
   - If not, consider removing to reduce bundle size

3. **Audit fuse.js Usage** (backend & docs)
   - Verify fuzzy search is necessary
   - Consider simpler string matching if lightly used

---

## 🔧 Automated Update Strategy

### Create Update Scripts

**update-security.sh**
```bash
#!/bin/bash
set -e

echo "Fixing security vulnerabilities..."

# Backend
cd backend
npm install vitest@^4.0.17 @vitest/coverage-v8@^4.0.17 --save-dev

# Gateway
cd ../gateway
npm install vitest@^4.0.17 --save-dev

# Docs
cd ../docs/interactive
npm install vite@^7.3.1 react-syntax-highlighter@^16.1.0

echo "Security vulnerabilities fixed!"
```

**update-minor.sh**
```bash
#!/bin/bash
set -e

echo "Updating minor versions..."

# Backend
cd backend
npm update helmet dotenv

# Gateway
cd ../gateway
npm update dotenv

# Frontend
cd ../frontend
npm update lucide-react

# Docs
cd ../docs/interactive
npm update lucide-react

echo "Minor updates complete!"
```

### Add npm Scripts (root package.json)

```json
{
  "scripts": {
    "audit:all": "npm audit && cd backend && npm audit && cd ../frontend && npm audit && cd ../gateway && npm audit && cd ../docs/interactive && npm audit",
    "outdated:all": "npm outdated; cd backend && npm outdated; cd ../frontend && npm outdated; cd ../gateway && npm outdated; cd ../docs/interactive && npm outdated",
    "update:security": "./scripts/update-security.sh",
    "update:minor": "./scripts/update-minor.sh"
  }
}
```

---

## 📈 Long-Term Maintenance Recommendations

1. **Establish Update Cadence**
   - Security updates: Immediate
   - Minor updates: Monthly
   - Major updates: Quarterly (with testing)

2. **Automated Monitoring**
   - Set up Dependabot or Renovate for automated PRs
   - Configure GitHub Security Advisories
   - Add npm audit to CI/CD pipeline

3. **Testing Requirements**
   - Run full test suite before any update
   - Add integration tests for critical paths
   - Consider visual regression testing for frontend

4. **Documentation**
   - Document all breaking changes during updates
   - Maintain CHANGELOG.md with dependency updates
   - Keep this audit report updated quarterly

5. **Dependency Review Process**
   - Review new dependencies before adding
   - Check bundle size impact
   - Verify maintenance status and security track record

---

## 📝 Summary of Actions

### Immediate (Do Today)
- [ ] Generate missing package-lock.json files
- [ ] Fix all security vulnerabilities
- [ ] Move type packages to devDependencies

### This Week
- [ ] Create update scripts
- [ ] Update minor versions
- [ ] Remove redundant dependencies
- [ ] Add audit npm scripts

### This Month
- [ ] Plan React 19 migration strategy
- [ ] Plan Express 5 migration strategy
- [ ] Plan Prisma 7 migration strategy
- [ ] Set up automated dependency monitoring

### This Quarter
- [ ] Execute major version migrations with full testing
- [ ] Establish regular update cadence
- [ ] Document migration experiences
- [ ] Review and optimize bundle sizes

---

## 🎯 Expected Outcomes

After implementing these recommendations:

- **0 security vulnerabilities** (currently 14)
- **100% lockfile coverage** (currently 60%)
- **Up-to-date security patches** for all dependencies
- **Planned migration path** for major versions
- **Reduced technical debt** through cleanup
- **Automated monitoring** for future issues

---

## 📚 Resources

- [npm audit documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [Dependabot documentation](https://docs.github.com/en/code-security/dependabot)
- [Express 5 Migration Guide](https://expressjs.com/en/guide/migrating-5.html)
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide)
- [Prisma Upgrade Guides](https://www.prisma.io/docs/orm/upgrade-guides)
- [Semantic Versioning](https://semver.org/)

---

**Report Generated By:** Claude Code
**Next Review Date:** 2026-04-13 (90 days)
