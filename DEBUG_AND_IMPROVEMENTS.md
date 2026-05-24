# EWU Portal Helper - Debug Logs & Improvements

## Overview
This document details the comprehensive debug logging system and targeted improvements implemented in v2.1.0+.

---

## 1. CLASS SCHEDULE DEBUG LOGS

### Log Prefix
All Routine Generator logs use: `[EWU Helper][Routine]`

### Debug Points Added

#### Initialization Phase
```
[EWU Helper][Routine] Class schedule page detected
[EWU Helper][Routine] Schedule table detected
[EWU Helper][Routine] Schedule table container not found
[EWU Helper][Routine] Cannot inject button - schedule table not found
[EWU Helper][Routine] Generate Routine button injected
```

#### Modal & Library Loading
```
[EWU Helper][Routine] Routine modal opening
[EWU Helper][Routine] Libraries already loaded (html2canvas, jsPDF)
[EWU Helper][Routine] Loading libraries from: [base-url]
[EWU Helper][Routine] html2canvas loaded successfully
[EWU Helper][Routine] jsPDF loaded successfully
[EWU Helper][Routine] Library load failed: [error-message]
```

#### PDF Export
```
[EWU Helper][Routine] PDF export started
[EWU Helper][Routine] Libraries unavailable, using print fallback
[EWU Helper][Routine] Preview element not found
[EWU Helper][Routine] Export target element found, size: 1200 x 800
[EWU Helper][Routine] Capturing canvas with html2canvas
[EWU Helper][Routine] Canvas generated, size: 2400 x 1600
[EWU Helper][Routine] Adding image to PDF, orientation: landscape
[EWU Helper][Routine] PDF export successful
[EWU Helper][Routine] PDF export failed: [error-message]
```

#### Image Export
```
[EWU Helper][Routine] Image export started
[EWU Helper][Routine] Export target element found, size: 1200 x 800
[EWU Helper][Routine] Capturing canvas with html2canvas
[EWU Helper][Routine] Canvas generated, size: 2400 x 1600
[EWU Helper][Routine] Image blob generation failed
[EWU Helper][Routine] Image export successful
[EWU Helper][Routine] Image export failed: [error-message]
```

### How to Use Debug Logs
1. Open Chrome DevTools (F12) on the Class Schedule page
2. Go to Console tab
3. Click the "Generate Routine" button
4. Observe logs with `[EWU Helper][Routine]` prefix
5. If export fails, check logs to identify the issue
6. Logs show: element sizes, library availability, canvas generation, and exact error messages

---

## 2. PDF & IMAGE EXPORT FIXES

### Fixed Issues
- **Libraries now properly loaded** from manifest web_accessible_resources
- **Export canvas size capped at 1200px width** for better performance on low-end devices
- **White background guaranteed** for exports (backgroundColor: #FFFFFF)
- **A4 PDF scaling** with proper orientation (portrait/landscape)
- **Modal overlay hidden** during capture for clean export
- **Success/error toasts** show on export completion
- **Error messages include details** (not just generic "failed")

### Export Quality
- Standard: 2x scale (good quality, smaller file)
- High: 3x scale (best quality, larger file) - configurable in settings
- Both support pdf and image formats

### Browser Compatibility
- Tested on Chrome/Edge (Chromium)
- Fallback to print dialog if libraries unavailable
- Works on mobile and desktop browsers

---

## 3. OFFERED COURSES API RESPONSE HOOK

### New Feature: pageHook.js
Located at: `/pageHook.js` in extension root

#### How It Works
1. **Page-level interception**: Runs in page context (not content script sandbox)
2. **Fetch API intercept**: Captures fetch() calls
3. **XMLHttpRequest intercept**: Captures XHR calls
4. **API URLs captured**:
   - `/api/utility/GetAllOfferedCourses?deptid={id}&semesterid={id}`
   - (Schedule API for future use)
5. **Data transmission**: Sends via postMessage to content script
6. **No hardcoding**: deptid and semesterid are dynamic (captured from actual requests)

#### Debug Logs
```
[PageHook] GetAllOfferedCourses captured: [data]
[PageHook] GetAllOfferedCourses XHR captured: [data]
[EWU Helper] pageHook.js injected
[EWU Helper] Received API data from pageHook: GetAllOfferedCourses
```

#### Data Flow
```
Page (pageHook.js)
    ↓ postMessage
Content Script (content.js) 
    ↓ routes to module
OfferedCoursesEnhancerModule._handleData()
    ↓ builds table
Enhanced HTML Table
```

---

## 4. OFFERED COURSES PAGE ENHANCEMENTS

### Log Prefix
All Offered Courses logs use: `[EWU Helper][Offered Courses]`

### Debug Points Added

#### Page Detection & Initialization
```
[EWU Helper][Offered Courses] Offered Courses page detected
[EWU Helper][Offered Courses] API data received, items: 25
[EWU Helper][Offered Courses] API response is not an array
[EWU Helper][Offered Courses] Total items after merge: 25
[EWU Helper][Offered Courses] Search bar injected
[EWU Helper][Offered Courses] Search focused via Ctrl+K
```

### Features

#### Search Functionality
- **Keyboard Shortcut**: `Ctrl+K` or `Cmd+K` (Mac)
- **Search Fields**: Course code, Faculty (ShortName), Timing, Room, Department, Course Name
- **Debounce**: 150ms for smooth search on low-end devices
- **Clear Button**: Appears when text entered, clears search when clicked
- **Positioning**: Fixed above table, stays visible while scrolling

#### Table Structure
```
Headers: Course | Section | Faculty | Capacity | Left | Timing | Room No. | Dedicated Department
```

#### Faculty Column
- **Source**: API field `ShortName` (e.g., "AJ" for "Abu Jaffar")
- **Fallback**: Shows "-" if ShortName is null/empty
- **Formatting**: Properly escaped for safety
- **Per-course faculty**: Each row gets correct faculty (not duplicated)

#### Left Column (Available Seats)
- **Calculation**: `SeatCapacity - SeatTaken` (minimum 0)
- **Color Coding** (if enabled in settings):
  - Red: 0 seats available (fully booked)
  - Yellow: 1-10 seats available (limited)
  - Green: 11+ seats available (plenty)

#### Table Styling
- **Sticky Header**: Fixed at top while scrolling
- **Row Alternation**: Alternating white/light-blue rows
- **Hover Effect**: Light blue highlight on hover
- **Responsive**: Horizontal scroll on mobile
- **Max Height**: 600px with scroll bar
- **Font**: Professional sizing and weight

---

## 5. GENERATE ROUTINE BUTTON ALIGNMENT

### Changes
- **Old Position**: Above semester dropdown/form
- **New Position**: Directly below the schedule table (using `insertAfter`)
- **Button Text**: Removed emoji (📚), now just "Generate Routine"
- **Alignment**: 
  - Desktop: Right-aligned
  - Mobile: Centered (full-width at small screens)
- **Spacing**: margin-top:12px, margin-bottom:16px
- **Duplicate Prevention**: Checks for existing button before injecting

### Style
```css
.ewu-rg-inject-btn {
  white-blue professional gradient
  Smooth hover/active animations
  Proper disabled state
  Rounded corners (8px)
}
```

---

## 6. KEYBOARD SHORTCUTS

### Ctrl+K - Offered Courses Search
- **Scope**: Only works on Offered Courses page
- **Action**: Focuses search input, selects all text
- **Debug Log**: `[EWU Helper][Offered Courses] Search focused via Ctrl+K`
- **Works on**: Desktop, Tablet, Mobile (if hardware keyboard available)

### Future Shortcuts
- Extensible pattern for adding more shortcuts
- Each feature can register its own Ctrl+Key binding

---

## 7. ERROR HANDLING & FALLBACKS

### PDF Export Fallback
If html2canvas or jsPDF libraries fail to load:
1. Opens print dialog instead
2. Shows toast: "Print dialog opened (libs unavailable)"
3. User can still save as PDF from print dialog
4. Proper error logging in console

### API Data Fallback
If pageHook.js or API capture fails:
1. Content script still hooks API via fetch/XHR
2. Falls back to DOM parsing as last resort
3. Shows appropriate error message
4. No silent failures - always logs issues

### Search Fallback
If search bar injection fails:
1. Page still works normally
2. Users can still use browser Find (Ctrl+F)
3. Debug log shows why injection failed

---

## 8. PERFORMANCE OPTIMIZATIONS

### Debouncing
- **Search**: 150ms debounce (vs 200ms before)
- **Table enhancement**: 300ms scheduled (prevents rapid rebuilds)
- **Low-end device friendly**: No memory leaks, no repeated observers

### Canvas Rendering
- **Width capping**: Max 1200px width (prevents oversized exports)
- **Scale factor**: Configurable (standard=2x, high=3x)
- **CORS handling**: useCORS=true, allowTaint=true
- **Background color**: Pure white for printing

### DOM Operations
- **MutationObserver throttling**: Only one active observer per module
- **Hash-based rebuild prevention**: Skips rebuilds if data hash unchanged
- **Cleanup on reset**: All timers/observers properly disconnected

---

## 9. TOAST NOTIFICATIONS

### Routine Generator
- "Extension active" - On page load
- "PDF saved" → "PDF exported successfully" - On PDF export success
- "Image saved" → "Image exported successfully" - On image export success
- "PDF export failed: [error]" - On export failure
- "Image export failed: [error]" - On image export failure
- "No course data found" - If schedule is empty

### Offered Courses
- "Offered courses data loaded" - When API response received
- "Loading enhanced course data..." - On button click (button watcher)

---

## 10. TESTING CHECKLIST

### Class Schedule Page (My Class Schedule)
- [ ] Page detected (check console log)
- [ ] Table detected (check console log)
- [ ] Button injected below table (check UI)
- [ ] Button enabled when schedule loaded
- [ ] Click button → modal opens
- [ ] Libraries load (check console logs)
- [ ] PDF export works (check console logs, then check Downloads)
- [ ] Image export works (check console logs, then check Downloads)
- [ ] Verify PDF white background and proper scaling
- [ ] Verify image high quality
- [ ] Try export on mobile (responsive)

### Offered Courses Page (Offered Courses Student)
- [ ] Page detected (check console log)
- [ ] Click "Show Offered Courses" button
- [ ] API response captured (check console logs)
- [ ] Table built with correct headers
- [ ] Faculty column shows correct ShortName values
- [ ] Left column calculates correctly (Capacity - Taken)
- [ ] Search bar appears above table
- [ ] Type in search - rows filter correctly
- [ ] Press Ctrl+K - search input focused
- [ ] Search includes course code and faculty
- [ ] Try search on mobile (responsive, visible while scrolling)

### Edge Cases
- [ ] Test with no courses (empty schedule)
- [ ] Test with many courses (50+)
- [ ] Test with missing faculty names (should show "-")
- [ ] Test with 0 seats left (red color if enabled)
- [ ] Test Ctrl+K when already focused
- [ ] Test back button after navigation (modules reset properly)

---

## 11. FILE STRUCTURE

```
/manifest.json              - Updated with pageHook.js in web_accessible_resources
/content.js                 - Added debug logs, page hook injection, API routing
/pageHook.js               - New: Page-level API interception
/styles.css                - Table/button styling (unchanged from v2.1.0)
/popup.html                - Settings (unchanged from v2.1.0)
/popup.js                  - Settings handler (unchanged from v2.1.0)
/lib/html2canvas.min.js   - Export library (bundled)
/lib/jspdf.umd.min.js     - Export library (bundled)
```

---

## 12. KNOWN LIMITATIONS

- **Ctrl+K**: Works when focus is on page, not in modal text box
- **Search**: Searches all columns, not just course and faculty (more comprehensive)
- **Export**: Requires Chrome/Edge (Manifest V3 extension)
- **PDF**: Single-page A4 format (courses don't span multiple PDF pages)
- **Mobile**: Tested on Chrome Mobile, may vary on other browsers

---

## 13. VERSION HISTORY

### v2.1.0 → v2.1.0+ (Current)
- Added comprehensive debug logging system
- Created pageHook.js for proper API capture
- Implemented Ctrl+K search shortcut
- Fixed button alignment and styling
- Improved export error messages
- Enhanced toast notifications
- Added debug documentation

---

## 14. SUPPORT & DEBUGGING

If something doesn't work:

1. **Check Console Logs** (F12 → Console)
   - Look for `[EWU Helper]` prefixed messages
   - Check for errors in red text
   - Copy full error for support

2. **Check Console Logs for Module**
   - `[EWU Helper][Routine]` - Class Schedule issues
   - `[EWU Helper][Offered Courses]` - Offered Courses issues
   - `[PageHook]` - API capture issues

3. **Common Issues**:
   - **Button not appearing**: Check if on Class Schedule page
   - **API not captured**: Check pageHook.js injection log
   - **Search not working**: Check search bar injection log
   - **Export fails**: Check library load logs

4. **Report Issues With**:
   - Console log output (copy-paste)
   - Page URL where issue occurred
   - Browser version
   - Steps to reproduce

---

**Last Updated**: 2026-05-24
**Extension Version**: 2.1.0+
**Manifest Version**: 3
