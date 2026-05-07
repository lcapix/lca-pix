# Grid Layout Debugging Guide

## Quick Checklist

Copy and paste this into your browser console on the comparison page:

```javascript
// Debug Grid Layout
console.log('=== GRID LAYOUT DEBUG ===');
console.log('1. Number of cases:', document.querySelectorAll('.grid > div').length);
console.log('2. Grid container exists:', !!document.querySelector('.grid'));
console.log('3. Grid template columns:', document.querySelector('.grid')?.style.gridTemplateColumns || 'NOT SET');
console.log('4. Grid computed columns:', window.getComputedStyle(document.querySelector('.grid') || document.body).gridTemplateColumns);
console.log('5. Window width:', window.innerWidth);
console.log('6. Grid container classes:', document.querySelector('.grid')?.className);
```

## Expected Output

If everything is working correctly, you should see:
```
=== GRID LAYOUT DEBUG ===
1. Number of cases: 4
2. Grid container exists: true
3. Grid template columns: NOT SET (this is normal - Tailwind uses classes)
4. Grid computed columns: 1fr 1.5fr 1.5fr 1fr
5. Window width: [your screen width]
6. Grid container classes: grid grid-cols-[1fr_1.5fr_1.5fr_1fr] gap-2 lg:gap-4
```

## Troubleshooting

### If "Grid container exists: false"
❌ **Problem**: The 4-column layout isn't rendering at all
✅ **Solution**:
- Check if you're viewing a 2-case comparison (not 3+)
- Check browser console for React errors
- Verify `isTwoCaseComparison` is true

### If "Grid computed columns" doesn't show "1fr 1.5fr 1.5fr 1fr"
❌ **Problem**: Tailwind arbitrary values not working
✅ **Solutions**:
1. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
2. Clear browser cache
3. Check Tailwind CSS version in package.json (need v3.0+)
4. Try fallback: change to `grid-cols-4` (4 equal columns)

### If you see 2 child divs instead of 4
❌ **Problem**: Viewing a 2x2 grid, not 4 columns
✅ **Solution**: The grid is working but using wrong breakpoint
- Widen your browser window
- Or the old code is still cached

### If "Number of cases: 0"
❌ **Problem**: Grid exists but has no children
✅ **Solution**: Check if components are loading
- Look for loading skeleton animations
- Check Network tab for API call failures

## Manual Inspection Steps

1. **Open DevTools** (F12 or Right-click → Inspect)

2. **Find the grid container**:
   - Click the element selector (arrow icon in DevTools)
   - Click on one of the case cards in the browser
   - Look up in the HTML tree for a `<div>` with class `grid`

3. **Check computed styles**:
   - With the grid div selected, go to "Computed" tab
   - Find `grid-template-columns`
   - Should say: `1fr 1.5fr 1.5fr 1fr`

4. **Check for CSS conflicts**:
   - Look for any red strikethrough styles
   - Check if other CSS is overriding the grid

## Still Not Working?

If the grid still shows vertical stacking after all these checks, there might be a CSS specificity issue or a React rendering problem.

### Nuclear Option: Force Grid with Inline Styles

As a temporary test, you can manually add inline styles in DevTools:
1. Select the grid div
2. In the Styles panel, add:
   ```css
   display: grid !important;
   grid-template-columns: 1fr 1.5fr 1.5fr 1fr !important;
   gap: 1rem !important;
   ```
3. If this works, it confirms the HTML structure is correct but CSS isn't being applied

### Check for JavaScript Errors

Look in Console tab for errors like:
- "Cannot read property 'map' of undefined"
- "Failed to fetch"
- Any red error messages

These would indicate the data isn't loading properly, which could prevent the grid from rendering.

## Report Back

Please share:
1. Screenshot of the console output from the debug script
2. Screenshot of DevTools showing the grid element's computed styles
3. Your browser name and version
4. Window width (from the debug output)
5. Whether you hard-refreshed the page (Cmd+Shift+R / Ctrl+Shift+R)
