# SAP Standard Toolbar Implementation - Task List

## Step 1: Create `src/hooks/use-unsaved-changes.ts`
- Hook to track dirty/unsaved form state across pages
- Exposes `dirty`, `setDirty`, `resetDirty` 

## Step 2: Create `src/components/layout/ConfirmDialog.tsx`
- SAP-style confirmation dialog component
- Supports: title, message, confirm/cancel buttons, custom button labels

## Step 3: Create `src/components/layout/FindDialog.tsx`
- Find/Search dialog with keyword search
- Visual highlighting of matching results in the page
- Search by document number, customer, vendor, plant, material, etc.

## Step 4: Create `src/components/layout/PrintDialog.tsx`
- Print dialog with options:
  - A4 Portrait
  - A4 Landscape  
  - PDF Export
- Only enabled for saved documents

## Step 5: Create `src/components/layout/ToolbarContext.tsx`
- React Context + Provider wrapping AppShell
- Provides:
  - `registerSaveHandler` / `unregisterSaveHandler`
  - `registerCancelHandler` / `unregisterCancelHandler`
  - `setNavigationData(records, currentIndex)`
  - `setDirty(isDirty)`
  - `isDirty` state
  - `isPrintEnabled` state
  - `hasRecordNavigation` state
  - `saveHandler`, `cancelHandler`
  - `navigationRecords`, `navigationIndex`
  - `setPrintEnabled(bool)`

## Step 6: Modify `src/components/layout/AppShell.tsx`
- Wrap with ToolbarProvider
- Major refactor of Standard Toolbar section:
  - **Save** → Call registered handler, validate, show status
  - **Back** → History stack, unsaved changes popup
  - **Exit** → Dashboard redirect with unsaved warning
  - **Cancel** → Confirmation popup → reset
  - **Print** → Open PrintDialog
  - **Find** → Open FindDialog
  - **Record Nav** → First/Prev/Next/Last with context data
  - **Open in New Window** → Preserve session/doc/filters/mode
- Enhanced keyboard shortcuts
- Permission-aware buttons

## Step 7: Integration with tcode pages (if needed)
- Pages already use custom events, but we can add `useUnsavedChanges` hook calls

