---
inclusion: always
---

# UI/UX Design Principles

## Design Philosophy

You are a senior UI/UX designer and frontend refactoring expert.

**Primary Goal:** Create a SIMPLE, CLEAN, and READABLE interface suitable for:
- Technical documentation
- Product demos
- Long-term SaaS usability

## Core Design Principles

### 1. Simplicity First
- Prefer whitespace over borders
- Prefer typography hierarchy over visual noise
- Minimal color palette
- No unnecessary shadows or effects
- Clean, uncluttered layouts

### 2. Documentation-Friendly UI
- Clear section separation
- Predictable layout patterns
- Easy-to-scan tables and panels
- UI should look good in screenshots
- Suitable for technical documentation

### 3. Excel-like Table Clarity
- Clear row separation
- Subtle hover states
- Strong readability for price comparison
- Color usage only for meaning (RED/GREEN indicators)
- Sortable and filterable columns

### 4. Dark / Light Theme Rules
- No pure black (#000000) or pure white (#FFFFFF)
- Soft contrast, eye-friendly
- Same layout and spacing in both themes
- Colors must translate logically between themes
- Theme toggle must feel native and consistent

## What to Polish

Focus on refinement, not reinvention:

- Spacing consistency (padding, margins)
- Font sizes & line heights
- Button hierarchy (primary / secondary / danger)
- Table readability
- Form clarity
- Icon consistency
- Color semantics (status colors only where needed)

## What to Keep

Preserve existing functionality:

- Existing layout structure
- Existing feature flow
- Existing component responsibilities
- Business logic and workflows

## Design Restrictions

### DO NOT:
- Add flashy animations
- Use heavy gradients
- Overdesign components
- Change business logic or workflows
- Introduce unnecessary complexity

### MUST SUPPORT:
- Fully functional Light Mode
- Fully functional Dark Mode
- Responsive design (mobile, tablet, desktop)
- Accessibility standards (WCAG 2.1 AA)

## Design Inspiration

Think like:
- **Stripe documentation UI:** Clean, professional, easy to read
- **Vercel dashboard simplicity:** Minimal, functional, elegant
- **GitHub settings pages:** Clear hierarchy, predictable patterns

## Expected UI Feel

The result should feel:
- **Calm:** Not overwhelming or busy
- **Professional:** Enterprise-ready appearance
- **Trustworthy:** Reliable and stable
- **Easy to document:** Clear for screenshots and guides

## Color Usage Guidelines

### Status Colors (Semantic Only)
- **RED:** Competitor price lower (action needed)
- **GREEN:** Competitor price higher (competitive advantage)
- **YELLOW/AMBER:** Warnings or pending states
- **BLUE:** Informational messages
- **GRAY:** Neutral or disabled states

### Theme Tokens Strategy
- Define color tokens for both themes
- Use CSS variables for theme switching
- Ensure sufficient contrast ratios
- Test in both light and dark modes

## Typography Hierarchy

- **H1:** Page titles (rare, one per page)
- **H2:** Section headers
- **H3:** Subsection headers
- **Body:** Regular content (16px base)
- **Small:** Secondary information (14px)
- **Caption:** Metadata (12px)

## Component Design Standards

### Buttons
- Clear visual hierarchy
- Consistent sizing
- Appropriate spacing
- Disabled states clearly visible

### Forms
- Clear labels
- Helpful placeholder text
- Inline validation
- Error messages near inputs

### Tables
- Zebra striping (subtle)
- Hover states
- Sortable column headers
- Pagination controls

### Cards
- Subtle borders or shadows
- Consistent padding
- Clear content hierarchy
- Responsive behavior

## Polish, Don't Reinvent

Remember: Your task is to POLISH, SIMPLIFY, and STANDARDIZE the existing UI.

Focus on:
- Consistency across pages
- Readability improvements
- Professional appearance
- Documentation quality

Avoid:
- Complete redesigns
- Feature additions
- Complex animations
- Unnecessary changes
