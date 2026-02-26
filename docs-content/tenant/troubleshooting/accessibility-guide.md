---
title: "Accessibility Guide"
description: "Accessibility features and guidelines for PricePilot"
category: "troubleshooting"
tags: ["accessibility", "wcag", "guide"]
audience: "tenant"
author: "PricePilot Team"
lastReviewed: "2024-05-20"
---

# Accessibility Guide for Admin Dashboard

This guide documents the accessibility features implemented in the admin dashboard to ensure WCAG 2.1 AA compliance.

## Overview

The admin dashboard implements comprehensive accessibility features including:

- **Keyboard Navigation**: Full keyboard support for all interactive elements
- **Screen Reader Support**: ARIA labels, live regions, and announcements
- **Focus Management**: Proper focus trapping in modals and focus restoration
- **Visual Indicators**: Clear focus states and status indicators
- **Semantic HTML**: Proper use of HTML5 semantic elements

## Keyboard Navigation

### Global Shortcuts

The dashboard supports keyboard shortcuts for common actions:

- `R`: Refresh current view
- `Ctrl/Cmd + S`: Save (where applicable)
- `Escape`: Close modals and dialogs
- `Tab`: Navigate forward through interactive elements
- `Shift + Tab`: Navigate backward through interactive elements

### Component-Specific Navigation

#### Lists and Tables
- `Arrow Up/Down`: Navigate between items
- `Arrow Left/Right`: Navigate between columns (tables)
- `Home`: Jump to first item
- `End`: Jump to last item
- `Enter` or `Space`: Select/activate item

#### Modals and Dialogs
- Focus is automatically trapped within the modal
- `Escape`: Close modal
- `Tab`: Cycle through focusable elements within modal
- Focus is restored to the triggering element when closed

#### Tabs
- `Arrow Left/Right`: Navigate between tabs
- `Home`: Jump to first tab
- `End`: Jump to last tab
- `Enter` or `Space`: Activate tab

## Screen Reader Support

### ARIA Labels

All interactive elements have appropriate ARIA labels:

```typescript
// Example: Button with icon
<button aria-label="Refresh data">
  <RefreshIcon aria-hidden="true" />
</button>

// Example: Status indicator
<div role="status" aria-label="Session status: Running">
  <StatusIcon />
  Running
</div>
```

### Live Regions

Dynamic content updates are announced to screen readers:

```typescript
// Polite announcements (non-critical updates)
<div role="status" aria-live="polite" aria-atomic="true">
  Data loaded successfully
</div>

// Assertive announcements (critical updates)
<div role="alert" aria-live="assertive" aria-atomic="true">
  Error: Failed to load data
</div>
```

### Screen Reader Announcements

Use the `useAnnouncement` hook to programmatically announce messages:

```typescript
import { useAnnouncement } from '@/lib/hooks/useAccessibility';

function MyComponent() {
  const announce = useAnnouncement();
  
  const handleAction = () => {
    // Perform action
    announce('Action completed successfully', 'polite');
  };
  
  return <button onClick={handleAction}>Perform Action</button>;
}
```

## Focus Management

### Focus Trap in Modals

Modals automatically trap focus using the `useFocusTrap` hook:

```typescript
import { useFocusTrap } from '@/lib/hooks/useAccessibility';

function Modal({ isOpen, onClose }) {
  const containerRef = useFocusTrap(isOpen);
  
  return (
    <div ref={containerRef} role="dialog" aria-modal="true">
      {/* Modal content */}
    </div>
  );
}
```

### Focus on Mount

Automatically focus elements when they appear:

```typescript
import { useFocusOnMount } from '@/lib/hooks/useAccessibility';

function SearchInput() {
  const inputRef = useFocusOnMount(true);
  
  return <input ref={inputRef} type="search" />;
}
```

## Visual Indicators

### Focus States

All interactive elements have visible focus indicators:

```css
/* Applied automatically via focus-visible-ring class */
.focus-visible-ring:focus-visible {
  outline: none;
  ring: 2px solid var(--ring);
  ring-offset: 2px;
}
```

### Status Indicators

Status indicators include both visual and textual information:

```typescript
<div className="flex items-center gap-2">
  <StatusIcon className="text-green-500" />
  <span className="sr-only">Status: Healthy</span>
  <span aria-hidden="true">Healthy</span>
</div>
```

## Component-Specific Guidelines

### Real-Time Monitor

- Session list items are keyboard navigable
- Status changes are announced to screen readers
- Filter controls have proper labels
- Refresh button includes loading state announcement

### Metrics Dashboard

- All metrics have descriptive ARIA labels
- Charts include text alternatives
- Time range selector is keyboard accessible
- Export button announces success/failure

### Proxy Simulator

- Configuration form has proper field labels
- Simulation progress is announced
- Results are presented in accessible format
- Comparison table supports keyboard navigation

### System Health Monitor

- Component status changes are announced
- Diagnostic results are keyboard navigable
- Alert acknowledgment is accessible
- Health indicators have descriptive labels

### Session Control Panel

- Bulk operations have confirmation dialogs
- Selected sessions are announced
- Control buttons have clear labels
- Operation results are announced

## Testing Accessibility

### Automated Testing

Run accessibility tests:

```bash
npm test -- __tests__/lib/accessibility-features.test.tsx
```

### Manual Testing

#### Keyboard Navigation
1. Use only keyboard (no mouse)
2. Tab through all interactive elements
3. Verify focus is always visible
4. Test all keyboard shortcuts

#### Screen Reader Testing
1. Use NVDA (Windows) or VoiceOver (Mac)
2. Navigate through the interface
3. Verify all content is announced
4. Test dynamic updates

#### Visual Testing
1. Increase text size to 200%
2. Test with high contrast mode
3. Verify focus indicators are visible
4. Check color contrast ratios

### Accessibility Tools

Recommended tools for testing:

- **axe DevTools**: Browser extension for automated testing
- **WAVE**: Web accessibility evaluation tool
- **Lighthouse**: Built into Chrome DevTools
- **NVDA**: Free screen reader for Windows
- **VoiceOver**: Built-in screen reader for macOS

## Best Practices

### Do's

✅ Always provide text alternatives for images and icons
✅ Use semantic HTML elements (button, nav, main, etc.)
✅ Ensure sufficient color contrast (4.5:1 for normal text)
✅ Make all functionality keyboard accessible
✅ Provide clear focus indicators
✅ Use ARIA labels for complex interactions
✅ Announce dynamic content changes
✅ Test with actual assistive technologies

### Don'ts

❌ Don't use div/span for buttons or links
❌ Don't rely solely on color to convey information
❌ Don't create keyboard traps (except in modals)
❌ Don't use placeholder text as labels
❌ Don't hide focus indicators
❌ Don't use ARIA when semantic HTML suffices
❌ Don't forget to test with keyboard only
❌ Don't assume automated tests catch everything

## Utility Functions

### Accessibility Enhancements

```typescript
import {
  announceToScreenReader,
  FocusTrap,
  KeyboardNavigationHelper,
  KeyboardShortcutManager,
  generateAriaId,
  getStatusAriaLabel,
  getMetricAriaLabel,
  getProgressAriaLabel,
} from '@/lib/utils/accessibility-enhancements';
```

### Accessibility Hooks

```typescript
import {
  useAnnouncement,
  useFocusTrap,
  useKeyboardShortcuts,
  useAriaId,
  useFocusOnMount,
  useLoadingAnnouncement,
  useErrorAnnouncement,
  useSuccessAnnouncement,
  useLiveRegion,
  useRovingTabIndex,
} from '@/lib/hooks/useAccessibility';
```

## WCAG 2.1 AA Compliance Checklist

### Perceivable

- [x] Text alternatives for non-text content
- [x] Captions and alternatives for multimedia
- [x] Content can be presented in different ways
- [x] Sufficient color contrast
- [x] Text can be resized up to 200%

### Operable

- [x] All functionality available via keyboard
- [x] Users have enough time to read content
- [x] No content that causes seizures
- [x] Users can navigate and find content
- [x] Multiple ways to navigate

### Understandable

- [x] Text is readable and understandable
- [x] Content appears and operates predictably
- [x] Users are helped to avoid and correct mistakes
- [x] Error messages are clear and helpful

### Robust

- [x] Compatible with assistive technologies
- [x] Valid HTML markup
- [x] Proper ARIA usage
- [x] Status messages are programmatically determined

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Resources](https://webaim.org/resources/)
- [A11y Project](https://www.a11yproject.com/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

## Support

For accessibility issues or questions:

1. Check this guide first
2. Review the WCAG 2.1 guidelines
3. Test with assistive technologies
4. Consult the development team

Remember: Accessibility is not a feature, it's a requirement. Every user deserves equal access to our platform.
