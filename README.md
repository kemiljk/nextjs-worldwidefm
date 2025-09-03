# Worldwide FM

A global music radio platform founded by Gilles Peterson, connecting people through music that transcends borders and cultures. Built with Next.js 15, TypeScript, and Tailwind CSS.

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ (recommended: use [nvm](https://github.com/nvm-sh/nvm))
- **Bun** (package manager) - [Install Bun](https://bun.sh/docs/installation)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd nextjs-worldwidefm
   ```

2. **Install dependencies**

   ```bash
   bun install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory with the following variables, or simply paste in a shared `.env.local` file if you have one:

   ```env
   # Cosmic CMS Configuration
   NEXT_PUBLIC_COSMIC_BUCKET_SLUG=your-bucket-slug
   NEXT_PUBLIC_COSMIC_READ_KEY=your-read-key
   COSMIC_WRITE_KEY=your-write-key

   # RadioCult API (for live player)
   NEXT_PUBLIC_RADIOCULT_API_URL=https://api.radiocult.fm

   # Optional: OpenAI for AI features
   OPENAI_API_KEY=your-openai-key
   ```

4. **Start the development server**

   ```bash
   bun dev
   ```

   The application will be available at [http://localhost:3000](http://localhost:3000)

## 🎨 Design System & Styling

This project uses **Tailwind CSS v4** with a custom design system. The focus is on design contributions through Tailwind classes.

### Key Design Principles

- **Typography**: Custom font stack with Nimbus Sans, Air Compressed, and Founders Grotesk Mono
- **Color System**: Carefully crafted color palette with semantic naming
- **Spacing**: Consistent spacing scale using Tailwind's spacing utilities
- **Components**: Reusable UI components built with Radix UI primitives

### Custom Color Palette

The project includes a comprehensive color system defined in `app/globals.css`:

```css
/* Brand Colors */
--color-almostblack: #231f20;
--color-sunset: #f8971d;
--color-electric: #88ca4f;
--color-hyperpop: #e661a4;
```

### Typography Scale

Custom typography utilities are available:

```css
/* Display Headings */
text-h4: 80px (--text-h4)
text-h5: 70px (--text-h5)
text-h7: 50px (--text-h7)
text-h8: 40px (--text-h8)

/* Body Text */
text-m4: 25px (--text-m4)
text-m5: 20px (--text-m5)
text-m6: 16px (--text-m6)
text-m7: 14px (--text-m7)
text-m8: 12px (--text-m8)

/* Button Text */
text-b1: 30px (--text-b1)
text-b2: 20px (--text-b2)
text-b4: 14px (--text-b4)
```

### Making Design Changes

1. **Component Styling**: Edit components in the `components/` directory
2. **Global Styles**: Modify `app/globals.css` for global changes
3. **Color Updates**: Update CSS custom properties in the `@theme` section
4. **Typography**: Adjust font sizes and weights in the typography scale

### Example: Styling a New Component

```tsx
// components/my-component.tsx
import { cn } from '@/lib/utils';

export function MyComponent({ className, ...props }) {
  return (
    <div
      className={cn(
        'bg-almostblack text-white p-6 rounded-lg',
        'hover:bg-crimson-500 transition-colors',
        className
      )}
      {...props}
    >
      <h2 className='text-h8 font-display uppercase'>Component Title</h2>
      <p className='text-m6 text-gray-100 mt-2'>Component description</p>
    </div>
  );
}
```

## 🏗️ Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── api/               # API routes
│   ├── editorial/         # Editorial content pages
│   ├── episode/           # Episode detail pages
│   ├── shows/             # Shows listing pages
│   └── globals.css        # Global styles & Tailwind config
├── components/            # Reusable React components
│   ├── ui/               # Base UI components (shadcn/ui)
│   ├── editorial/        # Editorial-specific components
│   ├── video/            # Video-related components
│   └── providers/        # React context providers
├── lib/                  # Utility functions and services
│   ├── cosmic-service.ts # Cosmic CMS integration
│   ├── episode-service.ts # Episode data management
│   └── utils.ts          # General utilities
├── hooks/                # Custom React hooks
├── types/                # TypeScript type definitions
└── cosmic/               # Cosmic CMS blocks and elements
```

## 🔧 Development Workflow

### Available Scripts

```bash
# Development
bun dev              # Start development server with Turbopack
bun build            # Build for production
bun start            # Start production server
bun lint             # Run ESLint
bun type-check       # Run TypeScript type checking

# Data Management
bun run fetch-archive        # Fetch archive data
bun run populate-takeovers   # Populate takeover data
```

### Code Style Guidelines

- **TypeScript First**: All new code should be strongly typed
- **Functional Components**: Use React functional components with hooks
- **Tailwind Classes**: Prefer Tailwind utilities over custom CSS
- **Component Composition**: Build complex UIs by composing smaller components
- **Error Handling**: Include proper error boundaries and fallbacks

### File Naming Conventions

- **Components**: PascalCase (`MyComponent.tsx`)
- **Pages**: kebab-case (`my-page.tsx`)
- **Utilities**: camelCase (`myUtility.ts`)
- **Types**: PascalCase with descriptive names (`CosmicEpisode.ts`)

## 🎵 Content Management

### Cosmic CMS Integration

The project uses Cosmic CMS for content management:

- **Shows**: Radio show episodes and metadata
- **Editorial**: Blog posts and articles
- **Videos**: Video content and metadata
- **Hosts**: Radio show hosts and profiles
- **Genres**: Music genre categorization

### Data Flow

1. **Content Creation**: Content is created in Cosmic CMS
2. **API Integration**: Next.js fetches data via Cosmic SDK
3. **Static Generation**: Pages are statically generated with ISR
4. **Real-time Updates**: Content updates trigger revalidation

### Adding New Content Types

1. Define TypeScript interfaces in `lib/cosmic-types.ts`
2. Create service functions in `lib/cosmic-service.ts`
3. Build components in `components/` directory
4. Add pages in `app/` directory

## 🎧 Audio Integration

### Live Player

- **RadioCult Integration**: Live streaming via RadioCult API
- **Real-time Updates**: Current show information
- **Audio Controls**: Play/pause, volume, show info

### Archive Player

- **Episode Playback**: Historical show episodes
- **Tracklist Integration**: Song information and timestamps
- **Search & Filter**: Find specific episodes or tracks

## 🔍 Search & Discovery

### Search Implementation

- **Fuse.js**: Fuzzy search for episodes and content
- **Real-time Results**: Instant search suggestions
- **Multi-field Search**: Search across titles, descriptions, genres

### Filtering System

- **Genre Filters**: Filter by music genres
- **Date Filters**: Filter by broadcast date
- **Host Filters**: Filter by show hosts
- **Location Filters**: Filter by broadcast location

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables for Production

```env
NEXT_PUBLIC_COSMIC_BUCKET_SLUG=your-production-bucket
NEXT_PUBLIC_COSMIC_READ_KEY=your-production-read-key
COSMIC_WRITE_KEY=your-production-write-key
NEXT_PUBLIC_RADIOCULT_API_URL=https://api.radiocult.fm
```

## 🤝 Contributing

### For Designers

1. **Focus on Tailwind Classes**: All styling should use Tailwind utilities
2. **Component-Based**: Work with existing components or create new ones
3. **Responsive Design**: Ensure designs work across all screen sizes
4. **Accessibility**: Follow WCAG guidelines for color contrast and interactions

### For Developers

1. **Type Safety**: Maintain strict TypeScript typing
2. **Performance**: Optimize for Core Web Vitals
3. **Testing**: Add tests for new functionality
4. **Documentation**: Update this README for significant changes

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear commit messages
3. Test thoroughly in development
4. Submit PR with detailed description
5. Address review feedback promptly

## 📚 Key Technologies

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS v4**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **Cosmic CMS**: Headless content management
- **Fuse.js**: Fuzzy search library
- **React Hook Form**: Form handling
- **Zod**: Schema validation

## 🆘 Troubleshooting

### Common Issues

**Build Errors**

```bash
# Clear Next.js cache
rm -rf .next
bun install
bun build
```

**TypeScript Errors**

```bash
# Check types
bun type-check
```

**Styling Issues**

- Check Tailwind classes are properly imported
- Verify custom CSS properties are defined
- Use browser dev tools to inspect computed styles

### Getting Help

1. Check existing issues in the repository
2. Review the codebase for similar implementations
3. Consult the [Next.js documentation](https://nextjs.org/docs)
4. Check [Tailwind CSS documentation](https://tailwindcss.com/docs)

## 📄 License

This project is private and proprietary to Worldwide FM.

---

**Happy coding!** 🎵✨

For questions about the codebase, reach out to the development team or create an issue in the repository.
