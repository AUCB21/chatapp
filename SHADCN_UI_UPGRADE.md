# Shadcn UI Integration Plan

## Overview
Upgrade the chat app UI using [shadcn/ui](https://ui.shadcn.com/) - a collection of beautifully designed, accessible React components built with Radix UI and Tailwind CSS.

## Why Shadcn?
- ✅ Copy-paste components (not an npm dependency)
- ✅ Full control and customization
- ✅ Built on Radix UI (accessibility)
- ✅ Perfect Tailwind CSS integration
- ✅ TypeScript support

---

## Installation Steps

### 1. Initialize Shadcn
```bash
npx shadcn@latest init
```
**Configuration choices:**
- Style: `Default`
- Base color: `Slate` or `Zinc`
- CSS variables: `Yes`
- Tailwind config: Update existing
- Components path: `@/components/ui`
- Utils path: `@/lib/utils`
- React Server Components: `Yes`
- Tailwind prefix: None

### 2. Install Required Components
```bash
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add card
npx shadcn@latest add avatar
npx shadcn@latest add badge
npx shadcn@latest add dialog
npx shadcn@latest add scroll-area
npx shadcn@latest add separator
npx shadcn@latest add dropdown-menu
npx shadcn@latest add toast
npx shadcn@latest add popover
```

---

## Component Updates

### 1. **Login Page** (`src/app/login/page.tsx`)
**Before:** Basic HTML inputs
**After:** 
- `Card` component for container
- `Input` component for email/password fields
- `Button` component for submit
- `Label` component for form labels
- Better error display with styled alerts

### 2. **Register Page** (`src/app/register/page.tsx`)
**Before:** Basic HTML inputs
**After:**
- Same as Login page
- Card-based layout
- Consistent styling

### 3. **Main Chat Interface** (`src/app/page.tsx`)
**Before:** Custom Tailwind layout
**After:**
- `Card` for chat list sidebar
- `ScrollArea` for messages
- `Input` with `Button` for message composer
- `Avatar` for user icons
- `Badge` for unread counts (future)
- `DropdownMenu` for user menu
- `Dialog` for new chat modal
- `Toast` for notifications

### 4. **New Chat Modal** (`src/components/NewChatModal.tsx`)
**Before:** Custom modal with backdrop
**After:**
- `Dialog` component (accessible, keyboard navigation)
- `Input` for email entry
- `Button` for actions
- Better UX with loading states

### 5. **Voice Call UI** (if needed)
**After:**
- `Popover` or `Dialog` for call interface
- `Button` variants for mute/hang up
- Better visual feedback

---

## Design System

### Color Scheme
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
}
```

### Component Hierarchy
```
Main Layout
├── Sidebar (Card)
│   ├── User Menu (DropdownMenu)
│   ├── Chat List (ScrollArea)
│   └── New Chat Button (Button + Dialog)
├── Chat Area (Card)
│   ├── Header (with Avatar, Badge)
│   ├── Messages (ScrollArea)
│   └── Input (Input + Button)
└── Toast Container (for notifications)
```

---

## Updated Features

### Better UX
1. **Loading States**: Skeleton loaders for chat list
2. **Error Handling**: Toast notifications instead of inline errors
3. **Hover Effects**: Smooth transitions on interactive elements
4. **Focus Management**: Proper keyboard navigation
5. **Responsive**: Mobile-first design with shadcn responsive utilities

### Accessibility
- ARIA labels on all interactive elements
- Keyboard shortcuts for common actions
- Focus visible indicators
- Screen reader friendly

### Visual Improvements
- Consistent spacing (shadcn spacing tokens)
- Smooth animations (shadcn motion utilities)
- Better contrast ratios
- Modern, professional appearance

---

## Migration Order

1. ✅ Initialize shadcn
2. ✅ Install base components
3. 🔄 Update `globals.css` with shadcn variables
4. 🔄 Update Login page
5. 🔄 Update Register page
6. 🔄 Update Main chat interface
7. 🔄 Update NewChatModal
8. 🔄 Add Toast provider for notifications
9. ✅ Test all components
10. ✅ Deploy

---

## File Changes Required

### New Files
- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/avatar.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/scroll-area.tsx`
- `src/components/ui/separator.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/toast.tsx`
- `src/components/ui/toaster.tsx`
- `src/components/ui/use-toast.ts`
- `src/lib/utils.ts` (cn helper)
- `components.json` (shadcn config)

### Modified Files
- `src/app/globals.css` (add shadcn variables)
- `src/app/layout.tsx` (add Toaster)
- `src/app/login/page.tsx`
- `src/app/register/page.tsx`
- `src/app/page.tsx`
- `src/components/NewChatModal.tsx`
- `tailwind.config.js` (add shadcn plugins)

---

## Benefits After Migration

1. **Consistency**: All components follow the same design language
2. **Maintainability**: Standard component API across the app
3. **Accessibility**: Built-in ARIA and keyboard support
4. **Customization**: Easy to theme and modify
5. **Developer Experience**: TypeScript types, clear props
6. **Performance**: Tree-shakeable, only bundle what you use
7. **Future-proof**: Easy to add new shadcn components as needed

---

## Next Steps

Reply with "proceed" to start the shadcn installation and migration process.
