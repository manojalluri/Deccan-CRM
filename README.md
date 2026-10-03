# Samarvaa — QR Restaurant Platform
## Project Setup Guide

### ⚙️ Step 1: Configure Supabase

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and create a new project.
2. Copy your **Project URL** and **Anon Key** from: Settings → API.
3. Update your `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 🗄️ Step 2: Run Database Schema

1. In your Supabase project, go to **SQL Editor**.
2. Copy the contents of [`supabase/schema.sql`](./supabase/schema.sql).
3. Paste and run it in the SQL Editor.

This will create all tables with:
- Full Row Level Security (RLS) policies
- Indexes for performance
- Realtime publication setup
- Demo seed data (Urban Bites restaurant + tables)

### 🗳️ Step 3: Create Admin User

1. In Supabase → Authentication → Users → **Invite user** or create manually.
2. After creating, go to SQL Editor and run:

```sql
INSERT INTO profiles (id, restaurant_id, name, email, role)
VALUES (
  'your-auth-user-id-from-supabase-auth',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Your Name',
  'your-email@example.com',
  'owner'
);
```

Replace `your-auth-user-id-from-supabase-auth` with the UUID from Authentication → Users.

### 📦 Step 4: Set Up Storage Bucket

1. In Supabase → Storage → New bucket: `menu-images`
2. Make it **Public**.
3. Add RLS policy: Allow authenticated users to upload.

### 🚀 Step 5: Run Development Server

```bash
npm run dev
```

---

## 🌐 Application Routes

### Customer Routes
| Route | Description |
|-------|-------------|
| `/menu/:slug/table/:token` | Customer menu page |
| `/menu/:slug/table/:token/cart` | Cart page |
| `/menu/:slug/table/:token/order/:id` | Order tracking |

**Example:** `/menu/urban-bites/table/a8f92kd73x1y`

### Admin Routes
| Route | Description |
|-------|-------------|
| `/admin/login` | Admin login |
| `/admin/dashboard` | Dashboard with stats & charts |
| `/admin/orders` | Live orders (Realtime) |
| `/admin/menu` | Menu items management |
| `/admin/categories` | Category management |
| `/admin/tables` | Table + QR code management |
| `/admin/analytics` | Charts & analytics |
| `/admin/settings` | Restaurant settings |

---

## 🏗️ Architecture

```
src/
├── lib/
│   ├── supabase.ts       # Supabase client
│   └── utils.ts          # Utility functions
├── types/
│   └── database.ts       # TypeScript types
├── contexts/
│   └── AuthContext.tsx   # Supabase Auth provider
├── store/
│   └── cartStore.ts      # Zustand cart state
├── services/
│   └── index.ts          # All database operations
├── components/
│   ├── ui/               # Reusable UI components
│   └── auth/             # Route guards
├── layouts/
│   └── AdminLayout.tsx   # Admin sidebar layout
└── pages/
    ├── admin/            # Admin pages
    └── customer/         # Customer pages
```

---

## 🔑 Demo Credentials

After running the schema and creating a profile:
- **Admin URL:** http://localhost:5173/admin/login
- **Test QR URL:** http://localhost:5173/menu/urban-bites/table/a8f92kd73x1y

---

## 🛡️ Security Features

- ✅ Row Level Security (RLS) on all tables
- ✅ Secure random QR tokens (not predictable IDs)
- ✅ Server-side order validation (price, availability, restaurant status)
- ✅ Protected admin routes (JWT-based)
- ✅ Multi-tenant isolation (restaurant_id on every record)
- ✅ Price snapshot on orders (historical accuracy)

---

## ⚡ Realtime Features

- Admin receives new orders instantly (Supabase Realtime)
- Customer sees order status updates live (no refresh needed)
- Order status changes propagate in real-time via Postgres CDC

---

## 📱 Responsive Design

- **Customer menu**: Mobile-first, sticky cart, bottom sheets
- **Admin dashboard**: Desktop sidebar + collapsible mobile drawer
- **Tables management**: Responsive card grid with QR preview
