# Task Plan: Optionable Design Improvements

## Goal
Apply professional design principles to the Optionable trading dashboard, making it feel like a polished financial tool.

## Phases
- [x] Phase 1: Analyze codebase with design-principles skill
- [x] Phase 2: Implement high-priority fixes
  - [x] Remove decorative gradient from Tips card
  - [x] Unify shadow approach (borders + subtle shadows)
  - [x] Standardize border radius (8px system)
  - [x] Reduce status color palette (muted, professional)
  - [x] Add design tokens to CSS
- [x] Phase 3: Address feedback (Tips card color restored)
- [ ] Phase 4: Implement remaining improvements (CURRENT)
  - [ ] Add dark mode support
  - [ ] Consider Phosphor Icons migration
- [ ] Phase 5: Review, commit, and merge to main

## Key Questions
1. Does the user want dark mode? (Medium effort)
2. Should we switch icon libraries? (Low effort, breaking change)
3. Should we split App.jsx into components? (Architecture, not design)

## Decisions Made
- [Borders-only approach]: Chose subtle shadows + borders instead of dramatic drop shadows
- [8px radius system]: Standardized on rounded-lg for consistency
- [Muted status colors]: Using ring borders instead of solid backgrounds
- [Indigo tint for Tips]: Restored visual distinction with bg-indigo-50

## Errors Encountered
- [Node version mismatch]: better-sqlite3 needed rebuild → `npm rebuild better-sqlite3`
- [Port conflicts]: Killed existing processes on 8080/5173 before restart

## Files Modified
- `src/App.jsx` - UI component fixes
- `src/index.css` - Design tokens added

## Status
**COMPLETED** - Merged to main, pushed to GitHub, Docker images published as v0.4.0

## Phase 5 Tasks
### Quick Wins (1-5)
- [x] 1. Status filter tabs (All/Open/Closed)
- [x] 2. Annualized ROI column
- [x] 3. Days held column
- [x] 4. Quick close button
- [x] 5. Chart dark mode grid fix

### Dashboard Enhancements (6-10)
- [x] 6. Best ticker card
- [x] 7. Total premium collected card
- [ ] 8. Sparklines in KPI cards (deferred)
- [x] 9. Time period selector on chart
- [x] 10. Sortable columns

### UX Polish (14-18)
- [x] 14. Loading skeleton
- [x] 15. Empty state illustration (text-based)
- [x] 16. Toast notifications
- [x] 17. Keyboard shortcuts (N=new, D=dark, Esc=close, ?=help)
- [x] 18. Dark scrollbar

## Next Action
Completed - v0.4.0 released

---

# Development Workflow Template

## Phase 1: Discovery
- [ ] Understand the request/problem
- [ ] Explore codebase to find relevant files
- [ ] Document current state and what needs to change
- [ ] Identify dependencies and potential impacts
- [ ] Create feature branch: `feature/[name]` or `fix/[name]`
- [ ] Start dev server for live preview

## Phase 2: Planning
- [ ] Break task into smaller steps
- [ ] Prioritize by dependency order (what needs to happen first)
- [ ] Identify risks or blockers
- [ ] Get user approval on approach if needed

## Phase 3: Implementation
- [ ] Work through steps incrementally
- [ ] Test each change before moving on
- [ ] Get user feedback after each major milestone
- [ ] Adjust based on feedback
- [ ] Don't remove existing functionality without asking

## Phase 4: Polish
- [ ] Handle edge cases (empty states, errors, loading)
- [ ] Add user feedback mechanisms if needed (toasts, messages)
- [ ] Clean up code (remove debug logs, unused imports)
- [ ] Verify nothing broke

## Phase 5: Ship
- [ ] Commit with clear, descriptive message
- [ ] Build artifacts if needed (Docker, binaries)
- [ ] Push to registry if needed (Docker Hub, npm)
- [ ] Merge to main
- [ ] Push to GitHub
- [ ] Tag release if applicable

---

## Key Principles
1. **Branch first** - Never work directly on main
2. **Live preview** - Run dev server so user sees changes in real-time
3. **Incremental feedback** - Check in with user after each major change
4. **Don't assume** - Ask before removing or changing existing behavior
5. **Test before commit** - Verify changes work before committing
6. **Ship working code** - Build and test before releasing
