# LCA Project v3 (LCAPIX)

A modern Life Cycle Assessment platform built with Next.js, React, and TypeScript.

## 🚀 Features

- **Project Management**: Create and manage LCA projects with multiple cases
- **Process Hierarchy**: Build complex process trees with drag-and-drop functionality  
- **Impact Assessment**: Calculate environmental impacts across multiple categories
- **Real-time Collaboration**: Work on projects with team members
- **Modern UI**: Clean, responsive interface with dark mode support
- **Data Visualization**: Interactive charts and graphs for results analysis

## 🛠️ Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI Components**: Radix UI, Tailwind CSS
- **State Management**: Zustand with persistence
- **Authentication**: Mock authentication (ready for Google OAuth)
- **Charts**: Recharts
- **Icons**: Lucide React

## 📦 Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd lca-project-v3
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3002](http://localhost:3002) in your browser.

## 🚀 Deployment

### Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/lca-project-v3)

### Manual Deployment

1. **Build the application:**
```bash
npm run build
```

2. **Deploy to Vercel:**
```bash
npx vercel --prod
```

3. **Deploy to Netlify:**
```bash
npm run build
npx netlify deploy --prod --dir=out
```

### Environment Variables for Production

Set these environment variables in your deployment platform:

```
NEXT_PUBLIC_APP_URL=https://your-domain.com
NEXT_PUBLIC_APP_NAME=LCAPIX
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
JWT_SECRET=your_secure_jwt_secret
```

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Project Structure

```
├── app/                    # Next.js app directory
│   ├── auth/              # Authentication pages
│   ├── project/           # Project management pages
│   └── home/              # Dashboard
├── components/            # Reusable UI components
│   ├── ui/               # Base UI components
│   └── ...               # Feature components
├── lib/                  # Utilities and stores
│   └── store.ts          # Zustand state management
├── hooks/                # Custom React hooks
├── types/                # TypeScript type definitions
└── public/              # Static assets
```

## 🔐 Authentication

Currently uses mock authentication. To integrate real authentication:

1. Set up Google OAuth credentials
2. Update environment variables
3. Modify auth store in `lib/store.ts`
4. Update login/signup pages

## 📊 Features Overview

### Process Hierarchy
- 5-tier structure: Product → Machine → Subprocess → Operation → Elemental
- Drag-and-drop interface
- Real-time updates

### Impact Categories
- Global Warming Potential
- Ozone Depletion
- Acidification
- Eutrophication
- And more...

### Data Management
- Project-based organization
- Case comparison
- Data persistence
- Export capabilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Contact: lcapix50@gmail.com

## 🔄 Migration from v1/v2

See `CLAUDE.md` for detailed migration documentation from previous versions.